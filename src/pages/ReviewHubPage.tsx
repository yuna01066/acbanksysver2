import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  FolderOpen,
  RefreshCw,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { BrandedCardHeader } from '@/components/ui/branded-card-header';

type LeaveReview = {
  id: string;
  user_name: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days: number;
  created_at: string;
};

type DocumentReview = {
  id: string;
  file_name: string;
  document_type: string;
  sync_status: string;
  sync_error: string | null;
  created_at: string;
};

type QuoteReview = {
  id: string;
  quote_number: string;
  recipient_company: string | null;
  project_name: string | null;
  total: number;
  created_at: string;
};

type ProjectReview = {
  id: string;
  name: string;
  status: string;
  payment_status: string;
  updated_at: string;
};

type ApprovalReview = {
  id: string;
  full_name: string;
  email: string;
  created_at: string | null;
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
};

const formatCurrency = (value: number | null | undefined) => (
  `₩${Math.round(value || 0).toLocaleString()}`
);

const ReviewHubPage = () => {
  const navigate = useNavigate();
  const { isAdmin, isModerator, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [leaves, setLeaves] = useState<LeaveReview[]>([]);
  const [documents, setDocuments] = useState<DocumentReview[]>([]);
  const [quotes, setQuotes] = useState<QuoteReview[]>([]);
  const [projects, setProjects] = useState<ProjectReview[]>([]);
  const [approvals, setApprovals] = useState<ApprovalReview[]>([]);
  const [counts, setCounts] = useState({
    leaves: 0,
    documents: 0,
    quotes: 0,
    projects: 0,
    approvals: 0,
  });

  const loadReviewData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        leaveResult,
        documentResult,
        quoteResult,
        projectResult,
        approvalResult,
      ] = await Promise.all([
        supabase
          .from('leave_requests')
          .select('id, user_name, leave_type, start_date, end_date, days, created_at', { count: 'exact' })
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('document_files' as any)
          .select('id, file_name, document_type, sync_status, sync_error, created_at', { count: 'exact' })
          .in('sync_status', ['pending', 'failed'])
          .order('sync_status', { ascending: true })
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('saved_quotes')
          .select('id, quote_number, recipient_company, project_name, total, created_at', { count: 'exact' })
          .is('project_id', null)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('projects')
          .select('id, name, status, payment_status, updated_at', { count: 'exact' })
          .order('updated_at', { ascending: false })
          .limit(5),
        isAdmin
          ? supabase
              .from('profiles')
              .select('id, full_name, email, created_at', { count: 'exact' })
              .eq('is_approved', false)
              .order('created_at', { ascending: false })
              .limit(5)
          : Promise.resolve({ data: [], count: 0, error: null }),
      ]);

      if (leaveResult.error) throw leaveResult.error;
      if (documentResult.error) throw documentResult.error;
      if (quoteResult.error) throw quoteResult.error;
      if (projectResult.error) throw projectResult.error;
      if (approvalResult.error) throw approvalResult.error;

      setLeaves((leaveResult.data || []) as LeaveReview[]);
      setDocuments(((documentResult.data || []) as unknown) as DocumentReview[]);
      setQuotes((quoteResult.data || []) as QuoteReview[]);
      setProjects((projectResult.data || []) as ProjectReview[]);
      setApprovals((approvalResult.data || []) as ApprovalReview[]);
      setCounts({
        leaves: leaveResult.count || 0,
        documents: documentResult.count || 0,
        quotes: quoteResult.count || 0,
        projects: projectResult.count || 0,
        approvals: approvalResult.count || 0,
      });
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin && !isModerator) {
      navigate('/');
      return;
    }
    loadReviewData();
  }, [authLoading, isAdmin, isModerator, loadReviewData, navigate]);

  const urgentCount = useMemo(
    () => counts.leaves + counts.documents + counts.quotes + counts.approvals,
    [counts]
  );

  const summaryCards = [
    {
      title: '휴가 승인',
      count: counts.leaves,
      description: '대기 중인 연차/휴가 신청',
      icon: ClipboardCheck,
      path: '/leave-management',
      tone: counts.leaves > 0 ? 'text-amber-600' : 'text-emerald-600',
    },
    {
      title: '파일 동기화',
      count: counts.documents,
      description: 'Drive 동기화 확인 필요',
      icon: AlertTriangle,
      path: '/storage-status',
      tone: counts.documents > 0 ? 'text-red-600' : 'text-emerald-600',
    },
    {
      title: '프로젝트 미연결',
      count: counts.quotes,
      description: '프로젝트 연결이 필요한 견적',
      icon: FileText,
      path: '/saved-quotes',
      tone: counts.quotes > 0 ? 'text-blue-600' : 'text-emerald-600',
    },
    {
      title: '가입 승인',
      count: counts.approvals,
      description: isAdmin ? '관리자 승인 대기 계정' : '관리자 전용 항목',
      icon: Users,
      path: '/employee-profiles',
      tone: counts.approvals > 0 ? 'text-violet-600' : 'text-emerald-600',
      adminOnly: true,
    },
  ];

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 p-4">
      <div className="mx-auto w-full max-w-5xl space-y-5">
        <div className="flex items-center justify-between gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            홈
          </Button>
          <Button variant="outline" size="sm" onClick={loadReviewData}>
            <RefreshCw className="mr-1 h-4 w-4" />
            새로고침
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <BrandedCardHeader
              icon={ShieldCheck}
              title="승인/검토 센터"
              subtitle="중간관리자와 관리자가 오늘 확인해야 할 승인, 동기화, 견적 연결 업무를 모았습니다."
              actions={(
              <Badge variant={urgentCount > 0 ? 'destructive' : 'secondary'} className="self-start rounded-full px-2.5 sm:self-center">
                확인 필요 {urgentCount}건
              </Badge>
              )}
            />
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {summaryCards.map((card) => {
                const Icon = card.icon;
                const disabled = card.adminOnly && !isAdmin;
                return (
                  <button
                    key={card.title}
                    type="button"
                    disabled={disabled}
                    onClick={() => navigate(card.path)}
                    className="rounded-lg border bg-background p-4 text-left transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between">
                      <Icon className={`h-5 w-5 ${card.tone}`} />
                      <span className={`text-2xl font-bold ${card.tone}`}>{card.count}</span>
                    </div>
                    <p className="mt-3 text-sm font-medium">{card.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{card.description}</p>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <BrandedCardHeader icon={ClipboardCheck} title="휴가 승인 대기" />
              <CardDescription>승인/반려 처리는 연차 관리 화면에서 진행합니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {leaves.length === 0 ? (
                <EmptyState text="대기 중인 휴가 신청이 없습니다." />
              ) : leaves.map((leave) => (
                <ReviewRow
                  key={leave.id}
                  icon={<ClipboardCheck className="h-4 w-4 text-amber-600" />}
                  title={`${leave.user_name} · ${leave.leave_type}`}
                  description={`${formatDate(leave.start_date)} - ${formatDate(leave.end_date)} · ${leave.days}일`}
                  badge="승인 대기"
                  onClick={() => navigate('/leave-management')}
                />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <BrandedCardHeader icon={AlertTriangle} title="파일 동기화 확인" />
              <CardDescription>실패/대기 파일은 스토리지 현황에서 재시도합니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {documents.length === 0 ? (
                <EmptyState text="확인 필요한 파일 동기화가 없습니다." />
              ) : documents.map((document) => (
                <ReviewRow
                  key={document.id}
                  icon={<AlertTriangle className={document.sync_status === 'failed' ? 'h-4 w-4 text-red-600' : 'h-4 w-4 text-amber-600'} />}
                  title={document.file_name}
                  description={document.sync_error || document.document_type}
                  badge={document.sync_status === 'failed' ? '실패' : '대기'}
                  onClick={() => navigate('/storage-status')}
                />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <BrandedCardHeader icon={FileText} title="프로젝트 연결 필요 견적" />
              <CardDescription>발행 견적서를 프로젝트로 전환하거나 기존 프로젝트에 연결합니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {quotes.length === 0 ? (
                <EmptyState text="프로젝트 미연결 견적이 없습니다." />
              ) : quotes.map((quote) => (
                <ReviewRow
                  key={quote.id}
                  icon={<FileText className="h-4 w-4 text-blue-600" />}
                  title={`${quote.quote_number} · ${quote.recipient_company || quote.project_name || '거래처 미지정'}`}
                  description={formatCurrency(quote.total)}
                  badge="미연결"
                  onClick={() => navigate('/saved-quotes')}
                />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <BrandedCardHeader icon={FolderOpen} title="최근 프로젝트 상태" />
              <CardDescription>진행 상태와 결제 상태를 빠르게 확인합니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {projects.length === 0 ? (
                <EmptyState text="최근 프로젝트가 없습니다." />
              ) : projects.map((project) => (
                <ReviewRow
                  key={project.id}
                  icon={<FolderOpen className="h-4 w-4 text-primary" />}
                  title={project.name}
                  description={`상태 ${project.status} · 결제 ${project.payment_status}`}
                  badge={formatDate(project.updated_at)}
                  onClick={() => navigate(`/project-management?id=${project.id}`)}
                />
              ))}
            </CardContent>
          </Card>

          {isAdmin && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <BrandedCardHeader icon={Users} title="가입 승인 대기" />
                <CardDescription>계정 승인은 관리자 권한에서만 처리합니다.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {approvals.length === 0 ? (
                  <EmptyState text="가입 승인 대기 계정이 없습니다." />
                ) : approvals.map((approval) => (
                  <ReviewRow
                    key={approval.id}
                    icon={<Users className="h-4 w-4 text-violet-600" />}
                    title={`${approval.full_name} · ${approval.email}`}
                    description={`가입일 ${formatDate(approval.created_at)}`}
                    badge="승인 대기"
                    onClick={() => navigate('/employee-profiles')}
                  />
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

const EmptyState = ({ text }: { text: string }) => (
  <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
    {text}
  </div>
);

const ReviewRow = ({
  icon,
  title,
  description,
  badge,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/40"
  >
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
      {icon}
    </div>
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-medium">{title}</p>
      <p className="truncate text-xs text-muted-foreground">{description}</p>
    </div>
    <Badge variant="secondary" className="shrink-0 text-[10px]">
      {badge}
    </Badge>
  </button>
);

export default ReviewHubPage;
