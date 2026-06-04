import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  ApprovalRequestRecord,
  cancelApprovalRequest,
  createApprovalRequest,
  getApprovalStatusClass,
  getApprovalStatusLabel,
  getApprovalTypeLabel,
  listProjectApprovalRequests,
  reviewApprovalRequest,
} from '@/services/approvalRequests';
import { CheckCircle2, ClipboardCheck, FileText, Package, Receipt, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface LinkedQuote {
  id: string;
  quote_number: string;
  project_name: string | null;
  total: number | null;
  quote_date: string | null;
  desired_delivery_date: string | null;
  project_stage: string | null;
  items?: unknown;
}

interface ProjectApprovalPanelProps {
  projectId: string;
  projectName: string;
  linkedQuotes: LinkedQuote[];
}

const formatCurrency = (value: number | null | undefined) => `₩${Math.round(Number(value || 0)).toLocaleString()}`;

const getDateText = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return format(date, 'yyyy.MM.dd', { locale: ko });
};

const ProjectApprovalPanel: React.FC<ProjectApprovalPanelProps> = ({ projectId, projectName, linkedQuotes }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, isModerator } = useAuth();
  const canReview = isAdmin || isModerator;
  const primaryQuote = linkedQuotes[0];

  const { data: approvals = [], isLoading } = useQuery({
    queryKey: ['project-approval-requests', projectId],
    queryFn: () => listProjectApprovalRequests(projectId),
  });

  const { data: materialOrders = [] } = useQuery({
    queryKey: ['project-material-orders-for-approval', projectId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('material_orders')
        .select('id, material, quality, thickness, size_name, quantity, status, order_date, quote_item_summary')
        .eq('project_id', projectId)
        .order('order_date', { ascending: false })
        .limit(8);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: internalDocuments = [] } = useQuery({
    queryKey: ['project-internal-docs-for-approval', projectId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('internal_project_documents')
        .select('id, document_type, file_name, vendor_name, total, purchase_date, is_paid')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(8);
      if (error) throw error;
      return data || [];
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['project-approval-requests', projectId] });
    queryClient.invalidateQueries({ queryKey: ['today-work-pending-approval-requests'] });
  };

  const createApproval = useMutation({
    mutationFn: createApprovalRequest,
    onSuccess: () => {
      invalidate();
      toast.success('품의 요청이 생성되었습니다.');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '품의 요청 생성에 실패했습니다.');
    },
  });

  const reviewApproval = useMutation({
    mutationFn: ({ id, decision, note }: { id: string; decision: 'approved' | 'rejected'; note?: string }) => (
      reviewApprovalRequest(id, decision, note)
    ),
    onSuccess: () => {
      invalidate();
      toast.success('품의 검토가 완료되었습니다.');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '품의 검토에 실패했습니다.');
    },
  });

  const cancelApproval = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => cancelApprovalRequest(id, note),
    onSuccess: () => {
      invalidate();
      toast.success('품의 요청이 취소되었습니다.');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : '품의 취소에 실패했습니다.');
    },
  });

  const hasActiveProjectStartApproval = approvals.some((approval) => (
    approval.request_type === 'project_start'
    && ['draft', 'pending', 'approved'].includes(approval.status)
  ));

  const handleCreateProjectStart = () => {
    createApproval.mutate({
      requestType: 'project_start',
      title: `프로젝트 개시 품의 · ${projectName}`,
      summary: primaryQuote
        ? `${primaryQuote.quote_number} 견적 기준 프로젝트 개시 승인 요청`
        : '프로젝트 개시 승인 요청',
      amount: primaryQuote ? Number(primaryQuote.total || 0) : null,
      relatedProjectId: projectId,
      relatedQuoteId: primaryQuote?.id || null,
      payloadSnapshot: {
        projectName,
        quotes: linkedQuotes.map((quote) => ({
          id: quote.id,
          quoteNumber: quote.quote_number,
          total: quote.total,
          desiredDeliveryDate: quote.desired_delivery_date,
          itemCount: Array.isArray(quote.items) ? quote.items.length : undefined,
        })),
      },
    });
  };

  const handleCreateMaterialApproval = (order: any) => {
    createApproval.mutate({
      requestType: 'purchase_request',
      title: `구매 품의 · ${order.material || '원판 발주'}`,
      summary: [order.quality, order.thickness, order.size_name, `${order.quantity || 1}장`].filter(Boolean).join(' · '),
      relatedProjectId: projectId,
      relatedMaterialOrderId: order.id,
      payloadSnapshot: { projectName, materialOrder: order },
    });
  };

  const handleCreateExpenseApproval = (document: any) => {
    createApproval.mutate({
      requestType: document.document_type === 'quote' ? 'purchase_request' : 'expense_payment',
      title: `${document.document_type === 'quote' ? '구매' : '지출'} 품의 · ${document.vendor_name || document.file_name}`,
      summary: document.file_name,
      amount: Number(document.total || 0),
      relatedProjectId: projectId,
      relatedInternalDocumentId: document.id,
      payloadSnapshot: { projectName, internalDocument: document },
    });
  };

  const handleReview = (approval: ApprovalRequestRecord, decision: 'approved' | 'rejected') => {
    const note = decision === 'rejected'
      ? window.prompt('반려 사유를 입력하세요.') || ''
      : window.prompt('검토 메모를 입력하세요. (선택)') || '';
    if (decision === 'rejected' && note.trim().length < 2) {
      toast.error('반려 사유를 입력해주세요.');
      return;
    }
    reviewApproval.mutate({ id: approval.id, decision, note });
  };

  const handleCancel = (approval: ApprovalRequestRecord) => {
    if (!confirm('이 품의 요청을 취소하시겠습니까?')) return;
    cancelApproval.mutate({ id: approval.id, note: '프로젝트 상세에서 취소' });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">연결 견적</p>
          <p className="mt-2 text-lg font-bold">{linkedQuotes.length}</p>
          <p className="text-xs text-muted-foreground">총 {formatCurrency(linkedQuotes.reduce((sum, quote) => sum + Number(quote.total || 0), 0))}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">승인 대기</p>
          <p className="mt-2 text-lg font-bold">{approvals.filter((approval) => approval.status === 'pending').length}</p>
          <p className="text-xs text-muted-foreground">프로젝트 관련 품의</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">승인 완료</p>
          <p className="mt-2 text-lg font-bold">{approvals.filter((approval) => approval.status === 'approved').length}</p>
          <p className="text-xs text-muted-foreground">비용/개시 승인</p>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold">원본 견적</h3>
            <p className="text-xs text-muted-foreground">수주 전환 기준 견적과 금액을 확인합니다.</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 text-xs"
            disabled={!primaryQuote || hasActiveProjectStartApproval || createApproval.isPending}
            onClick={handleCreateProjectStart}
          >
            <ClipboardCheck className="h-3.5 w-3.5" />
            개시 품의
          </Button>
        </div>
        <div className="divide-y">
          {linkedQuotes.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground">연결된 견적서가 없습니다.</p>
          ) : linkedQuotes.map((quote) => (
            <div key={quote.id} className="flex items-center gap-3 px-4 py-3">
              <FileText className="h-4 w-4 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{quote.quote_number} · {quote.project_name || projectName}</p>
                <p className="text-xs text-muted-foreground">
                  견적일 {getDateText(quote.quote_date)} · 납기 예정 {getDateText(quote.desired_delivery_date)}
                </p>
              </div>
              <p className="text-sm font-semibold tabular-nums">{formatCurrency(quote.total)}</p>
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => navigate(`/saved-quotes/${quote.id}`)}>
                보기
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-semibold">품의 현황</h3>
          <p className="text-xs text-muted-foreground">개시, 구매, 지출 품의의 승인 상태와 검토 이력을 확인합니다.</p>
        </div>
        <div className="divide-y">
          {isLoading ? (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground">품의 내역을 불러오는 중입니다.</p>
          ) : approvals.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground">등록된 품의가 없습니다.</p>
          ) : approvals.map((approval) => (
            <div key={approval.id} className="flex items-center gap-3 px-4 py-3">
              <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{approval.title}</p>
                  <Badge variant="secondary" className="rounded-full text-[10px]">
                    {getApprovalTypeLabel(approval.request_type)}
                  </Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  요청 {approval.requested_by_name || '-'} · {getDateText(approval.created_at)}
                  {approval.amount != null ? ` · ${formatCurrency(approval.amount)}` : ''}
                </p>
              </div>
              <Badge variant="secondary" className={`rounded-full border text-[10px] ${getApprovalStatusClass(approval.status)}`}>
                {getApprovalStatusLabel(approval.status)}
              </Badge>
              {canReview && approval.status === 'pending' && (
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => handleReview(approval, 'approved')}>
                    <CheckCircle2 className="h-3 w-3" /> 승인
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 gap-1 text-xs text-red-600" onClick={() => handleReview(approval, 'rejected')}>
                    <XCircle className="h-3 w-3" /> 반려
                  </Button>
                </div>
              )}
              {!canReview && ['draft', 'pending'].includes(approval.status) && (
                <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => handleCancel(approval)}>
                  취소
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Package className="h-4 w-4" /> 원판 발주 품의</h3>
            <p className="text-xs text-muted-foreground">연결된 원판 발주를 구매 품의로 올립니다.</p>
          </div>
          <div className="max-h-[260px] divide-y overflow-y-auto">
            {materialOrders.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-muted-foreground">연결된 원판 발주가 없습니다.</p>
            ) : materialOrders.map((order: any) => (
              <div key={order.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{order.material} · {order.size_name}</p>
                  <p className="text-xs text-muted-foreground">{order.quality} · {order.thickness} · {order.quantity || 1}장</p>
                </div>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => handleCreateMaterialApproval(order)}>
                  품의
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Receipt className="h-4 w-4" /> 매입/영수증 품의</h3>
            <p className="text-xs text-muted-foreground">OCR 문서를 구매 또는 지출 품의로 올립니다.</p>
          </div>
          <div className="max-h-[260px] divide-y overflow-y-auto">
            {internalDocuments.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-muted-foreground">등록된 매입 문서가 없습니다.</p>
            ) : internalDocuments.map((document: any) => (
              <div key={document.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{document.vendor_name || document.file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {document.document_type === 'quote' ? '매입 견적서' : '영수증'} · {formatCurrency(document.total)}
                  </p>
                </div>
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => handleCreateExpenseApproval(document)}>
                  품의
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectApprovalPanel;
