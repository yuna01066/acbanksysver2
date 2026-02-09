import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, FileText, Link2, Unlink, Trash2, ExternalLink, Plus, Users, Phone, Mail, User } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import LinkRecipientDialog from './LinkRecipientDialog';
import LinkQuoteDialog from './LinkQuoteDialog';
import QuotePreviewSheet from './QuotePreviewSheet';
import ProjectAssignments from './ProjectAssignments';

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
  quote_issued: 'bg-blue-100 text-blue-700',
  invoice_issued: 'bg-purple-100 text-purple-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  panel_ordered: 'bg-orange-100 text-orange-700',
  manufacturing: 'bg-cyan-100 text-cyan-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const statusLabels: Record<string, string> = {
  active: '진행중',
  completed: '완료',
  cancelled: '취소',
};

const InfoRow = ({ label, children, action }: { label: string; children: React.ReactNode; action?: React.ReactNode }) => (
  <div className="flex items-center justify-between py-3 border-b last:border-b-0">
    <span className="text-sm text-muted-foreground">{label}</span>
    <div className="flex items-center gap-2">
      <div className="text-sm font-medium text-right">{children}</div>
      {action}
    </div>
  </div>
);

const ProjectDetailPanel: React.FC<Props> = ({ projectId, onDeleted }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [recipientDialogOpen, setRecipientDialogOpen] = useState(false);
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [previewQuoteId, setPreviewQuoteId] = useState<string | null>(null);

  const { data: project, isLoading } = useQuery({
    queryKey: ['project-detail', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*, recipients(id, company_name, contact_person, phone, email)')
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
        .select('id, quote_number, project_name, total, quote_date, project_stage')
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

  const totalQuoteAmount = linkedQuotes.reduce((sum: number, q: any) => sum + Number(q.total || 0), 0);

  if (isLoading || !project) {
    return <div className="text-center py-8 text-muted-foreground text-sm">로딩 중...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header with title & actions */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold">{project.name}</h2>
          {project.description && (
            <p className="text-sm text-muted-foreground mt-0.5">{project.description}</p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
          onClick={() => {
            if (confirm('이 프로젝트를 삭제하시겠습니까?')) deleteProject.mutate();
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Single card with all info rows */}
      <Card className="shadow-none">
        <CardContent className="p-5">
          {/* 단계 */}
          <InfoRow label="단계">
            <Select value={project.status} onValueChange={(v) => updateStatus.mutate(v)}>
              <SelectTrigger className="w-[110px] h-7 text-xs border-0 bg-transparent p-0 justify-end gap-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">진행중</SelectItem>
                <SelectItem value="completed">완료</SelectItem>
                <SelectItem value="cancelled">취소</SelectItem>
              </SelectContent>
            </Select>
          </InfoRow>

          {/* 견적 단계 (최근 견적 기준) */}
          {linkedQuotes.length > 0 && (
            <InfoRow label="견적 단계">
              <Badge variant="secondary" className={`text-xs ${stageColors[linkedQuotes[0].project_stage] || ''}`}>
                {stageLabels[linkedQuotes[0].project_stage] || linkedQuotes[0].project_stage}
              </Badge>
            </InfoRow>
          )}

          {/* 담당 직원 */}
          <div className="py-3 border-b">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">담당 직원</span>
            </div>
            <ProjectAssignments projectId={projectId} />
          </div>

          {/* 예상 견적 */}
          <InfoRow label="예상 견적">
            {totalQuoteAmount > 0 ? (
              <span className="font-bold">₩ {Math.round(totalQuoteAmount).toLocaleString()}</span>
            ) : (
              <span className="text-xs text-muted-foreground">없음</span>
            )}
          </InfoRow>

          {/* 생성일 */}
          <InfoRow label="생성일">
            {format(new Date(project.created_at), 'yyyy년 M월 d일', { locale: ko })}
          </InfoRow>

          {/* 고객사 */}
          <div className="py-3 border-b">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">고객사</span>
              {project.recipient_id ? (
                <Button variant="ghost" size="sm" className="h-6 text-[11px] gap-1 text-destructive px-2" onClick={() => linkRecipient.mutate(null)}>
                  <Unlink className="h-3 w-3" /> 해제
                </Button>
              ) : (
                <Button variant="ghost" size="sm" className="h-6 text-[11px] gap-1 px-2" onClick={() => setRecipientDialogOpen(true)}>
                  <Link2 className="h-3 w-3" /> 연결
                </Button>
              )}
            </div>
            {project.recipients ? (
              <div className="space-y-1 pl-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  {project.recipients.company_name}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <User className="h-3 w-3" /> {project.recipients.contact_person}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Phone className="h-3 w-3" /> {project.recipients.phone}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Mail className="h-3 w-3" /> {project.recipients.email}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground pl-1">연결된 고객사가 없습니다.</p>
            )}
          </div>

          {/* 연결된 견적서 */}
          <div className="pt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">연결된 견적서 ({linkedQuotes.length})</span>
              <Button variant="ghost" size="sm" className="h-6 text-[11px] gap-1 px-2" onClick={() => setQuoteDialogOpen(true)}>
                <Plus className="h-3 w-3" /> 연결
              </Button>
            </div>
            {linkedQuotes.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-3">
                <p className="text-xs text-muted-foreground">연결된 견적서가 없습니다.</p>
                <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => navigate('/calculator')}>
                  <FileText className="h-3 w-3" /> 새 견적서 발행하기
                </Button>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[250px] overflow-y-auto">
                {linkedQuotes.map((q: any) => (
                  <div key={q.id} className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg text-sm group">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{q.quote_number}</span>
                        <Badge variant="secondary" className={`text-[10px] ${stageColors[q.project_stage] || ''}`}>
                          {stageLabels[q.project_stage] || q.project_stage}
                        </Badge>
                      </div>
                      <p className="text-xs mt-0.5 truncate">
                        {q.project_name || '-'} · ₩{q.total?.toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPreviewQuoteId(q.id)}>
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => unlinkQuote.mutate(q.id)}>
                        <Unlink className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <LinkRecipientDialog open={recipientDialogOpen} onOpenChange={setRecipientDialogOpen} onSelect={(id) => linkRecipient.mutate(id)} />
      <LinkQuoteDialog open={quoteDialogOpen} onOpenChange={setQuoteDialogOpen} projectId={projectId} />
      <QuotePreviewSheet quoteId={previewQuoteId} open={!!previewQuoteId} onOpenChange={(open) => !open && setPreviewQuoteId(null)} />
    </div>
  );
};

export default ProjectDetailPanel;
