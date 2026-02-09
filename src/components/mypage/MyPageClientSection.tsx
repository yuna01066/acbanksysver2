import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { usePluuugApi, PluuugClient } from '@/hooks/usePluuugApi';
import { useRecipients, Recipient } from '@/hooks/useRecipients';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { RecipientEditDialog } from '@/components/RecipientEditDialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  Calendar, DollarSign, FileText, TrendingUp, Trash2, Users,
  Cloud, CloudOff, Upload, Loader2, RefreshCw, AlertTriangle,
  CheckCircle2, Pencil, Download, Search, X, Filter,
} from 'lucide-react';

interface SavedQuote {
  id: string;
  quote_number: string;
  quote_date: string;
  recipient_company: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_email: string;
  recipient_address: string;
  total: number;
  items: any;
  desired_delivery_date: string | null;
  pluuug_synced: boolean | null;
  pluuug_synced_at: string | null;
  pluuug_estimate_id: string | null;
}

interface RecipientWithQuoteCount extends Recipient {
  quoteCount: number;
}

const MyPageClientSection: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { getClients, getClientStatuses, createClient, deleteClient, loading: pluuugLoading } = usePluuugApi();
  const {
    recipients, fetchRecipients, markAsSyncedToPluuug, clearPluuugSyncStatus,
    getSyncedRecipients, toPluuugClientData, migrateFromSavedQuotes,
    updateRecipient, deleteRecipient, createRecipient, loading: recipientsLoading,
  } = useRecipients();

  const [quotes, setQuotes] = useState<SavedQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteQuoteId, setDeleteQuoteId] = useState<string | null>(null);
  const [selectedRecipient, setSelectedRecipient] = useState<RecipientWithQuoteCount | null>(null);
  const [pluuugClients, setPluuugClients] = useState<PluuugClient[]>([]);
  const [syncingRecipient, setSyncingRecipient] = useState<string | null>(null);
  const [bulkSyncing, setBulkSyncing] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [validatingSyncStatus, setValidatingSyncStatus] = useState(false);
  const [syncValidationResult, setSyncValidationResult] = useState<{
    checked: number; valid: number; invalid: number; clearedRecipients: string[];
  } | null>(null);
  const [editingRecipient, setEditingRecipient] = useState<Recipient | null>(null);
  const [deleteRecipientTarget, setDeleteRecipientTarget] = useState<Recipient | null>(null);
  const [deletingRecipient, setDeletingRecipient] = useState(false);
  const [importingFromPluuug, setImportingFromPluuug] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: number; skipped: number; importedClients: string[];
  } | null>(null);
  const [recipientSearch, setRecipientSearch] = useState('');
  const [recipientSyncFilter, setRecipientSyncFilter] = useState<'all' | 'synced' | 'unsynced'>('all');

  useEffect(() => {
    if (user) {
      fetchMyQuotes();
      fetchPluuugClients();
      fetchRecipients();
    }
  }, [user]);

  const resolveDefaultPluuugClientStatusId = async (): Promise<number | null> => {
    const statuses = await getClientStatuses();
    const id = statuses.data?.results?.[0]?.id;
    return typeof id === 'number' ? id : null;
  };

  const fetchPluuugClients = async () => {
    try {
      const result = await getClients();
      const payload: any = result.data;
      const list = Array.isArray(payload) ? payload : payload?.results;
      if (Array.isArray(list)) setPluuugClients(list);
    } catch (err) {
      console.error('Pluuug 고객 조회 에러:', err);
    }
  };

  const fetchMyQuotes = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('saved_quotes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (!error && data) setQuotes(data);
    setLoading(false);
  };

  const handleDeleteQuote = async () => {
    if (!deleteQuoteId || !user) return;
    try {
      const { data, error } = await supabase
        .from('saved_quotes')
        .delete()
        .eq('id', deleteQuoteId)
        .eq('user_id', user.id)
        .select();
      if (error) throw error;
      if (!data || data.length === 0) {
        toast.error('견적서를 삭제할 권한이 없습니다.');
        setDeleteQuoteId(null);
        return;
      }
      toast.success('견적서가 삭제되었습니다.');
      fetchMyQuotes();
    } catch (error) {
      console.error('Error deleting quote:', error);
      toast.error('견적서 삭제에 실패했습니다.');
    }
    setDeleteQuoteId(null);
  };

  const calculateStats = () => {
    const totalQuotes = quotes.length;
    const totalAmount = quotes.reduce((sum, q) => sum + Number(q.total), 0);
    const avgAmount = totalQuotes > 0 ? totalAmount / totalQuotes : 0;
    const now = new Date();
    const thisMonth = quotes.filter(q => {
      const quoteDate = new Date(q.quote_date);
      return quoteDate.getMonth() === now.getMonth() && quoteDate.getFullYear() === now.getFullYear();
    }).length;
    return { totalQuotes, totalAmount, avgAmount, thisMonth };
  };

  const getRecipientsWithQuoteCounts = (): RecipientWithQuoteCount[] => {
    return recipients.map((recipient) => {
      const quoteCount = quotes.filter(q =>
        q.recipient_company === recipient.company_name && q.recipient_name === recipient.contact_person
      ).length;
      return { ...recipient, quoteCount };
    }).sort((a, b) => b.quoteCount - a.quoteCount);
  };

  const isRecipientSyncedToPluuug = (recipient: Recipient) => {
    if (recipient.pluuug_client_id) return true;
    return pluuugClients.some(c => c.companyName === recipient.company_name && c.inCharge === recipient.contact_person);
  };

  const getFilteredRecipients = () => {
    let filtered = getRecipientsWithQuoteCounts();
    if (recipientSearch.trim()) {
      const s = recipientSearch.toLowerCase().trim();
      filtered = filtered.filter(r =>
        r.company_name.toLowerCase().includes(s) || r.contact_person.toLowerCase().includes(s) ||
        r.phone.toLowerCase().includes(s) || r.email.toLowerCase().includes(s) ||
        (r.address && r.address.toLowerCase().includes(s)) || (r.memo && r.memo.toLowerCase().includes(s))
      );
    }
    if (recipientSyncFilter === 'synced') filtered = filtered.filter(r => isRecipientSyncedToPluuug(r));
    else if (recipientSyncFilter === 'unsynced') filtered = filtered.filter(r => !isRecipientSyncedToPluuug(r));
    return filtered;
  };

  const handleSyncRecipientToPluuug = async (recipient: Recipient, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const key = `${recipient.company_name}-${recipient.contact_person}`;
    setSyncingRecipient(key);
    try {
      if (isRecipientSyncedToPluuug(recipient)) {
        toast.info('이미 Pluuug에 등록된 고객입니다.');
        setSyncingRecipient(null);
        return;
      }
      const statusId = await resolveDefaultPluuugClientStatusId();
      if (!statusId) { toast.error('Pluuug 고객 상태 목록을 불러오지 못했습니다.'); return; }
      const clientData = toPluuugClientData(recipient, statusId);
      const result = await createClient(clientData as any);
      if (result.data && !result.error && result.status >= 200 && result.status < 300) {
        const pluuugClientId = result.data.id;
        if (pluuugClientId) await markAsSyncedToPluuug(recipient.id, pluuugClientId);
        toast.success('Pluuug에 고객이 등록되었습니다!');
        await fetchPluuugClients();
        await fetchRecipients();
      } else {
        toast.error(`Pluuug 등록 실패: ${result.error || ''}`);
      }
    } catch (err) {
      toast.error('Pluuug 동기화 중 오류가 발생했습니다.');
    } finally {
      setSyncingRecipient(null);
    }
  };

  const handleBulkSyncAllToPluuug = async () => {
    const unsyncedRecipients = getRecipientsWithQuoteCounts().filter(r => !isRecipientSyncedToPluuug(r));
    if (unsyncedRecipients.length === 0) { toast.info('모든 담당자가 이미 Pluuug에 등록되어 있습니다.'); return; }
    setBulkSyncing(true);
    try {
      const statusId = await resolveDefaultPluuugClientStatusId();
      if (!statusId) { toast.error('Pluuug 고객 상태 목록을 불러오지 못했습니다.'); return; }
      let successCount = 0, failCount = 0;
      for (const recipient of unsyncedRecipients) {
        try {
          const clientData = toPluuugClientData(recipient, statusId);
          const result = await createClient(clientData as any);
          if (result.data && !result.error && result.status >= 200 && result.status < 300) {
            const pluuugClientId = result.data.id;
            if (pluuugClientId) await markAsSyncedToPluuug(recipient.id, pluuugClientId);
            successCount++;
          } else { failCount++; }
        } catch { failCount++; }
      }
      await fetchPluuugClients();
      await fetchRecipients();
      if (failCount === 0) toast.success(`${successCount}명의 담당자가 Pluuug에 등록되었습니다!`);
      else toast.warning(`${successCount}명 성공, ${failCount}명 실패`);
    } catch { toast.error('일괄 동기화 중 오류가 발생했습니다.'); }
    finally { setBulkSyncing(false); }
  };

  const handleMigrateRecipients = async () => {
    setMigrating(true);
    try {
      const count = await migrateFromSavedQuotes();
      if (count > 0) toast.success(`${count}명의 담당자가 마이그레이션되었습니다!`);
      else toast.info('마이그레이션할 담당자가 없습니다.');
    } catch { toast.error('마이그레이션 중 오류가 발생했습니다.'); }
    finally { setMigrating(false); }
  };

  const handleValidatePluuugSyncStatus = async () => {
    const syncedRecipients = getSyncedRecipients();
    if (syncedRecipients.length === 0) { toast.info('Pluuug에 연동된 담당자가 없습니다.'); return; }
    setValidatingSyncStatus(true);
    setSyncValidationResult(null);
    try {
      const result = await getClients();
      const payload: any = result.data;
      const pluuugClientsList: PluuugClient[] = Array.isArray(payload) ? payload : payload?.results || [];
      const pluuugClientIds = new Set(pluuugClientsList.map(c => c.id));
      let validCount = 0, invalidCount = 0;
      const clearedRecipients: string[] = [];
      for (const recipient of syncedRecipients) {
        if (recipient.pluuug_client_id) {
          if (pluuugClientIds.has(recipient.pluuug_client_id)) { validCount++; }
          else {
            const cleared = await clearPluuugSyncStatus(recipient.id);
            if (cleared) { invalidCount++; clearedRecipients.push(`${recipient.company_name} (${recipient.contact_person})`); }
          }
        }
      }
      setSyncValidationResult({ checked: syncedRecipients.length, valid: validCount, invalid: invalidCount, clearedRecipients });
      await fetchRecipients();
      await fetchPluuugClients();
      if (invalidCount > 0) toast.warning(`${invalidCount}명의 담당자가 Pluuug에서 삭제되어 연동이 해제되었습니다.`);
      else toast.success('모든 연동 상태가 정상입니다!');
    } catch { toast.error('동기화 상태 검증 중 오류가 발생했습니다.'); }
    finally { setValidatingSyncStatus(false); }
  };

  const handleImportFromPluuug = async () => {
    setImportingFromPluuug(true);
    setImportResult(null);
    try {
      const result = await getClients();
      const payload: any = result.data;
      const pluuugClientsList: PluuugClient[] = Array.isArray(payload) ? payload : payload?.results || [];
      if (pluuugClientsList.length === 0) { toast.info('Pluuug에 등록된 고객이 없습니다.'); setImportingFromPluuug(false); return; }
      const existingPluuugIds = new Set(recipients.filter(r => r.pluuug_client_id !== null).map(r => r.pluuug_client_id));
      const existingKeys = new Set(recipients.map(r => `${r.company_name}-${r.contact_person}`));
      let importedCount = 0, skippedCount = 0;
      const importedClients: string[] = [];
      for (const client of pluuugClientsList) {
        if (existingPluuugIds.has(client.id)) { skippedCount++; continue; }
        const key = `${client.companyName}-${client.inCharge}`;
        if (existingKeys.has(key)) { skippedCount++; continue; }
        const newRecipient = await createRecipient({
          company_name: client.companyName || '미지정',
          contact_person: client.inCharge || '담당자',
          position: client.position || '담당자',
          phone: client.contact || '010-0000-0000',
          email: client.email || `${(client.companyName || 'company').replace(/\s/g, '').toLowerCase()}@example.com`,
          memo: client.content || undefined,
          ceo_name: client.ceoName || client.inCharge || '대표자',
          business_registration_number: client.businessRegistrationNumber || '000-00-00000',
          address: client.companyAddress || undefined,
          detail_address: client.companyDetailAddress || undefined,
          business_type: client.businessType || '서비스업',
          business_class: client.businessClass || '기타',
          branch_number: client.branchNumber || '00',
        });
        if (newRecipient) {
          await markAsSyncedToPluuug(newRecipient.id, client.id);
          importedCount++;
          importedClients.push(`${client.companyName} (${client.inCharge})`);
          existingKeys.add(key);
        }
      }
      setImportResult({ imported: importedCount, skipped: skippedCount, importedClients });
      await fetchRecipients();
      await fetchPluuugClients();
      if (importedCount > 0) toast.success(`Pluuug에서 ${importedCount}명의 고객을 가져왔습니다!`);
      else toast.info('가져올 새 고객이 없습니다.');
    } catch { toast.error('Pluuug에서 고객을 가져오는 중 오류가 발생했습니다.'); }
    finally { setImportingFromPluuug(false); }
  };

  const handleDeleteRecipient = async () => {
    if (!deleteRecipientTarget) return;
    setDeletingRecipient(true);
    try {
      if (deleteRecipientTarget.pluuug_client_id) {
        const result = await deleteClient(deleteRecipientTarget.pluuug_client_id);
        if (!result.error) toast.success('Pluuug에서 고객이 삭제되었습니다.');
      }
      const success = await deleteRecipient(deleteRecipientTarget.id);
      if (success) { await fetchRecipients(); await fetchPluuugClients(); }
    } catch { toast.error('담당자 삭제 중 오류가 발생했습니다.'); }
    finally { setDeletingRecipient(false); setDeleteRecipientTarget(null); }
  };

  const getQuotesByRecipient = (recipient: RecipientWithQuoteCount): SavedQuote[] => {
    return quotes.filter(q => q.recipient_company === recipient.company_name && q.recipient_name === recipient.contact_person);
  };

  const stats = calculateStats();
  const filteredRecipients = getFilteredRecipients();

  return (
    <>
      <Tabs defaultValue="quotes" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="quotes">내 견적서</TabsTrigger>
          <TabsTrigger value="recipients">거래처</TabsTrigger>
          <TabsTrigger value="stats">통계</TabsTrigger>
        </TabsList>

        {/* 내 견적서 */}
        <TabsContent value="quotes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>발행한 견적서 목록</CardTitle>
              <CardDescription>총 {quotes.length}개의 견적서를 발행하셨습니다.</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : quotes.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">아직 발행한 견적서가 없습니다.</p>
              ) : (
                <div className="space-y-3">
                  {quotes.map((quote) => (
                    <Card key={quote.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold">{quote.quote_number}</h3>
                              <span className="text-sm text-muted-foreground">
                                {format(new Date(quote.quote_date), 'yyyy년 MM월 dd일', { locale: ko })}
                              </span>
                              {quote.pluuug_synced ? (
                                <Badge variant="secondary" className="gap-1 text-xs"><Cloud className="h-3 w-3" />연동</Badge>
                              ) : null}
                            </div>
                            <div className="text-sm space-y-1">
                              <p><span className="text-muted-foreground">거래처:</span> {quote.recipient_company} ({quote.recipient_name})</p>
                              <p className="font-semibold text-primary">총액: {quote.total.toLocaleString()}원</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => navigate(`/saved-quotes/${quote.id}`)}>상세보기</Button>
                            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteQuoteId(quote.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 거래처 */}
        <TabsContent value="recipients" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>거래처 관리</CardTitle>
                  <CardDescription>총 {recipients.length}개의 거래처가 등록되어 있습니다.</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleMigrateRecipients} disabled={migrating}>
                    {migrating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                    마이그레이션
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleImportFromPluuug} disabled={importingFromPluuug}>
                    {importingFromPluuug ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
                    Pluuug에서 가져오기
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Search & Filter */}
              <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="회사명, 담당자, 연락처로 검색..."
                    value={recipientSearch}
                    onChange={e => setRecipientSearch(e.target.value)}
                    className="pl-9 h-9 text-sm"
                  />
                  {recipientSearch && (
                    <button onClick={() => setRecipientSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  )}
                </div>
                <Select value={recipientSyncFilter} onValueChange={(v: any) => setRecipientSyncFilter(v)}>
                  <SelectTrigger className="w-32 h-9 text-sm">
                    <Filter className="h-3.5 w-3.5 mr-1" /><SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    <SelectItem value="synced">연동됨</SelectItem>
                    <SelectItem value="unsynced">미연동</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Pluuug sync tools */}
              <div className="flex gap-2 mb-4">
                <Button variant="outline" size="sm" onClick={handleBulkSyncAllToPluuug} disabled={bulkSyncing}>
                  {bulkSyncing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Cloud className="h-4 w-4 mr-1" />}
                  일괄 Pluuug 등록
                </Button>
                <Button variant="outline" size="sm" onClick={handleValidatePluuugSyncStatus} disabled={validatingSyncStatus}>
                  {validatingSyncStatus ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                  연동 상태 검증
                </Button>
              </div>

              {syncValidationResult && (
                <div className="mb-4 p-3 rounded-lg border bg-muted/30 text-sm space-y-1">
                  <p>검증 완료: {syncValidationResult.checked}건 확인, {syncValidationResult.valid}건 정상, {syncValidationResult.invalid}건 해제</p>
                  {syncValidationResult.clearedRecipients.length > 0 && (
                    <p className="text-destructive">해제된 담당자: {syncValidationResult.clearedRecipients.join(', ')}</p>
                  )}
                </div>
              )}

              {importResult && (
                <div className="mb-4 p-3 rounded-lg border bg-muted/30 text-sm space-y-1">
                  <p>가져오기 완료: {importResult.imported}명 추가, {importResult.skipped}명 건너뜀</p>
                  {importResult.importedClients.length > 0 && (
                    <p className="text-primary">추가된 고객: {importResult.importedClients.join(', ')}</p>
                  )}
                </div>
              )}

              {recipientsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : filteredRecipients.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  {recipientSearch || recipientSyncFilter !== 'all' ? '검색 결과가 없습니다.' : '등록된 거래처가 없습니다.'}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">회사명</TableHead>
                        <TableHead className="text-xs">담당자</TableHead>
                        <TableHead className="text-xs">연락처</TableHead>
                        <TableHead className="text-xs">견적수</TableHead>
                        <TableHead className="text-xs">연동</TableHead>
                        <TableHead className="text-xs text-right">관리</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRecipients.map(recipient => {
                        const synced = isRecipientSyncedToPluuug(recipient);
                        const syncKey = `${recipient.company_name}-${recipient.contact_person}`;
                        return (
                          <TableRow
                            key={recipient.id}
                            className="cursor-pointer"
                            onClick={() => setSelectedRecipient(recipient)}
                          >
                            <TableCell className="text-sm font-medium">{recipient.company_name}</TableCell>
                            <TableCell className="text-sm">{recipient.contact_person}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{recipient.phone}</TableCell>
                            <TableCell className="text-sm">{recipient.quoteCount}건</TableCell>
                            <TableCell>
                              {synced ? (
                                <Badge variant="secondary" className="text-xs gap-1"><Cloud className="h-3 w-3" />연동</Badge>
                              ) : (
                                <Button
                                  variant="ghost" size="sm" className="h-7 text-xs gap-1"
                                  onClick={(e) => handleSyncRecipientToPluuug(recipient, e)}
                                  disabled={syncingRecipient === syncKey}
                                >
                                  {syncingRecipient === syncKey ? <Loader2 className="h-3 w-3 animate-spin" /> : <CloudOff className="h-3 w-3" />}
                                  등록
                                </Button>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); setEditingRecipient(recipient); }}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteRecipientTarget(recipient); }}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 통계 */}
        <TabsContent value="stats" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">총 견적서</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{stats.totalQuotes}개</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">이번 달</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{stats.thisMonth}개</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">총 견적 금액</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{stats.totalAmount.toLocaleString()}원</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">평균 견적 금액</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{Math.round(stats.avgAmount).toLocaleString()}원</div></CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <AlertDialog open={!!deleteQuoteId} onOpenChange={() => setDeleteQuoteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>견적서를 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>이 작업은 되돌릴 수 없습니다. 견적서가 영구적으로 삭제됩니다.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteQuote}>삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteRecipientTarget} onOpenChange={() => setDeleteRecipientTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>담당자를 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block"><strong>{deleteRecipientTarget?.company_name}</strong>의 <strong>{deleteRecipientTarget?.contact_person}</strong>님을 삭제합니다.</span>
              {deleteRecipientTarget?.pluuug_client_id && (
                <span className="block text-yellow-600 dark:text-yellow-400">⚠️ 이 담당자는 Pluuug에 연동되어 있습니다. Pluuug에서도 함께 삭제됩니다.</span>
              )}
              <span className="block">이 작업은 되돌릴 수 없습니다.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingRecipient}>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRecipient} disabled={deletingRecipient} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deletingRecipient ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />삭제 중...</> : '삭제'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!selectedRecipient} onOpenChange={() => setSelectedRecipient(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Users className="h-5 w-5" />{selectedRecipient?.contact_person}님 견적서 목록</DialogTitle>
            <DialogDescription>{selectedRecipient?.company_name} - 총 {selectedRecipient?.quoteCount}건의 견적서</DialogDescription>
          </DialogHeader>
          {selectedRecipient && (
            <div className="space-y-4">
              <Card className="bg-muted/30">
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-muted-foreground">회사명:</span><span className="ml-2 font-medium">{selectedRecipient.company_name}</span></div>
                    <div><span className="text-muted-foreground">담당자:</span><span className="ml-2 font-medium">{selectedRecipient.contact_person}</span></div>
                    <div><span className="text-muted-foreground">연락처:</span><span className="ml-2 font-medium">{selectedRecipient.phone}</span></div>
                    <div><span className="text-muted-foreground">이메일:</span><span className="ml-2 font-medium">{selectedRecipient.email}</span></div>
                    <div className="col-span-2"><span className="text-muted-foreground">주소:</span><span className="ml-2 font-medium">{selectedRecipient.address || '-'}</span></div>
                  </div>
                </CardContent>
              </Card>
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground">발행 견적서</h3>
                {getQuotesByRecipient(selectedRecipient).map((quote) => (
                  <Card key={quote.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold">{quote.quote_number}</h4>
                            <span className="text-sm text-muted-foreground">{format(new Date(quote.quote_date), 'yyyy년 MM월 dd일', { locale: ko })}</span>
                          </div>
                          <div className="text-sm space-y-1">
                            <p className="font-semibold text-primary">총액: {quote.total.toLocaleString()}원</p>
                            {quote.desired_delivery_date && <p className="text-muted-foreground">납기희망일: {format(new Date(quote.desired_delivery_date), 'yyyy-MM-dd')}</p>}
                          </div>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => { setSelectedRecipient(null); navigate(`/saved-quotes/${quote.id}`); }}>상세보기</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <RecipientEditDialog
        recipient={editingRecipient}
        open={!!editingRecipient}
        onOpenChange={open => { if (!open) setEditingRecipient(null); }}
        onSave={async (id, updates) => {
          const result = await updateRecipient(id, updates);
          if (result) await fetchRecipients();
          return result;
        }}
      />
    </>
  );
};

export default MyPageClientSection;
