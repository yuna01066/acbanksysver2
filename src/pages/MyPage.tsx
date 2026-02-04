import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Calendar, DollarSign, FileText, TrendingUp, User, Trash2, Users, Cloud, CloudOff, Upload, Loader2, RefreshCw, AlertTriangle, CheckCircle2, Pencil, Download, Search, X, Filter } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { usePluuugApi, PluuugClient } from '@/hooks/usePluuugApi';
import { useRecipients, Recipient } from '@/hooks/useRecipients';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { RecipientEditDialog } from '@/components/RecipientEditDialog';

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

// Extended recipient with quote count for display
interface RecipientWithQuoteCount extends Recipient {
  quoteCount: number;
}

const MyPage = () => {
  const { user, profile, signOut, updateProfile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { getClients, getClientStatuses, createClient, deleteClient, loading: pluuugLoading } = usePluuugApi();
  const { 
    recipients, 
    fetchRecipients, 
    markAsSyncedToPluuug,
    clearPluuugSyncStatus,
    getSyncedRecipients,
    toPluuugClientData,
    migrateFromSavedQuotes,
    updateRecipient,
    deleteRecipient,
    createRecipient,
    loading: recipientsLoading 
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
    checked: number;
    valid: number;
    invalid: number;
    clearedRecipients: string[];
  } | null>(null);
  const [editingRecipient, setEditingRecipient] = useState<Recipient | null>(null);
  const [deleteRecipientTarget, setDeleteRecipientTarget] = useState<Recipient | null>(null);
  const [deletingRecipient, setDeletingRecipient] = useState(false);
  const [importingFromPluuug, setImportingFromPluuug] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    importedClients: string[];
  } | null>(null);
  
  // 검색 및 필터 상태
  const [recipientSearch, setRecipientSearch] = useState('');
  const [recipientSyncFilter, setRecipientSyncFilter] = useState<'all' | 'synced' | 'unsynced'>('all');
  
  // 필터링된 담당자 목록 계산
  const getFilteredRecipients = () => {
    let filtered = getRecipientsWithQuoteCounts();
    
    // 검색어 필터
    if (recipientSearch.trim()) {
      const searchLower = recipientSearch.toLowerCase().trim();
      filtered = filtered.filter(r => 
        r.company_name.toLowerCase().includes(searchLower) ||
        r.contact_person.toLowerCase().includes(searchLower) ||
        r.phone.toLowerCase().includes(searchLower) ||
        r.email.toLowerCase().includes(searchLower) ||
        (r.address && r.address.toLowerCase().includes(searchLower)) ||
        (r.memo && r.memo.toLowerCase().includes(searchLower))
      );
    }
    
    // Pluuug 동기화 상태 필터
    if (recipientSyncFilter === 'synced') {
      filtered = filtered.filter(r => isRecipientSyncedToPluuug(r));
    } else if (recipientSyncFilter === 'unsynced') {
      filtered = filtered.filter(r => !isRecipientSyncedToPluuug(r));
    }
    
    return filtered;
  };
  
  
  // Profile edit state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name);
      setPhone(profile.phone || '');
    }
  }, [profile]);

  useEffect(() => {
    if (user) {
      fetchMyQuotes();
      fetchPluuugClients();
      fetchRecipients();
    }
  }, [user, fetchRecipients]);

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

    if (!error && data) {
      setQuotes(data);
    }
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

      // 실제로 삭제된 행이 있는지 확인
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

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile({
      full_name: fullName,
      phone
    });
  };

  const calculateStats = () => {
    const totalQuotes = quotes.length;
    const totalAmount = quotes.reduce((sum, q) => sum + Number(q.total), 0);
    const avgAmount = totalQuotes > 0 ? totalAmount / totalQuotes : 0;

    const now = new Date();
    const thisMonth = quotes.filter(q => {
      const quoteDate = new Date(q.quote_date);
      return quoteDate.getMonth() === now.getMonth() && 
             quoteDate.getFullYear() === now.getFullYear();
    }).length;

    return { totalQuotes, totalAmount, avgAmount, thisMonth };
  };

  // Get recipients with quote counts from the unified recipients table
  const getRecipientsWithQuoteCounts = (): RecipientWithQuoteCount[] => {
    return recipients.map((recipient) => {
      // Count quotes matching this recipient
      const quoteCount = quotes.filter(q => 
        q.recipient_company === recipient.company_name && 
        q.recipient_name === recipient.contact_person
      ).length;
      
      return {
        ...recipient,
        quoteCount
      };
    }).sort((a, b) => b.quoteCount - a.quoteCount);
  };

  const isRecipientSyncedToPluuug = (recipient: Recipient) => {
    // Check our local database first (the source of truth)
    if (recipient.pluuug_client_id) return true;
    // Fallback to checking Pluuug clients list
    return pluuugClients.some(
      c => c.companyName === recipient.company_name && c.inCharge === recipient.contact_person
    );
  };

  const handleSyncRecipientToPluuug = async (recipient: Recipient, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    
    const key = `${recipient.company_name}-${recipient.contact_person}`;
    setSyncingRecipient(key);
    
    try {
      if (isRecipientSyncedToPluuug(recipient)) {
        toast.info('이미 Pluuug에 등록된 고객입니다.');
        setSyncingRecipient(null);
        return;
      }

      const statusId = await resolveDefaultPluuugClientStatusId();
      if (!statusId) {
        toast.error('Pluuug 고객 상태 목록을 불러오지 못했습니다.');
        return;
      }

      // Use the unified data converter
      const clientData = toPluuugClientData(recipient, statusId);
      const result = await createClient(clientData as any);

      if (result.data && !result.error && result.status >= 200 && result.status < 300) {
        // Update our local record with the Pluuug client ID
        const pluuugClientId = result.data.id;
        if (pluuugClientId) {
          await markAsSyncedToPluuug(recipient.id, pluuugClientId);
        }
        toast.success('Pluuug에 고객이 등록되었습니다!');
        await fetchPluuugClients();
        await fetchRecipients();
      } else if (result.error) {
        console.error('Pluuug API Error:', result.error);
        toast.error(`Pluuug 등록 실패: ${result.error}`);
      } else {
        toast.error('Pluuug 등록에 실패했습니다.');
      }
    } catch (err) {
      console.error('Pluuug 동기화 에러:', err);
      toast.error('Pluuug 동기화 중 오류가 발생했습니다.');
    } finally {
      setSyncingRecipient(null);
    }
  };

  const handleBulkSyncAllToPluuug = async () => {
    const unsyncedRecipients = getRecipientsWithQuoteCounts().filter(r => !isRecipientSyncedToPluuug(r));
    
    if (unsyncedRecipients.length === 0) {
      toast.info('모든 담당자가 이미 Pluuug에 등록되어 있습니다.');
      return;
    }

    setBulkSyncing(true);
    
    try {
      const statusId = await resolveDefaultPluuugClientStatusId();
      if (!statusId) {
        toast.error('Pluuug 고객 상태 목록을 불러오지 못했습니다.');
        return;
      }

      let successCount = 0;
      let failCount = 0;

      for (const recipient of unsyncedRecipients) {
        try {
          const clientData = toPluuugClientData(recipient, statusId);
          const result = await createClient(clientData as any);

          if (result.data && !result.error && result.status >= 200 && result.status < 300) {
            const pluuugClientId = result.data.id;
            if (pluuugClientId) {
              await markAsSyncedToPluuug(recipient.id, pluuugClientId);
            }
            successCount++;
          } else {
            failCount++;
            console.error(`Pluuug 등록 실패 (${recipient.company_name}):`, result.error);
          }
        } catch (err) {
          failCount++;
          console.error(`Pluuug 등록 에러 (${recipient.company_name}):`, err);
        }
      }

      await fetchPluuugClients();
      await fetchRecipients();
      
      if (failCount === 0) {
        toast.success(`${successCount}명의 담당자가 Pluuug에 등록되었습니다!`);
      } else {
        toast.warning(`${successCount}명 성공, ${failCount}명 실패`);
      }
    } catch (err) {
      console.error('일괄 동기화 에러:', err);
      toast.error('일괄 동기화 중 오류가 발생했습니다.');
    } finally {
      setBulkSyncing(false);
    }
  };

  const handleMigrateRecipients = async () => {
    setMigrating(true);
    try {
      const count = await migrateFromSavedQuotes();
      if (count > 0) {
        toast.success(`${count}명의 담당자가 마이그레이션되었습니다!`);
      } else {
        toast.info('마이그레이션할 담당자가 없습니다.');
      }
    } catch (err) {
      console.error('마이그레이션 에러:', err);
      toast.error('마이그레이션 중 오류가 발생했습니다.');
    } finally {
      setMigrating(false);
    }
  };

  // Pluuug 동기화 상태 검증: 삭제된 고객 감지
  const handleValidatePluuugSyncStatus = async () => {
    const syncedRecipients = getSyncedRecipients();
    
    if (syncedRecipients.length === 0) {
      toast.info('Pluuug에 연동된 담당자가 없습니다.');
      return;
    }

    setValidatingSyncStatus(true);
    setSyncValidationResult(null);
    
    try {
      // Pluuug에서 현재 고객 목록 조회
      const result = await getClients();
      const payload: any = result.data;
      const pluuugClientsList: PluuugClient[] = Array.isArray(payload) ? payload : payload?.results || [];
      
      // Pluuug 고객 ID 목록
      const pluuugClientIds = new Set(pluuugClientsList.map(c => c.id));
      
      let validCount = 0;
      let invalidCount = 0;
      const clearedRecipients: string[] = [];

      for (const recipient of syncedRecipients) {
        if (recipient.pluuug_client_id) {
          if (pluuugClientIds.has(recipient.pluuug_client_id)) {
            // 고객이 Pluuug에 여전히 존재
            validCount++;
          } else {
            // 고객이 Pluuug에서 삭제됨 - 로컬 동기화 상태 초기화
            const cleared = await clearPluuugSyncStatus(recipient.id);
            if (cleared) {
              invalidCount++;
              clearedRecipients.push(`${recipient.company_name} (${recipient.contact_person})`);
            }
          }
        }
      }

      setSyncValidationResult({
        checked: syncedRecipients.length,
        valid: validCount,
        invalid: invalidCount,
        clearedRecipients
      });

      // 담당자 목록 새로고침
      await fetchRecipients();
      await fetchPluuugClients();

      if (invalidCount > 0) {
        toast.warning(`${invalidCount}명의 담당자가 Pluuug에서 삭제되어 연동이 해제되었습니다.`);
      } else {
        toast.success('모든 연동 상태가 정상입니다!');
      }
    } catch (err) {
      console.error('동기화 검증 에러:', err);
      toast.error('동기화 상태 검증 중 오류가 발생했습니다.');
    } finally {
      setValidatingSyncStatus(false);
    }
  };

  // Pluuug에서 로컬로 고객 가져오기 (역방향 동기화)
  const handleImportFromPluuug = async () => {
    setImportingFromPluuug(true);
    setImportResult(null);
    
    try {
      // Pluuug에서 고객 목록 조회
      const result = await getClients();
      const payload: any = result.data;
      const pluuugClientsList: PluuugClient[] = Array.isArray(payload) ? payload : payload?.results || [];
      
      if (pluuugClientsList.length === 0) {
        toast.info('Pluuug에 등록된 고객이 없습니다.');
        setImportingFromPluuug(false);
        return;
      }

      // 현재 로컬에 있는 Pluuug 고객 ID 목록
      const existingPluuugIds = new Set(
        recipients
          .filter(r => r.pluuug_client_id !== null)
          .map(r => r.pluuug_client_id)
      );
      
      // 회사명+담당자명 조합으로도 체크 (pluuug_client_id가 없는 경우)
      const existingKeys = new Set(
        recipients.map(r => `${r.company_name}-${r.contact_person}`)
      );

      let importedCount = 0;
      let skippedCount = 0;
      const importedClients: string[] = [];

      for (const client of pluuugClientsList) {
        // 이미 연동된 고객인지 확인
        if (existingPluuugIds.has(client.id)) {
          skippedCount++;
          continue;
        }

        // 회사명+담당자명으로 이미 존재하는지 확인
        const key = `${client.companyName}-${client.inCharge}`;
        if (existingKeys.has(key)) {
          skippedCount++;
          continue;
        }

        // 로컬에 새 담당자 생성 (상세 정보 포함)
        const newRecipient = await createRecipient({
          company_name: client.companyName || '미지정',
          contact_person: client.inCharge || '담당자',
          position: client.position || '담당자',
          phone: client.contact || '010-0000-0000',
          email: client.email || `${(client.companyName || 'company').replace(/\s/g, '').toLowerCase()}@example.com`,
          memo: client.content || undefined,
          // Pluuug 상세 정보 매핑
          ceo_name: client.ceoName || client.inCharge || '대표자',
          business_registration_number: client.businessRegistrationNumber || '000-00-00000',
          address: client.companyAddress || undefined,
          detail_address: client.companyDetailAddress || undefined,
          business_type: client.businessType || '서비스업',
          business_class: client.businessClass || '기타',
          branch_number: client.branchNumber || '00',
        });

        if (newRecipient) {
          // Pluuug 연동 정보 저장
          await markAsSyncedToPluuug(newRecipient.id, client.id);
          importedCount++;
          importedClients.push(`${client.companyName} (${client.inCharge})`);
          
          // existingKeys 업데이트 (중복 방지)
          existingKeys.add(key);
        }
      }

      setImportResult({
        imported: importedCount,
        skipped: skippedCount,
        importedClients
      });

      // 담당자 목록 새로고침
      await fetchRecipients();
      await fetchPluuugClients();

      if (importedCount > 0) {
        toast.success(`Pluuug에서 ${importedCount}명의 고객을 가져왔습니다!`);
      } else {
        toast.info('가져올 새 고객이 없습니다. 모든 Pluuug 고객이 이미 등록되어 있습니다.');
      }
    } catch (err) {
      console.error('Pluuug 가져오기 에러:', err);
      toast.error('Pluuug에서 고객을 가져오는 중 오류가 발생했습니다.');
    } finally {
      setImportingFromPluuug(false);
    }
  };

  // 담당자 삭제 처리 (Pluuug 연동된 경우 Pluuug에서도 삭제)
  const handleDeleteRecipient = async () => {
    if (!deleteRecipientTarget) return;

    setDeletingRecipient(true);
    
    try {
      // Pluuug에 연동된 경우 Pluuug에서 먼저 삭제
      if (deleteRecipientTarget.pluuug_client_id) {
        const result = await deleteClient(deleteRecipientTarget.pluuug_client_id);
        
        if (result.error) {
          // Pluuug 삭제 실패 시에도 로컬은 삭제 진행 (Pluuug에서 이미 삭제되었을 수 있음)
          console.warn('Pluuug 삭제 실패 (이미 삭제되었을 수 있음):', result.error);
        } else {
          toast.success('Pluuug에서 고객이 삭제되었습니다.');
        }
      }

      // 로컬 DB에서 삭제
      const success = await deleteRecipient(deleteRecipientTarget.id);
      
      if (success) {
        await fetchRecipients();
        await fetchPluuugClients();
      }
    } catch (err) {
      console.error('담당자 삭제 에러:', err);
      toast.error('담당자 삭제 중 오류가 발생했습니다.');
    } finally {
      setDeletingRecipient(false);
      setDeleteRecipientTarget(null);
    }
  };

  const getQuotesByRecipient = (recipient: RecipientWithQuoteCount): SavedQuote[] => {
    return quotes.filter(quote => 
      quote.recipient_company === recipient.company_name &&
      quote.recipient_name === recipient.contact_person
    );
  };

  const stats = calculateStats();

  if (authLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center">로딩 중...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={() => navigate('/')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            홈으로
          </Button>
          <Button variant="outline" onClick={signOut}>
            로그아웃
          </Button>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">마이페이지</h1>
          <p className="text-muted-foreground">
            {profile?.full_name}님, 환영합니다!
          </p>
        </div>

        <Tabs defaultValue="quotes" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="quotes">내 견적서</TabsTrigger>
            <TabsTrigger value="stats">통계</TabsTrigger>
            <TabsTrigger value="profile">프로필</TabsTrigger>
          </TabsList>

          <TabsContent value="quotes" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>발행한 견적서 목록</CardTitle>
                <CardDescription>
                  총 {quotes.length}개의 견적서를 발행하셨습니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p>로딩 중...</p>
                ) : quotes.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    아직 발행한 견적서가 없습니다.
                  </p>
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
                                  <Badge variant="secondary" className="text-xs flex items-center gap-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                    <Cloud className="w-3 h-3" />
                                    Pluuug
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs flex items-center gap-1 text-muted-foreground">
                                    <CloudOff className="w-3 h-3" />
                                    미연동
                                  </Badge>
                                )}
                              </div>
                              <div className="text-sm space-y-1">
                                <p>수신: {quote.recipient_company} {quote.recipient_name}</p>
                                <p className="font-semibold text-primary">
                                  총액: {quote.total.toLocaleString()}원
                                </p>
                                {quote.desired_delivery_date && (
                                  <p className="text-muted-foreground">
                                    납기희망일: {format(new Date(quote.desired_delivery_date), 'yyyy-MM-dd')}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/saved-quotes/${quote.id}`)}
                              >
                                보기
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setDeleteQuoteId(quote.id)}
                              >
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

          <TabsContent value="stats" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">총 견적서</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalQuotes}개</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">이번 달</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.thisMonth}개</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">총 견적 금액</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.totalAmount.toLocaleString()}원
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">평균 견적 금액</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {Math.round(stats.avgAmount).toLocaleString()}원
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sync Validation Result */}
            {syncValidationResult && (
              <Card className={syncValidationResult.invalid > 0 ? "border-yellow-500/50 bg-yellow-50/50 dark:bg-yellow-900/10" : "border-green-500/50 bg-green-50/50 dark:bg-green-900/10"}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    {syncValidationResult.invalid > 0 ? (
                      <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <h4 className="font-semibold mb-2">
                        {syncValidationResult.invalid > 0 
                          ? 'Pluuug 동기화 상태 변경 감지' 
                          : 'Pluuug 동기화 상태 정상'}
                      </h4>
                      <div className="text-sm space-y-1 text-muted-foreground">
                        <p>검사한 담당자: {syncValidationResult.checked}명</p>
                        <p className="text-green-600">정상 연동: {syncValidationResult.valid}명</p>
                        {syncValidationResult.invalid > 0 && (
                          <div>
                            <p className="text-yellow-600">연동 해제됨: {syncValidationResult.invalid}명</p>
                            <ul className="mt-2 text-xs list-disc list-inside">
                              {syncValidationResult.clearedRecipients.map((name, idx) => (
                                <li key={idx}>{name}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSyncValidationResult(null)}
                    >
                      닫기
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    수신 담당자 리스트
                  </CardTitle>
                  <CardDescription>
                    견적서에 등록된 수신 담당자 목록입니다.
                  </CardDescription>
                </div>
                <div className="flex gap-2 flex-wrap justify-end">
                  {getSyncedRecipients().length > 0 && (
                    <Button
                      variant="outline"
                      onClick={handleValidatePluuugSyncStatus}
                      disabled={validatingSyncStatus || pluuugLoading}
                      className="flex items-center gap-2"
                    >
                      {validatingSyncStatus ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      {validatingSyncStatus ? '검증 중...' : '동기화 상태 검증'}
                    </Button>
                  )}
                  {recipients.length === 0 && (
                    <Button
                      variant="outline"
                      onClick={handleMigrateRecipients}
                      disabled={migrating || recipientsLoading}
                      className="flex items-center gap-2"
                    >
                      {migrating ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      기존 담당자 불러오기
                    </Button>
                  )}
                  {getRecipientsWithQuoteCounts().filter(r => !isRecipientSyncedToPluuug(r)).length > 0 && (
                    <Button
                      onClick={handleBulkSyncAllToPluuug}
                      disabled={bulkSyncing || pluuugLoading}
                      className="flex items-center gap-2"
                    >
                      {bulkSyncing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      {bulkSyncing ? '등록 중...' : `전체 Pluuug 등록 (${getRecipientsWithQuoteCounts().filter(r => !isRecipientSyncedToPluuug(r)).length}명)`}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={handleImportFromPluuug}
                    disabled={importingFromPluuug || pluuugLoading}
                    className="flex items-center gap-2"
                  >
                    {importingFromPluuug ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    {importingFromPluuug ? '가져오는 중...' : 'Pluuug에서 가져오기'}
                  </Button>
                </div>
              </CardHeader>

              {/* Import Result */}
              {importResult && (
                <div className="px-6 pb-4">
                  <Card className="border-primary/50 bg-primary/5">
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-4">
                        <Download className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="font-semibold mb-2">Pluuug 고객 가져오기 완료</h4>
                          <div className="text-sm space-y-1 text-muted-foreground">
                            <p>가져온 고객: <span className="text-primary font-medium">{importResult.imported}명</span></p>
                            <p>이미 존재 (건너뜀): {importResult.skipped}명</p>
                            {importResult.imported > 0 && (
                              <div className="mt-2">
                                <p className="text-xs font-medium mb-1">가져온 고객:</p>
                                <ul className="text-xs list-disc list-inside">
                                  {importResult.importedClients.slice(0, 10).map((name, idx) => (
                                    <li key={idx}>{name}</li>
                                  ))}
                                  {importResult.importedClients.length > 10 && (
                                    <li>... 외 {importResult.importedClients.length - 10}명</li>
                                  )}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setImportResult(null)}
                        >
                          닫기
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
              <CardContent>
                {recipients.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">등록된 수신 담당자가 없습니다.</p>
                    <Button
                      variant="outline"
                      onClick={handleMigrateRecipients}
                      disabled={migrating || recipientsLoading}
                      className="flex items-center gap-2"
                    >
                      {migrating ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      기존 견적서에서 담당자 불러오기
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* 검색 및 필터 UI */}
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="회사명, 담당자, 연락처, 이메일로 검색..."
                          value={recipientSearch}
                          onChange={(e) => setRecipientSearch(e.target.value)}
                          className="pl-9 pr-9"
                        />
                        {recipientSearch && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setRecipientSearch('')}
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-muted-foreground" />
                        <Select
                          value={recipientSyncFilter}
                          onValueChange={(value: 'all' | 'synced' | 'unsynced') => setRecipientSyncFilter(value)}
                        >
                          <SelectTrigger className="w-[160px]">
                            <SelectValue placeholder="동기화 상태" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">전체</SelectItem>
                            <SelectItem value="synced">Pluuug 연동됨</SelectItem>
                            <SelectItem value="unsynced">미연동</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    {/* 검색 결과 요약 */}
                    {(recipientSearch || recipientSyncFilter !== 'all') && (
                      <div className="text-sm text-muted-foreground">
                        검색 결과: <span className="font-medium text-foreground">{getFilteredRecipients().length}명</span>
                        {recipientSearch && (
                          <span> (검색어: "{recipientSearch}")</span>
                        )}
                        {recipientSyncFilter !== 'all' && (
                          <span> ({recipientSyncFilter === 'synced' ? 'Pluuug 연동됨' : '미연동'})</span>
                        )}
                      </div>
                    )}
                    
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>회사명</TableHead>
                            <TableHead>담당자</TableHead>
                            <TableHead>연락처</TableHead>
                            <TableHead>이메일</TableHead>
                            <TableHead>Pluuug</TableHead>
                            <TableHead className="text-right">견적서 수</TableHead>
                            <TableHead className="text-center">관리</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {getFilteredRecipients().length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                검색 결과가 없습니다.
                              </TableCell>
                            </TableRow>
                          ) : (
                            getFilteredRecipients().map((recipient) => {
                          const synced = isRecipientSyncedToPluuug(recipient);
                          const key = `${recipient.company_name}-${recipient.contact_person}`;
                          return (
                            <TableRow 
                              key={recipient.id}
                              className="cursor-pointer hover:bg-accent/50 transition-colors"
                              onClick={() => setSelectedRecipient(recipient)}
                            >
                              <TableCell className="font-medium">{recipient.company_name}</TableCell>
                              <TableCell>{recipient.contact_person}</TableCell>
                              <TableCell>{recipient.phone}</TableCell>
                              <TableCell>{recipient.email}</TableCell>
                              <TableCell>
                                {synced ? (
                                  <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                    <Cloud className="w-3 h-3 mr-1" />
                                    연동됨
                                  </Badge>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => handleSyncRecipientToPluuug(recipient, e)}
                                    disabled={syncingRecipient === key || pluuugLoading}
                                    className="text-xs"
                                  >
                                    {syncingRecipient === key ? (
                                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                    ) : (
                                      <Upload className="w-3 h-3 mr-1" />
                                    )}
                                    Pluuug 등록
                                  </Button>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="font-semibold text-primary">{recipient.quoteCount}건</span>
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingRecipient(recipient);
                                    }}
                                    className="h-8 w-8 p-0"
                                    title="수정"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteRecipientTarget(recipient);
                                    }}
                                    className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    title="삭제"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  프로필 수정
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">이름</Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">이메일</Label>
                    <Input
                      id="email"
                      value={profile?.email || ''}
                      disabled
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">전화번호</Label>
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="010-1234-5678"
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    프로필 업데이트
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={!!deleteQuoteId} onOpenChange={() => setDeleteQuoteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>견적서를 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              이 작업은 되돌릴 수 없습니다. 견적서가 영구적으로 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteQuote}>삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 담당자 삭제 확인 다이얼로그 */}
      <AlertDialog open={!!deleteRecipientTarget} onOpenChange={() => setDeleteRecipientTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>담당자를 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                <strong>{deleteRecipientTarget?.company_name}</strong>의 <strong>{deleteRecipientTarget?.contact_person}</strong>님을 삭제합니다.
              </span>
              {deleteRecipientTarget?.pluuug_client_id && (
                <span className="block text-yellow-600 dark:text-yellow-400">
                  ⚠️ 이 담당자는 Pluuug에 연동되어 있습니다. Pluuug에서도 함께 삭제됩니다.
                </span>
              )}
              <span className="block">이 작업은 되돌릴 수 없습니다.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingRecipient}>취소</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteRecipient}
              disabled={deletingRecipient}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingRecipient ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  삭제 중...
                </>
              ) : (
                '삭제'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!selectedRecipient} onOpenChange={() => setSelectedRecipient(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {selectedRecipient?.contact_person}님 견적서 목록
            </DialogTitle>
            <DialogDescription>
              {selectedRecipient?.company_name} - 총 {selectedRecipient?.quoteCount}건의 견적서
            </DialogDescription>
          </DialogHeader>
          
          {selectedRecipient && (
            <div className="space-y-4">
              <Card className="bg-muted/30">
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">회사명:</span>
                      <span className="ml-2 font-medium">{selectedRecipient.company_name}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">담당자:</span>
                      <span className="ml-2 font-medium">{selectedRecipient.contact_person}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">연락처:</span>
                      <span className="ml-2 font-medium">{selectedRecipient.phone}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">이메일:</span>
                      <span className="ml-2 font-medium">{selectedRecipient.email}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">주소:</span>
                      <span className="ml-2 font-medium">{selectedRecipient.address || '-'}</span>
                    </div>
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
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(quote.quote_date), 'yyyy년 MM월 dd일', { locale: ko })}
                            </span>
                          </div>
                          <div className="text-sm space-y-1">
                            <p className="font-semibold text-primary">
                              총액: {quote.total.toLocaleString()}원
                            </p>
                            {quote.desired_delivery_date && (
                              <p className="text-muted-foreground">
                                납기희망일: {format(new Date(quote.desired_delivery_date), 'yyyy-MM-dd')}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedRecipient(null);
                              navigate(`/saved-quotes/${quote.id}`);
                            }}
                          >
                            상세보기
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Recipient Edit Dialog */}
      <RecipientEditDialog
        recipient={editingRecipient}
        open={!!editingRecipient}
        onOpenChange={(open) => {
          if (!open) setEditingRecipient(null);
        }}
        onSave={async (id, updates) => {
          const result = await updateRecipient(id, updates);
          if (result) {
            await fetchRecipients();
          }
          return result;
        }}
      />
    </div>
  );
};

export default MyPage;
