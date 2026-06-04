import { useState, useEffect, useCallback, useMemo } from 'react';
import CorpStatusCheck from '@/components/CorpStatusCheck';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useRecipients, Recipient } from '@/hooks/useRecipients';
import { RecipientEditDialog } from '@/components/RecipientEditDialog';
import { RecipientDocumentUpload } from '@/components/RecipientDocumentUpload';
import CrmDashboardSummary from '@/components/recipient/CrmDashboardSummary';
import RecipientTimeline from '@/components/recipient/RecipientTimeline';
import RecipientNotesPanel from '@/components/recipient/RecipientNotesPanel';
import RecipientSalesStats from '@/components/recipient/RecipientSalesStats';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Search, Building2, User, FileText, Eye, Pencil, Trash2,
  Loader2, ArrowLeft, Upload, Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatPrice } from '@/utils/priceCalculations';
import { getStageInfo } from '@/components/ProjectStageSelect';

interface QuoteHistoryItem {
  id: string;
  quote_number: string;
  quote_date: string;
  project_name: string | null;
  total: number;
  project_stage: string;
  recipient_id?: string | null;
  recipient_company?: string | null;
  recipient_name?: string | null;
}

interface QuoteSummaryItem {
  id: string;
  quote_date: string;
  recipient_id: string | null;
  recipient_company: string | null;
  recipient_name: string | null;
  project_id: string | null;
}

interface RecipientCompanyGroup {
  key: string;
  companyName: string;
  contacts: Recipient[];
  quoteCount: number;
  latestQuoteDate: string | null;
  linkedProjectCount: number;
  latestActivityAt: string | null;
}

const normalizeCompanyKey = (value?: string | null) => value?.trim().toLowerCase() || '';

const mergeQuoteHistory = (groups: QuoteHistoryItem[][]) => {
  const map = new Map<string, QuoteHistoryItem>();
  groups.flat().forEach((quote) => {
    if (quote?.id) map.set(quote.id, quote);
  });
  return Array.from(map.values()).sort((a, b) =>
    new Date(b.quote_date).getTime() - new Date(a.quote_date).getTime()
  );
};

const RecipientManagementPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const {
    recipients, loading, fetchRecipients, updateRecipient, deleteRecipient,
  } = useRecipients();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(
    searchParams.get('id')
  );
  const [selectedCompanyKey, setSelectedCompanyKey] = useState<string>(
    normalizeCompanyKey(searchParams.get('company'))
  );
  const [quoteHistory, setQuoteHistory] = useState<QuoteHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [editRecipient, setEditRecipient] = useState<Recipient | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'date'>('name');
  const [quoteSummaries, setQuoteSummaries] = useState<QuoteSummaryItem[]>([]);
  const [projectCountsByRecipientId, setProjectCountsByRecipientId] = useState<Record<string, number>>({});

  const companyFilter = searchParams.get('company');

  useEffect(() => {
    if (user) fetchRecipients();
  }, [user, fetchRecipients]);

  useEffect(() => {
    if (companyFilter) {
      setSearchTerm(companyFilter);
    }
  }, [companyFilter]);

  useEffect(() => {
    if (!user) return;

    const fetchGroupStats = async () => {
      const { data: quotes, error: quoteError } = await supabase
        .from('saved_quotes')
        .select('id, quote_date, recipient_id, recipient_company, recipient_name, project_id')
        .order('quote_date', { ascending: false })
        .limit(1000);

      if (quoteError) {
        console.error('고객사 견적 요약 조회 에러:', quoteError);
      } else {
        setQuoteSummaries((quotes || []) as QuoteSummaryItem[]);
      }

      const recipientIds = recipients.map(r => r.id);
      if (recipientIds.length === 0) {
        setProjectCountsByRecipientId({});
        return;
      }

      const { data: projects, error: projectError } = await supabase
        .from('projects')
        .select('id, recipient_id')
        .in('recipient_id', recipientIds);

      if (projectError) {
        console.error('고객사 프로젝트 요약 조회 에러:', projectError);
        setProjectCountsByRecipientId({});
        return;
      }

      const counts = (projects || []).reduce<Record<string, number>>((acc, project) => {
        const recipientId = project.recipient_id;
        if (recipientId) acc[recipientId] = (acc[recipientId] || 0) + 1;
        return acc;
      }, {});
      setProjectCountsByRecipientId(counts);
    };

    fetchGroupStats();
  }, [user, recipients]);

  useEffect(() => {
    const idParam = searchParams.get('id');
    if (idParam && recipients.length > 0) {
      const found = recipients.find(r => r.id === idParam);
      if (found) {
        setSelectedRecipientId(idParam);
        setSelectedCompanyKey(normalizeCompanyKey(found.company_name));
      }
    }
  }, [searchParams, recipients]);

  const fetchQuoteHistory = async ({
    companyName,
    contacts,
    selectedContact,
  }: {
    companyName: string;
    contacts: Recipient[];
    selectedContact?: Recipient | null;
  }) => {
    if (!user) return;
    setHistoryLoading(true);
    try {
      const selectFields = 'id, quote_number, quote_date, project_name, total, project_stage, recipient_id, recipient_company, recipient_name';
      const recipientIds = selectedContact ? [selectedContact.id] : contacts.map(contact => contact.id);
      const historyGroups: QuoteHistoryItem[][] = [];

      if (recipientIds.length > 0) {
        const { data, error } = await supabase
          .from('saved_quotes')
          .select(selectFields)
          .in('recipient_id', recipientIds)
          .order('quote_date', { ascending: false });
        if (error) throw error;
        historyGroups.push((data || []) as QuoteHistoryItem[]);
      }

      if (selectedContact) {
        const { data, error } = await supabase
          .from('saved_quotes')
          .select(selectFields)
          .eq('recipient_company', companyName)
          .eq('recipient_name', selectedContact.contact_person)
          .order('quote_date', { ascending: false });
        if (error) throw error;
        historyGroups.push((data || []) as QuoteHistoryItem[]);
      } else {
        const { data, error } = await supabase
          .from('saved_quotes')
          .select(selectFields)
          .eq('recipient_company', companyName)
          .order('quote_date', { ascending: false });
        if (error) throw error;
        historyGroups.push((data || []) as QuoteHistoryItem[]);
      }

      setQuoteHistory(mergeQuoteHistory(historyGroups));
    } catch (err) {
      console.error('견적 히스토리 조회 에러:', err);
      toast.error('견적 히스토리를 불러오지 못했습니다.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 담당자를 삭제하시겠습니까?')) return;
    const success = await deleteRecipient(id);
    if (success) {
      if (selectedRecipientId === id) {
        setSelectedRecipientId(null);
        setSearchParams({}, { replace: true });
        setQuoteHistory([]);
      }
      fetchRecipients();
    }
  };

  const recipientsById = useMemo(() => new Map(recipients.map(recipient => [recipient.id, recipient])), [recipients]);

  const companyGroups = useMemo<RecipientCompanyGroup[]>(() => {
    const groupMap = new Map<string, RecipientCompanyGroup>();

    recipients.forEach((recipient) => {
      const key = normalizeCompanyKey(recipient.company_name);
      if (!key) return;

      const current = groupMap.get(key) || {
        key,
        companyName: recipient.company_name,
        contacts: [],
        quoteCount: 0,
        latestQuoteDate: null,
        linkedProjectCount: 0,
        latestActivityAt: null,
      };
      current.contacts.push(recipient);
      const updatedAt = recipient.updated_at || recipient.created_at;
      if (!current.latestActivityAt || new Date(updatedAt).getTime() > new Date(current.latestActivityAt).getTime()) {
        current.latestActivityAt = updatedAt;
      }
      groupMap.set(key, current);
    });

    const quoteIdsByGroup = new Map<string, Set<string>>();
    const projectIdsByGroup = new Map<string, Set<string>>();

    quoteSummaries.forEach((quote) => {
      const linkedRecipient = quote.recipient_id ? recipientsById.get(quote.recipient_id) : null;
      const key = linkedRecipient
        ? normalizeCompanyKey(linkedRecipient.company_name)
        : normalizeCompanyKey(quote.recipient_company);
      const group = key ? groupMap.get(key) : null;
      if (!group) return;

      if (!quoteIdsByGroup.has(key)) quoteIdsByGroup.set(key, new Set());
      quoteIdsByGroup.get(key)!.add(quote.id);

      if (quote.project_id) {
        if (!projectIdsByGroup.has(key)) projectIdsByGroup.set(key, new Set());
        projectIdsByGroup.get(key)!.add(quote.project_id);
      }

      if (!group.latestQuoteDate || new Date(quote.quote_date).getTime() > new Date(group.latestQuoteDate).getTime()) {
        group.latestQuoteDate = quote.quote_date;
      }
    });

    groupMap.forEach((group, key) => {
      group.quoteCount = quoteIdsByGroup.get(key)?.size || 0;
      const quoteLinkedProjectCount = projectIdsByGroup.get(key)?.size || 0;
      let recipientLinkedProjectCount = 0;
      group.contacts.forEach((contact) => {
        recipientLinkedProjectCount += projectCountsByRecipientId[contact.id] || 0;
      });
      group.linkedProjectCount = recipientLinkedProjectCount || quoteLinkedProjectCount;
      group.contacts.sort((a, b) => a.contact_person.localeCompare(b.contact_person, 'ko'));
    });

    return Array.from(groupMap.values());
  }, [projectCountsByRecipientId, quoteSummaries, recipients, recipientsById]);

  const filteredCompanyGroups = companyGroups.filter(group => {
    const s = searchTerm.toLowerCase().trim();
    if (!s) return true;
    return (
      group.companyName.toLowerCase().includes(s) ||
      group.contacts.some(r =>
        (r.business_name || '').toLowerCase().includes(s) ||
        (r.contact_person || '').toLowerCase().includes(s) ||
        (r.email || '').toLowerCase().includes(s) ||
        (r.phone || '').toLowerCase().includes(s) ||
        (r.ceo_name || '').toLowerCase().includes(s) ||
        (r.business_registration_number || '').includes(s)
      )
    );
  }).sort((a, b) => {
    if (sortBy === 'name') {
      return a.companyName.localeCompare(b.companyName, 'ko');
    }
    return new Date(b.latestQuoteDate || b.latestActivityAt || 0).getTime()
      - new Date(a.latestQuoteDate || a.latestActivityAt || 0).getTime();
  });

  const recipientSummary = useMemo(() => ({
    total: companyGroups.length,
    filtered: filteredCompanyGroups.length,
    contacts: recipients.length,
    withBusinessNumber: recipients.filter(r =>
      r.business_registration_number && r.business_registration_number !== '000-00-00000'
    ).length,
    withAccountingContact: recipients.filter(r =>
      r.accounting_contact_person || r.accounting_email || r.accounting_phone
    ).length,
  }), [companyGroups.length, filteredCompanyGroups.length, recipients]);

  const selectedRecipient = recipients.find(r => r.id === selectedRecipientId) || null;
  const selectedCompanyGroup = selectedRecipient
    ? companyGroups.find(group => group.key === normalizeCompanyKey(selectedRecipient.company_name)) || null
    : companyGroups.find(group => group.key === selectedCompanyKey) || null;

  useEffect(() => {
    if (selectedCompanyGroup) {
      fetchQuoteHistory({
        companyName: selectedCompanyGroup.companyName,
        contacts: selectedCompanyGroup.contacts,
        selectedContact: selectedRecipient,
      });
    } else {
      setQuoteHistory([]);
    }
  }, [selectedCompanyGroup, selectedRecipient]);

  const handleSelectCompany = useCallback((group: RecipientCompanyGroup) => {
    setSelectedCompanyKey(group.key);
    setSelectedRecipientId(null);
    setSearchParams({ company: group.companyName }, { replace: true });
  }, [setSearchParams]);

  const handleSelectRecipient = useCallback((recipientId: string) => {
    const recipient = recipients.find(r => r.id === recipientId);
    setSelectedRecipientId(recipientId);
    if (recipient) setSelectedCompanyKey(normalizeCompanyKey(recipient.company_name));
    setSearchParams({ id: recipientId }, { replace: true });
  }, [recipients, setSearchParams]);

  useEffect(() => {
    if (companyFilter && !selectedRecipientId && filteredCompanyGroups.length > 0) {
      const group = filteredCompanyGroups.find(item => normalizeCompanyKey(item.companyName) === normalizeCompanyKey(companyFilter));
      if (group) setSelectedCompanyKey(group.key);
    }
  }, [companyFilter, filteredCompanyGroups, selectedRecipientId]);

  const [unregisteredCompany, setUnregisteredCompany] = useState<{
    company: string;
    name: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
  } | null>(null);

  useEffect(() => {
    if (companyFilter && !loading && filteredCompanyGroups.length === 0) {
      const fetchFromQuotes = async () => {
        const { data } = await supabase
          .from('saved_quotes')
          .select('recipient_company, recipient_name, recipient_phone, recipient_email, recipient_address')
          .eq('recipient_company', companyFilter)
          .limit(1);
        if (data && data.length > 0) {
          setUnregisteredCompany({
            company: data[0].recipient_company || companyFilter,
            name: data[0].recipient_name,
            phone: data[0].recipient_phone,
            email: data[0].recipient_email,
            address: data[0].recipient_address,
          });
        }
      };
      fetchFromQuotes();
    } else {
      setUnregisteredCompany(null);
    }
  }, [companyFilter, loading, filteredCompanyGroups.length]);

  const [unregisteredQuoteHistory, setUnregisteredQuoteHistory] = useState<QuoteHistoryItem[]>([]);
  useEffect(() => {
    if (unregisteredCompany) {
      const fetchHistory = async () => {
        setHistoryLoading(true);
        const { data } = await supabase
          .from('saved_quotes')
          .select('id, quote_number, quote_date, project_name, total, project_stage')
          .eq('recipient_company', unregisteredCompany.company)
          .order('quote_date', { ascending: false });
        setUnregisteredQuoteHistory(data || []);
        setHistoryLoading(false);
      };
      fetchHistory();
    } else {
      setUnregisteredQuoteHistory([]);
    }
  }, [unregisteredCompany]);

  const handleRegisterRecipient = async () => {
    if (!unregisteredCompany || !user) return;
    try {
      const { error } = await supabase.from('recipients').insert({
        user_id: user.id,
        company_name: unregisteredCompany.company,
        contact_person: unregisteredCompany.name || '담당자',
        phone: unregisteredCompany.phone || '',
        email: unregisteredCompany.email || '',
        address: unregisteredCompany.address || null,
      });
      if (error) throw error;
      toast.success('고객사가 등록되었습니다!');
      setUnregisteredCompany(null);
      await fetchRecipients();
    } catch (err) {
      console.error('고객사 등록 에러:', err);
      toast.error('고객사 등록에 실패했습니다.');
    }
  };

  if (!user) {
    navigate('/auth');
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
            <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              뒤로
            </Button>
          </div>
          <div className="text-center">
            <h1 className="text-2xl sm:text-4xl font-bold mb-2 bg-gradient-to-r from-primary via-primary-glow to-accent bg-clip-text text-transparent">
              고객사 관리
            </h1>
            <p className="text-xs sm:text-base text-muted-foreground">고객사 정보 및 견적 히스토리를 관리합니다</p>
          </div>
        </div>

        {/* CRM Dashboard Summary */}
        <CrmDashboardSummary />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          {/* Left: Recipient List */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  고객사 목록
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {recipientSummary.filtered}/{recipientSummary.total}
                  </Badge>
                </CardTitle>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-md bg-muted/50 px-2.5 py-2">
                    <div className="text-muted-foreground">담당자</div>
                    <div className="font-semibold">{recipientSummary.contacts}명</div>
                  </div>
                  <div className="rounded-md bg-muted/50 px-2.5 py-2">
                    <div className="text-muted-foreground">사업자번호</div>
                    <div className="font-semibold">{recipientSummary.withBusinessNumber}곳</div>
                  </div>
                  <div className="rounded-md bg-muted/50 px-2.5 py-2">
                    <div className="text-muted-foreground">회계 담당</div>
                    <div className="font-semibold">{recipientSummary.withAccountingContact}곳</div>
                  </div>
                </div>
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="회사명, 담당자, 연락처, 사업자번호 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex gap-1 mt-2">
                  <Button
                    variant={sortBy === 'name' ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs flex-1"
                    onClick={() => setSortBy('name')}
                  >
                    가나다순
                  </Button>
                  <Button
                    variant={sortBy === 'date' ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs flex-1"
                    onClick={() => setSortBy('date')}
                  >
                    최신순
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0 max-h-[60vh] overflow-y-auto">
                {loading ? (
                  <div className="p-8 text-center text-muted-foreground">로딩 중...</div>
                ) : filteredCompanyGroups.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    {searchTerm ? '검색 결과가 없습니다.' : '등록된 고객사가 없습니다.'}
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredCompanyGroups.map((group) => (
                      <div
                        key={group.key}
                        className={`p-4 transition-colors ${
                          selectedCompanyGroup?.key === group.key ? 'bg-primary/5 border-l-4 border-l-primary' : 'hover:bg-muted/50'
                        }`}
                      >
                        <button
                          type="button"
                          className="w-full text-left"
                          onClick={() => handleSelectCompany(group)}
                        >
                          <div className="flex items-center justify-between gap-3 mb-1">
                            <span className="font-semibold text-sm truncate">{group.companyName}</span>
                            <Badge variant="outline" className="shrink-0 text-[11px]">
                              견적 {group.quoteCount}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              담당자 {group.contacts.length}명
                            </span>
                            {group.linkedProjectCount > 0 && <span>프로젝트 {group.linkedProjectCount}건</span>}
                            {group.latestQuoteDate && (
                              <span>
                                최근 {new Date(group.latestQuoteDate).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                              </span>
                            )}
                          </div>
                        </button>

                        <div className="mt-3 space-y-1.5">
                          {group.contacts.map((contact, index) => (
                            <button
                              key={contact.id}
                              type="button"
                              className={`flex w-full items-center justify-between rounded-md border px-2.5 py-2 text-left text-xs transition-colors ${
                                selectedRecipientId === contact.id
                                  ? 'border-primary bg-background text-primary'
                                  : 'border-border/70 bg-background/70 hover:border-primary/40'
                              }`}
                              onClick={() => handleSelectRecipient(contact.id)}
                            >
                              <span className="min-w-0">
                                <span className="font-semibold">담당자 {index + 1}</span>
                                <span className="ml-1.5 truncate">{contact.contact_person}</span>
                                {contact.position && <span className="ml-1 text-muted-foreground">({contact.position})</span>}
                              </span>
                              <span className="shrink-0 text-muted-foreground">{contact.phone || '-'}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: Detail + Quote History */}
          <div className="lg:col-span-2 space-y-6">
            {selectedCompanyGroup ? (
              <>
                {/* Recipient Detail */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Building2 className="w-5 h-5" />
                        {selectedCompanyGroup.companyName}
                        <Badge variant="secondary" className="text-xs">
                          담당자 {selectedCompanyGroup.contacts.length}명
                        </Badge>
                      </CardTitle>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate('/saved-quotes')}
                        >
                          <FileText className="w-4 h-4 mr-1" />
                          견적 보기
                        </Button>
                        {selectedRecipient && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditRecipient(selectedRecipient);
                                setEditDialogOpen(true);
                              }}
                            >
                              <Pencil className="w-4 h-4 mr-1" />
                              담당자 수정
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(selectedRecipient.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4 rounded-lg border bg-muted/20 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold">담당자 목록</p>
                          <p className="text-xs text-muted-foreground">
                            회사를 선택하면 전체 이력, 담당자를 선택하면 담당자별 이력을 봅니다.
                          </p>
                        </div>
                        <Button
                          variant={!selectedRecipient ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handleSelectCompany(selectedCompanyGroup)}
                        >
                          회사 전체
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedCompanyGroup.contacts.map((contact, index) => (
                          <Button
                            key={contact.id}
                            type="button"
                            variant={selectedRecipientId === contact.id ? 'default' : 'outline'}
                            size="sm"
                            className="h-auto gap-2 rounded-full px-3 py-1.5"
                            onClick={() => handleSelectRecipient(contact.id)}
                          >
                            <span className="text-[11px] opacity-75">담당자 {index + 1}</span>
                            <span>{contact.contact_person}</span>
                          </Button>
                        ))}
                      </div>
                    </div>

                    {selectedRecipient ? (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          {/* 업체 정보 */}
                          <div className="space-y-2 md:col-span-2">
                            <h4 className="font-semibold text-muted-foreground border-b pb-1">업체 정보</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              <InfoRow label="회사명" value={selectedRecipient.company_name} />
                              <InfoRow label="사업자명" value={(selectedRecipient as any).business_name} />
                            </div>
                          </div>
                          {/* 프로젝트 담당자 */}
                          <div className="space-y-2">
                            <h4 className="font-semibold text-muted-foreground border-b pb-1">프로젝트 담당자</h4>
                            <InfoRow label="담당자" value={selectedRecipient.contact_person} />
                            <InfoRow label="직책" value={selectedRecipient.position} />
                            <InfoRow label="연락처" value={selectedRecipient.phone} />
                            <InfoRow label="이메일" value={selectedRecipient.email} />
                            <InfoRow label="주소" value={selectedRecipient.address} />
                            {selectedRecipient.detail_address && (
                              <InfoRow label="상세주소" value={selectedRecipient.detail_address} />
                            )}
                          </div>
                          {/* 회계 담당자 */}
                          <div className="space-y-2">
                            <h4 className="font-semibold text-muted-foreground border-b pb-1">회계 담당자</h4>
                            <InfoRow label="담당자" value={(selectedRecipient as any).accounting_contact_person} />
                            <InfoRow label="직책" value={(selectedRecipient as any).accounting_position} />
                            <InfoRow label="연락처" value={(selectedRecipient as any).accounting_phone} />
                            <InfoRow label="이메일" value={(selectedRecipient as any).accounting_email} />
                          </div>
                          {/* 사업자 정보 */}
                          <div className="space-y-2 md:col-span-2">
                            <h4 className="font-semibold text-muted-foreground border-b pb-1">사업자 정보</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              <InfoRow label="대표자명" value={selectedRecipient.ceo_name} />
                              <InfoRow label="사업자등록번호" value={selectedRecipient.business_registration_number} />
                              <InfoRow label="업태" value={selectedRecipient.business_type} />
                              <InfoRow label="업종" value={selectedRecipient.business_class} />
                              <InfoRow label="종사업장번호" value={selectedRecipient.branch_number} />
                            </div>
                            {selectedRecipient.business_registration_number && 
                             selectedRecipient.business_registration_number !== '000-00-00000' && (
                              <div className="mt-2 pt-2 border-t">
                                <p className="text-xs font-medium text-muted-foreground mb-1.5">사업자등록상태 조회</p>
                                <CorpStatusCheck 
                                  initialCorpNum={selectedRecipient.business_registration_number} 
                                  compact 
                                />
                              </div>
                            )}
                          </div>
                        </div>
                        {selectedRecipient.memo && (
                          <div className="mt-4 p-3 bg-muted/30 rounded-lg">
                            <span className="text-xs font-semibold text-muted-foreground">메모</span>
                            <p className="text-sm mt-1">{selectedRecipient.memo}</p>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                        <div className="rounded-lg bg-muted/30 p-3">
                          <p className="text-xs text-muted-foreground">전체 견적</p>
                          <p className="mt-1 text-lg font-bold">{selectedCompanyGroup.quoteCount}건</p>
                        </div>
                        <div className="rounded-lg bg-muted/30 p-3">
                          <p className="text-xs text-muted-foreground">연결 프로젝트</p>
                          <p className="mt-1 text-lg font-bold">{selectedCompanyGroup.linkedProjectCount}건</p>
                        </div>
                        <div className="rounded-lg bg-muted/30 p-3">
                          <p className="text-xs text-muted-foreground">최근 견적</p>
                          <p className="mt-1 text-sm font-semibold">
                            {selectedCompanyGroup.latestQuoteDate
                              ? new Date(selectedCompanyGroup.latestQuoteDate).toLocaleDateString('ko-KR')
                              : '-'}
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Business Document Upload */}
                {selectedRecipient && (
                  <RecipientDocumentUpload
                    recipientId={selectedRecipient.id}
                    documentUrl={(selectedRecipient as any).business_document_url || null}
                    onDocumentChange={() => fetchRecipients()}
                    onBusinessInfoExtracted={async (info) => {
                      try {
                        const updates: Record<string, string> = {};
                        if (info.business_name) updates.business_name = info.business_name;
                        if (info.ceo_name) updates.ceo_name = info.ceo_name;
                        if (info.business_registration_number) updates.business_registration_number = info.business_registration_number;
                        if (info.business_type) updates.business_type = info.business_type;
                        if (info.business_class) updates.business_class = info.business_class;
                        if (info.address) updates.address = info.address;
                        if (info.detail_address) updates.detail_address = info.detail_address;
                        if (info.branch_number) updates.branch_number = info.branch_number;

                        if (Object.keys(updates).length > 0) {
                          await updateRecipient(selectedRecipient.id, updates);
                          await fetchRecipients();
                        }
                      } catch (err) {
                        console.error('사업자 정보 업데이트 에러:', err);
                      }
                    }}
                  />
                )}

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      최근 견적
                      <Badge variant="secondary" className="ml-1">{quoteHistory.length}건</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {historyLoading ? (
                      <div className="p-6 text-center text-sm text-muted-foreground">견적 이력을 불러오는 중...</div>
                    ) : quoteHistory.length === 0 ? (
                      <div className="p-6 text-center text-sm text-muted-foreground">연결된 견적 이력이 없습니다.</div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>견적번호</TableHead>
                            <TableHead>프로젝트명</TableHead>
                            <TableHead>견적일</TableHead>
                            <TableHead>단계</TableHead>
                            <TableHead className="text-right">금액</TableHead>
                            <TableHead className="w-10"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {quoteHistory.slice(0, 8).map((q) => {
                            const stageInfo = getStageInfo(q.project_stage);
                            return (
                              <TableRow key={q.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/saved-quotes/${q.id}`)}>
                                <TableCell className="font-medium">{q.quote_number}</TableCell>
                                <TableCell className="max-w-[220px] truncate">{q.project_name || '-'}</TableCell>
                                <TableCell>{new Date(q.quote_date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })}</TableCell>
                                <TableCell><Badge variant="outline" className={`text-xs ${stageInfo.color}`}>{stageInfo.label}</Badge></TableCell>
                                <TableCell className="text-right font-semibold">{formatPrice(q.total)}</TableCell>
                                <TableCell><Eye className="w-4 h-4 text-muted-foreground" /></TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                    {quoteHistory.length > 8 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 w-full"
                        onClick={() => navigate('/saved-quotes')}
                      >
                        전체 견적 보기
                      </Button>
                    )}
                  </CardContent>
                </Card>

                {/* Tabbed CRM View */}
                <Tabs defaultValue="timeline" className="w-full">
                  <TabsList className="w-full grid grid-cols-3">
                    <TabsTrigger value="timeline">거래 이력</TabsTrigger>
                    <TabsTrigger value="notes">상담일지</TabsTrigger>
                    <TabsTrigger value="stats">매출 통계</TabsTrigger>
                  </TabsList>
                  <TabsContent value="timeline" className="mt-4">
                    <RecipientTimeline
                      recipientId={selectedRecipient?.id || null}
                      recipientIds={selectedCompanyGroup.contacts.map(contact => contact.id)}
                      companyName={selectedCompanyGroup.companyName}
                      contactPerson={selectedRecipient?.contact_person || null}
                    />
                  </TabsContent>
                  <TabsContent value="notes" className="mt-4">
                    {selectedRecipient ? (
                      <RecipientNotesPanel recipientId={selectedRecipient.id} />
                    ) : (
                      <Card>
                        <CardContent className="p-8 text-center text-sm text-muted-foreground">
                          상담일지는 담당자별로 관리합니다. 담당자를 선택해 주세요.
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>
                  <TabsContent value="stats" className="mt-4">
                    <RecipientSalesStats companyName={selectedCompanyGroup.companyName} recipientIds={selectedCompanyGroup.contacts.map(contact => contact.id)} />
                  </TabsContent>
                </Tabs>
              </>
            ) : unregisteredCompany ? (
              <>
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Building2 className="w-5 h-5" />
                        {unregisteredCompany.company}
                        <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">미등록</Badge>
                      </CardTitle>
                      <Button size="sm" onClick={handleRegisterRecipient}>
                        <Upload className="w-4 h-4 mr-1" />
                        고객사 등록
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <InfoRow label="담당자" value={unregisteredCompany.name} />
                      <InfoRow label="연락처" value={unregisteredCompany.phone} />
                      <InfoRow label="이메일" value={unregisteredCompany.email} />
                      <InfoRow label="주소" value={unregisteredCompany.address} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-4">
                      * 견적서에 저장된 정보입니다. 고객사로 등록하면 상세 관리가 가능합니다.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      견적 히스토리
                      <Badge variant="secondary" className="ml-2">{unregisteredQuoteHistory.length}건</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {historyLoading ? (
                      <div className="p-8 text-center text-muted-foreground">로딩 중...</div>
                    ) : unregisteredQuoteHistory.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground">견적 내역이 없습니다.</div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>견적번호</TableHead>
                            <TableHead>프로젝트명</TableHead>
                            <TableHead>견적일</TableHead>
                            <TableHead>단계</TableHead>
                            <TableHead className="text-right">금액</TableHead>
                            <TableHead className="w-10"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {unregisteredQuoteHistory.map((q) => {
                            const stageInfo = getStageInfo(q.project_stage);
                            return (
                              <TableRow key={q.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/saved-quotes/${q.id}`)}>
                                <TableCell className="font-medium">{q.quote_number}</TableCell>
                                <TableCell className="truncate max-w-[200px]">{q.project_name || '-'}</TableCell>
                                <TableCell>{new Date(q.quote_date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' })}</TableCell>
                                <TableCell><Badge variant="outline" className={`text-xs ${stageInfo.color}`}>{stageInfo.label}</Badge></TableCell>
                                <TableCell className="text-right font-semibold">{formatPrice(q.total)}</TableCell>
                                <TableCell><Eye className="w-4 h-4 text-muted-foreground" /></TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <Building2 className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground">
                    왼쪽 목록에서 고객사를 선택하면<br />
                    상세 정보와 견적 히스토리를 확인할 수 있습니다.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Edit Dialog */}
      <RecipientEditDialog
        recipient={editRecipient}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSave={async (id, updates) => {
          const oldRecipient = recipients.find(r => r.id === id);
          const result = await updateRecipient(id, updates);
          if (result && oldRecipient) {
            try {
              const quoteUpdates: Record<string, any> = {};
              if (updates.company_name) quoteUpdates.recipient_company = updates.company_name;
              if (updates.contact_person) quoteUpdates.recipient_name = updates.contact_person;
              if (updates.phone) quoteUpdates.recipient_phone = updates.phone;
              if (updates.email) quoteUpdates.recipient_email = updates.email;
              if (updates.address !== undefined) quoteUpdates.recipient_address = updates.address || null;

              if (Object.keys(quoteUpdates).length > 0) {
                const { error: linkedQuoteError } = await supabase
                  .from('saved_quotes')
                  .update(quoteUpdates)
                  .eq('recipient_id', id);

                const { error: fallbackQuoteError } = await supabase
                  .from('saved_quotes')
                  .update(quoteUpdates)
                  .eq('recipient_company', oldRecipient.company_name)
                  .eq('recipient_name', oldRecipient.contact_person);

                if (linkedQuoteError || fallbackQuoteError) {
                  console.error('견적서 수신자 정보 동기화 에러:', linkedQuoteError || fallbackQuoteError);
                  toast.error('고객사 정보는 수정되었지만, 일부 견적서 동기화에 실패했습니다.');
                } else {
                  toast.success('관련 견적서의 수신자 정보도 함께 업데이트되었습니다.');
                }
              }
            } catch (err) {
              console.error('견적서 동기화 에러:', err);
            }

            await fetchRecipients();
            if (selectedRecipientId === id) {
              setSelectedCompanyKey(normalizeCompanyKey(updates.company_name || oldRecipient.company_name));
            }
          }
          return result;
        }}
      />
    </div>
  );
};

// Helper component
const InfoRow = ({ label, value }: { label: string; value: string | null | undefined }) => (
  <div className="flex items-start gap-2">
    <span className="text-muted-foreground shrink-0 w-24">{label}:</span>
    <span className="font-medium">{value || '-'}</span>
  </div>
);

export default RecipientManagementPage;
