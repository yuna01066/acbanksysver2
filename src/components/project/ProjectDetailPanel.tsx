import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, FileText, Link2, Unlink, Trash2, ExternalLink, Plus, Phone, Mail, User, Briefcase, Home, Link as LinkIcon, Package } from 'lucide-react';
import ProjectMaterialOrders from './ProjectMaterialOrders';
import LinkMaterialOrderDialog from './LinkMaterialOrderDialog';
import ProjectStageSelect from '@/components/ProjectStageSelect';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import LinkRecipientDialog from './LinkRecipientDialog';
import LinkQuoteDialog from './LinkQuoteDialog';
import QuotePreviewSheet from './QuotePreviewSheet';
import ProjectAssignments from './ProjectAssignments';
import ProjectSpecsCard from './ProjectSpecsCard';
import ProjectUpdatesFeed from './ProjectUpdatesFeed';
import PaymentStatusSelect from './PaymentStatusSelect';
import RecipientDetailSheet from './RecipientDetailSheet';
import LinkContactDialog, { ContactInfo } from './LinkContactDialog';
import InternalDocumentUploadCard from './InternalDocumentUploadCard';
import InternalProjectItemsCard from './InternalProjectItemsCard';

interface Props {
  projectId: string;
  onDeleted: () => void;
}

const stageLabels: Record<string, string> = {
  quote_issued: '견적 발행',
  invoice_issued: '계산서 발행',
  in_progress: '진행중',
  panel_ordered: '원판발주',
  manufacturing: '제작중',
  completed: '제작완료',
  cancelled: '취소',
};

const stageColors: Record<string, string> = {
  quote_issued: 'bg-blue-50 text-blue-700 border-blue-200',
  invoice_issued: 'bg-purple-50 text-purple-700 border-purple-200',
  in_progress: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  panel_ordered: 'bg-orange-50 text-orange-700 border-orange-200',
  manufacturing: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-red-50 text-red-600 border-red-200',
};

const SectionLabel = ({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) => (
  <div className="flex items-center justify-between mb-2">
    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{children}</span>
    {action}
  </div>
);

const InfoRow = ({ label, children, action }: { label: string; children: React.ReactNode; action?: React.ReactNode }) => (
  <div className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-b-0">
    <span className="text-xs text-muted-foreground">{label}</span>
    <div className="flex items-center gap-1.5">
      <div className="text-xs font-medium text-right">{children}</div>
      {action}
    </div>
  </div>
);

const LinkedClientProjectCard = ({ linkedProjectId }: { linkedProjectId: string }) => {
  const { data: linkedProject } = useQuery({
    queryKey: ['linked-project', linkedProjectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, status, payment_status')
        .eq('id', linkedProjectId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  if (!linkedProject) return null;

  const statusLabels: Record<string, string> = { pending: '진행 예정', active: '진행중', completed: '완료', cancelled: '취소' };

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/[0.03] p-3">
      <div className="flex items-center gap-2 text-xs">
        <Briefcase className="h-3.5 w-3.5 text-primary" />
        <span className="font-medium text-muted-foreground">연결된 클라이언트 프로젝트 (매출)</span>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <span className="text-sm font-semibold">{linkedProject.name}</span>
        <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
          {statusLabels[linkedProject.status] || linkedProject.status}
        </Badge>
      </div>
    </div>
  );
};

const ProjectDetailPanel: React.FC<Props> = ({ projectId, onDeleted }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [recipientDialogOpen, setRecipientDialogOpen] = useState(false);
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [materialOrderDialogOpen, setMaterialOrderDialogOpen] = useState(false);
  const [previewQuoteId, setPreviewQuoteId] = useState<string | null>(null);
  const [recipientSheetOpen, setRecipientSheetOpen] = useState(false);

  const { data: project, isLoading } = useQuery({
    queryKey: ['project-detail', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*, recipients(id, company_name, contact_person, phone, email, accounting_contact_person, accounting_phone, accounting_email)')
        .eq('id', projectId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: linkedQuotes = [] } = useQuery({
    queryKey: ['project-quotes', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saved_quotes')
        .select('id, quote_number, project_name, total, quote_date, project_stage, items, desired_delivery_date, recipient_address, recipient_memo, user_id')
        .eq('project_id', projectId)
        .order('quote_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from('projects').update({ status }).eq('id', projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-detail', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('상태가 변경되었습니다.');
    },
  });

  const linkRecipient = useMutation({
    mutationFn: async (recipientId: string | null) => {
      const { error } = await supabase.from('projects').update({ recipient_id: recipientId }).eq('id', projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-detail', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setRecipientDialogOpen(false);
      toast.success(project?.recipient_id ? '고객사 연결이 해제되었습니다.' : '고객사가 연결되었습니다.');
    },
  });

  const unlinkQuote = useMutation({
    mutationFn: async (quoteId: string) => {
      const { error } = await supabase.from('saved_quotes').update({ project_id: null }).eq('id', quoteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-quotes', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-quote-summary'] });
      toast.success('견적서 연결이 해제되었습니다.');
    },
  });

  const deleteProject = useMutation({
    mutationFn: async () => {
      await supabase.from('saved_quotes').update({ project_id: null }).eq('project_id', projectId);
      const { error } = await supabase.from('projects').delete().eq('id', projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      onDeleted();
      toast.success('프로젝트가 삭제되었습니다.');
    },
  });

  const updateContact = useMutation({
    mutationFn: async (contact: ContactInfo | null) => {
      const update = contact
        ? { contact_name: contact.name, contact_phone: contact.phone, contact_email: contact.email }
        : { contact_name: null, contact_phone: null, contact_email: null };
      const { error } = await supabase.from('projects').update(update as any).eq('id', projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-detail', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setContactDialogOpen(false);
      toast.success('담당자 정보가 업데이트되었습니다.');
    },
  });

  const totalQuoteAmount = linkedQuotes.reduce((sum: number, q: any) => sum + Number(q.total || 0), 0);

  // Internal project document summaries
  const isInternal = (project as any)?.project_type === 'internal';

  const { data: internalDocsSummary } = useQuery({
    queryKey: ['internal-docs-summary', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('internal_project_documents')
        .select('document_type, total, is_paid')
        .eq('project_id', projectId);
      if (error) throw error;
      const quotes = data.filter((d: any) => d.document_type === 'quote');
      const receipts = data.filter((d: any) => d.document_type === 'receipt');
      return {
        quoteTotal: quotes.reduce((s: number, d: any) => s + Number(d.total || 0), 0),
        paidQuoteTotal: quotes.filter((d: any) => d.is_paid).reduce((s: number, d: any) => s + Number(d.total || 0), 0),
        receiptTotal: receipts.reduce((s: number, d: any) => s + Number(d.total || 0), 0),
      };
    },
    enabled: isInternal,
  });

  if (isLoading || !project) {
    return (
      <div className="space-y-3">
        <div className="h-8 bg-muted/50 rounded-lg animate-pulse w-2/3" />
        <div className="h-64 bg-muted/50 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold tracking-tight">{project.name}</h2>
            <Badge variant="outline" className="text-[10px] gap-1 font-normal">
              {(project as any).project_type === 'internal' ? (
                <><Home className="h-2.5 w-2.5" /> 내부 (매입)</>
              ) : (
                <><Briefcase className="h-2.5 w-2.5" /> 클라이언트 (매출)</>
              )}
            </Badge>
          </div>
          {project.description && (
            <p className="text-xs text-muted-foreground mt-0.5">{project.description}</p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
          onClick={() => {
            if (confirm('이 프로젝트를 삭제하시겠습니까?')) deleteProject.mutate();
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-4">
          {/* Left: Specs / Internal Items / Notion / Updates */}
        <div className="flex-1 min-w-0 space-y-4">
          {!isInternal && (
            <ProjectSpecsCard projectId={projectId} specs={project.specs as any} linkedQuotes={linkedQuotes} />
          )}

          {/* 내부 프로젝트: 견적 항목 카드 */}
          {isInternal && (
            <InternalProjectItemsCard projectId={projectId} />
          )}

          {/* 노션 임베드 (내부 프로젝트) */}
          {isInternal && (project as any).notion_url && (
            <div className="rounded-lg border bg-card">
              <div className="flex items-center justify-between px-4 py-2.5 border-b">
                <span className="text-xs font-medium flex items-center gap-1.5">
                  <LinkIcon className="h-3 w-3" /> 노션
                </span>
                <a
                  href={(project as any).notion_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                >
                  새 탭에서 열기 <ExternalLink className="h-2.5 w-2.5" />
                </a>
              </div>
              <div className="bg-white rounded-b-lg overflow-hidden">
                <iframe
                  src={(project as any).notion_url.replace('notion.so', 'notion.site')}
                  className="w-full h-[500px] border-0"
                  allowFullScreen
                />
              </div>
            </div>
          )}

          {/* 연결된 클라이언트 프로젝트 */}
          {isInternal && (project as any).linked_project_id && (
            <LinkedClientProjectCard linkedProjectId={(project as any).linked_project_id} />
          )}

          <ProjectUpdatesFeed projectId={projectId} />
        </div>

        {/* Right: Info sidebar */}
        <div className="w-[260px] shrink-0 space-y-3">
          {/* Status card */}
          <div className="rounded-lg border bg-card p-3.5 space-y-0">
            <InfoRow label="단계">
              <Select value={project.status} onValueChange={(v) => updateStatus.mutate(v)}>
                <SelectTrigger className="w-[90px] h-6 text-[11px] border-0 bg-transparent p-0 justify-end gap-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">진행 예정</SelectItem>
                  <SelectItem value="active">진행중</SelectItem>
                  <SelectItem value="completed">완료</SelectItem>
                  <SelectItem value="cancelled">취소</SelectItem>
                </SelectContent>
              </Select>
            </InfoRow>

            {/* 입금 상태 - 클라이언트 프로젝트만 */}
            {!isInternal && (
              <InfoRow label="입금 상태">
                <PaymentStatusSelect projectId={projectId} currentStatus={(project as any).payment_status || 'unpaid'} />
              </InfoRow>
            )}

            {/* 예상 견적 */}
            {!isInternal && (
              <InfoRow label="예상 견적">
                {totalQuoteAmount > 0 ? (
                  <span className="font-bold text-[11px]">₩{Math.round(totalQuoteAmount).toLocaleString()}</span>
                ) : (
                  <span className="text-[11px] text-muted-foreground">없음</span>
                )}
              </InfoRow>
            )}

            {/* 내부 프로젝트: 예상 견적 (매입 견적서 합계) */}
            {isInternal && (
              <InfoRow label="예상 견적">
                {(internalDocsSummary?.quoteTotal || 0) > 0 ? (
                  <span className="font-bold text-[11px]">₩{Math.round(internalDocsSummary?.quoteTotal || 0).toLocaleString()}</span>
                ) : (
                  <span className="text-[11px] text-muted-foreground">없음</span>
                )}
              </InfoRow>
            )}

            {/* 내부 프로젝트: 비용 처리 */}
            {isInternal && (
              <InfoRow label="비용 처리">
                {(() => {
                  const receiptTotal = internalDocsSummary?.receiptTotal || 0;
                  const paidQuoteTotal = internalDocsSummary?.paidQuoteTotal || 0;
                  const costTotal = receiptTotal + paidQuoteTotal;
                  return costTotal > 0 ? (
                    <span className="font-bold text-[11px] text-amber-600">₩{Math.round(costTotal).toLocaleString()}</span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">없음</span>
                  );
                })()}
              </InfoRow>
            )}

            <InfoRow label="생성일">
              <span className="text-[11px] tabular-nums">{format(new Date(project.created_at), 'yy.MM.dd', { locale: ko })}</span>
            </InfoRow>
          </div>

          {/* Employees */}
          <div className="rounded-lg border bg-card p-3.5">
            <SectionLabel>담당 직원</SectionLabel>
            <ProjectAssignments projectId={projectId} />
          </div>

          {/* Client */}
          <div className="rounded-lg border bg-card p-3.5">
            <SectionLabel
              action={
                project.recipient_id ? (
                  <Button variant="ghost" size="sm" className="h-5 text-[10px] gap-0.5 text-destructive px-1 -mr-1" onClick={() => linkRecipient.mutate(null)}>
                    <Unlink className="h-2.5 w-2.5" /> 해제
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" className="h-5 text-[10px] gap-0.5 px-1 -mr-1" onClick={() => setRecipientDialogOpen(true)}>
                    <Link2 className="h-2.5 w-2.5" /> 연결
                  </Button>
                )
              }
            >
              고객사
            </SectionLabel>
            {project.recipients ? (
              <div className="space-y-1.5">
                <button
                  className="flex items-center gap-1.5 text-xs font-medium hover:text-primary transition-colors text-left"
                  onClick={() => setRecipientSheetOpen(true)}
                >
                  <Building2 className="h-3 w-3 text-muted-foreground" />
                  <span className="underline underline-offset-2">{project.recipients.company_name}</span>
                </button>
                <div className="pt-1 border-t border-border/40">
                  <p className="text-[9px] text-muted-foreground/70 mb-1">회계 담당자</p>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <User className="h-2.5 w-2.5" /> {(project.recipients as any).accounting_contact_person || '-'}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Phone className="h-2.5 w-2.5" /> {(project.recipients as any).accounting_phone || '-'}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Mail className="h-2.5 w-2.5" /> {(project.recipients as any).accounting_email || '-'}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground">연결된 고객사가 없습니다.</p>
            )}
          </div>

          {/* Contact */}
          <div className="rounded-lg border bg-card p-3.5">
            <SectionLabel
              action={
                (project as any).contact_name ? (
                  <Button variant="ghost" size="sm" className="h-5 text-[10px] gap-0.5 text-destructive px-1 -mr-1" onClick={() => updateContact.mutate(null)}>
                    <Unlink className="h-2.5 w-2.5" /> 해제
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" className="h-5 text-[10px] gap-0.5 px-1 -mr-1" onClick={() => setContactDialogOpen(true)}>
                    <Link2 className="h-2.5 w-2.5" /> 연결
                  </Button>
                )
              }
            >
              담당자
            </SectionLabel>
            {(project as any).contact_name ? (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-medium">
                  <User className="h-3 w-3 text-muted-foreground" />
                  {(project as any).contact_name}
                </div>
                {(project as any).contact_phone && (
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Phone className="h-2.5 w-2.5" /> {(project as any).contact_phone}
                  </div>
                )}
                {(project as any).contact_email && (
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Mail className="h-2.5 w-2.5" /> {(project as any).contact_email}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground">연결된 담당자가 없습니다.</p>
            )}
          </div>

          {/* Internal project: Upload cards */}
          {isInternal && (
            <>
              <InternalDocumentUploadCard projectId={projectId} projectName={project.name} documentType="quote" title="매입 견적서" />
              <InternalDocumentUploadCard projectId={projectId} projectName={project.name} documentType="receipt" title="영수증" />
            </>
          )}

          {/* Quotes - 클라이언트 프로젝트만 */}
          {!isInternal && (
            <div className="rounded-lg border bg-card p-3.5">
              <SectionLabel
                action={
                  <Button variant="ghost" size="sm" className="h-5 text-[10px] gap-0.5 px-1 -mr-1" onClick={() => setQuoteDialogOpen(true)}>
                    <Plus className="h-2.5 w-2.5" /> 연결
                  </Button>
                }
              >
                견적서 ({linkedQuotes.length})
              </SectionLabel>
              {linkedQuotes.length === 0 ? (
                <div className="flex flex-col items-center gap-1.5 py-2">
                  <p className="text-[10px] text-muted-foreground">없음</p>
                  <Button variant="outline" size="sm" className="text-[10px] gap-1 h-6" onClick={() => navigate('/calculator')}>
                    <FileText className="h-2.5 w-2.5" /> 새 견적서
                  </Button>
                </div>
              ) : (
                <div className="space-y-1 max-h-[180px] overflow-y-auto">
                  {linkedQuotes.map((q: any) => (
                    <div key={q.id} className="flex items-center justify-between p-2 bg-muted/30 rounded-md text-[11px] group">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[10px] text-muted-foreground">{q.quote_number}</span>
                          <Badge variant="secondary" className={`text-[8px] px-1 py-0 h-[14px] border ${stageColors[q.project_stage] || ''}`}>
                            {stageLabels[q.project_stage] || q.project_stage}
                          </Badge>
                        </div>
                        {q.project_name && <p className="text-[10px] mt-0.5 truncate font-medium">{q.project_name}</p>}
                        <p className="text-[10px] truncate text-muted-foreground">₩{q.total?.toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setPreviewQuoteId(q.id)}>
                          <ExternalLink className="h-2.5 w-2.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => unlinkQuote.mutate(q.id)}>
                          <Unlink className="h-2.5 w-2.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Material Orders */}
          <div className="rounded-lg border bg-card p-3.5">
            <SectionLabel
              action={
                <Button variant="ghost" size="sm" className="h-5 text-[10px] gap-0.5 px-1 -mr-1" onClick={() => setMaterialOrderDialogOpen(true)}>
                  <Plus className="h-2.5 w-2.5" /> 연결
                </Button>
              }
            >
              원판 발주
            </SectionLabel>
            <ProjectMaterialOrders projectId={projectId} />
          </div>
        </div>
      </div>

      {/* Dialogs & Sheets */}
      <LinkRecipientDialog open={recipientDialogOpen} onOpenChange={setRecipientDialogOpen} onSelect={(id) => linkRecipient.mutate(id)} />
      <LinkQuoteDialog open={quoteDialogOpen} onOpenChange={setQuoteDialogOpen} projectId={projectId} />
      <LinkMaterialOrderDialog open={materialOrderDialogOpen} onOpenChange={setMaterialOrderDialogOpen} projectId={projectId} />
      <QuotePreviewSheet quoteId={previewQuoteId} open={!!previewQuoteId} onOpenChange={(open) => !open && setPreviewQuoteId(null)} />
      <RecipientDetailSheet recipientId={project.recipient_id} open={recipientSheetOpen} onOpenChange={setRecipientSheetOpen} />
      <LinkContactDialog
        open={contactDialogOpen}
        onOpenChange={setContactDialogOpen}
        onSelect={(contact) => updateContact.mutate(contact)}
        recipientCompany={project.recipients?.company_name}
      />
    </div>
  );
};

export default ProjectDetailPanel;
