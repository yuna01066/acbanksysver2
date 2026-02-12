import { useState, useEffect, useCallback } from 'react';
import CorpStatusCheck from '@/components/CorpStatusCheck';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useRecipients, Recipient } from '@/hooks/useRecipients';
import { RecipientEditDialog } from '@/components/RecipientEditDialog';
import { RecipientDocumentUpload } from '@/components/RecipientDocumentUpload';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Home, Search, Building2, User, FileText, Eye, Pencil, Trash2,
  Loader2, ArrowLeft, Upload,
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
}

const RecipientManagementPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const {
    recipients, loading, fetchRecipients, updateRecipient, deleteRecipient,
  } = useRecipients();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(
    searchParams.get('id')
  );
  const [quoteHistory, setQuoteHistory] = useState<QuoteHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [editRecipient, setEditRecipient] = useState<Recipient | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'date'>('name');

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
    const idParam = searchParams.get('id');
    if (idParam && recipients.length > 0) {
      const found = recipients.find(r => r.id === idParam);
      if (found) {
        setSelectedRecipientId(idParam);
      }
    }
  }, [searchParams, recipients]);

  useEffect(() => {
    if (selectedRecipientId) {
      const recipient = recipients.find(r => r.id === selectedRecipientId);
      if (recipient) fetchQuoteHistory(recipient.company_name, recipient.contact_person);
    }
  }, [selectedRecipientId, recipients]);

  const fetchQuoteHistory = async (companyName: string, contactPerson: string) => {
    if (!user) return;
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from('saved_quotes')
        .select('id, quote_number, quote_date, project_name, total, project_stage')
        .eq('recipient_company', companyName)
        .order('quote_date', { ascending: false });

      if (error) throw error;
      setQuoteHistory(data || []);
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
        setQuoteHistory([]);
      }
      fetchRecipients();
    }
  };

  const filteredRecipients = recipients.filter(r => {
    const s = searchTerm.toLowerCase();
    return (
      r.company_name.toLowerCase().includes(s) ||
      r.contact_person.toLowerCase().includes(s) ||
      r.email.toLowerCase().includes(s) ||
      (r.business_registration_number || '').includes(s)
    );
  }).sort((a, b) => {
    if (sortBy === 'name') {
      return a.company_name.localeCompare(b.company_name, 'ko');
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  useEffect(() => {
    if (companyFilter && !selectedRecipientId && filteredRecipients.length > 0) {
      setSelectedRecipientId(filteredRecipients[0].id);
    }
  }, [companyFilter, filteredRecipients, selectedRecipientId]);

  const [unregisteredCompany, setUnregisteredCompany] = useState<{
    company: string;
    name: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
  } | null>(null);

  useEffect(() => {
    if (companyFilter && !loading && filteredRecipients.length === 0) {
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
  }, [companyFilter, loading, filteredRecipients.length]);

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

  const selectedRecipient = recipients.find(r => r.id === selectedRecipientId) || null;

  if (!user) {
    navigate('/auth');
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              뒤로
            </Button>
            <Button variant="outline" onClick={() => navigate('/')}>
              <Home className="w-4 h-4 mr-2" />
              홈으로
            </Button>
          </div>
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary via-primary-glow to-accent bg-clip-text text-transparent">
              고객사 관리
            </h1>
            <p className="text-muted-foreground">고객사 정보 및 견적 히스토리를 관리합니다</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Recipient List */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  고객사 목록
                </CardTitle>
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="회사명, 담당자, 사업자번호 검색..."
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
                ) : filteredRecipients.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    {searchTerm ? '검색 결과가 없습니다.' : '등록된 고객사가 없습니다.'}
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredRecipients.map((r) => (
                      <div
                        key={r.id}
                        className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                          selectedRecipientId === r.id ? 'bg-primary/5 border-l-4 border-l-primary' : ''
                        }`}
                        onClick={() => setSelectedRecipientId(r.id)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-sm truncate">{r.company_name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <User className="w-3 h-3" />
                          <span>{r.contact_person}</span>
                          {r.position && <span>({r.position})</span>}
                        </div>
                        {r.business_registration_number && r.business_registration_number !== '000-00-00000' && (
                          <div className="text-xs text-muted-foreground mt-1">
                            사업자번호: {r.business_registration_number}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: Detail + Quote History */}
          <div className="lg:col-span-2 space-y-6">
            {selectedRecipient ? (
              <>
                {/* Recipient Detail */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Building2 className="w-5 h-5" />
                        {selectedRecipient.company_name}
                      </CardTitle>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditRecipient(selectedRecipient);
                            setEditDialogOpen(true);
                          }}
                        >
                          <Pencil className="w-4 h-4 mr-1" />
                          수정
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(selectedRecipient.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
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
                  </CardContent>
                </Card>

                {/* Business Document Upload */}
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

                {/* Quote History */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      견적 히스토리
                      <Badge variant="secondary" className="ml-2">{quoteHistory.length}건</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {historyLoading ? (
                      <div className="p-8 text-center text-muted-foreground">로딩 중...</div>
                    ) : quoteHistory.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground">
                        이 고객사의 견적 내역이 없습니다.
                      </div>
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
                          {quoteHistory.map((q) => {
                            const stageInfo = getStageInfo(q.project_stage);
                            return (
                              <TableRow
                                key={q.id}
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => navigate(`/saved-quotes/${q.id}`)}
                              >
                                <TableCell className="font-medium">{q.quote_number}</TableCell>
                                <TableCell className="truncate max-w-[200px]">
                                  {q.project_name || '-'}
                                </TableCell>
                                <TableCell>
                                  {new Date(q.quote_date).toLocaleDateString('ko-KR', {
                                    year: 'numeric', month: 'short', day: 'numeric',
                                  })}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={`text-xs ${stageInfo.color}`}>
                                    {stageInfo.label}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right font-semibold">
                                  {formatPrice(q.total)}
                                </TableCell>
                                <TableCell>
                                  <Eye className="w-4 h-4 text-muted-foreground" />
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
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
                const { error } = await supabase
                  .from('saved_quotes')
                  .update(quoteUpdates)
                  .eq('recipient_company', oldRecipient.company_name)
                  .eq('recipient_name', oldRecipient.contact_person);

                if (error) {
                  console.error('견적서 수신자 정보 동기화 에러:', error);
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
              const newCompany = updates.company_name || oldRecipient.company_name;
              const newContact = updates.contact_person || oldRecipient.contact_person;
              fetchQuoteHistory(newCompany, newContact);
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
