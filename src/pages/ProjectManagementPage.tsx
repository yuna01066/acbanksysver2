import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, FolderOpen, Building2, FileText, Search, Users, CircleDollarSign, Briefcase, Home } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import ProjectDetailPanel from '@/components/project/ProjectDetailPanel';
import CreateProjectDialog from '@/components/project/CreateProjectDialog';
import { PageHeader, PageShell, SearchFilterBar } from '@/components/layout/PageLayout';

const paymentStatusConfig: Record<string, { label: string; dot: string }> = {
  unpaid: { label: '미입금', dot: 'bg-gray-400' },
  deposit_paid: { label: '계약금', dot: 'bg-amber-400' },
  interim_paid: { label: '중도금', dot: 'bg-blue-400' },
  card_paid: { label: '카드결제', dot: 'bg-violet-400' },
  fully_paid: { label: '완료', dot: 'bg-emerald-400' },
};

interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  project_type: string | null;
  status: string;
  payment_status: string | null;
  created_at: string;
  recipients: {
    company_name: string | null;
    contact_person: string | null;
  } | null;
}

interface ProjectAssignment {
  project_id: string;
  user_name: string | null;
}

type ProjectQuoteSummary = Record<string, { count: number; totalAmount: number }>;

const ProjectManagementPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'client' | 'internal'>('client');
  const projectIdFromUrl = searchParams.get('id') || searchParams.get('project');

  const { data: projects = [], isLoading } = useQuery<ProjectRow[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*, recipients(company_name, contact_person)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as ProjectRow[];
    },
    enabled: !!user,
  });

  const { data: quoteData = {} } = useQuery<ProjectQuoteSummary>({
    queryKey: ['project-quote-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saved_quotes')
        .select('project_id, total')
        .not('project_id', 'is', null);
      if (error) throw error;
      const summary: Record<string, { count: number; totalAmount: number }> = {};
      ((data || []) as Array<{ project_id: string; total: number | null }>).forEach((q) => {
        if (!summary[q.project_id]) summary[q.project_id] = { count: 0, totalAmount: 0 };
        summary[q.project_id].count += 1;
        summary[q.project_id].totalAmount += Number(q.total || 0);
      });
      return summary;
    },
    enabled: !!user,
  });

  const { data: allAssignments = [] } = useQuery<ProjectAssignment[]>({
    queryKey: ['project-assignments-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_assignments')
        .select('project_id, user_name');
      if (error) throw error;
      return (data || []) as ProjectAssignment[];
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!projectIdFromUrl) {
      setSelectedProjectId(null);
      return;
    }

    const linkedProject = projects.find((project) => project.id === projectIdFromUrl);
    if (!linkedProject) return;

    const linkedProjectType = linkedProject.project_type === 'internal' ? 'internal' : 'client';
    setActiveTab(linkedProjectType);
    setSelectedProjectId(projectIdFromUrl);
    setSearchQuery('');
  }, [projectIdFromUrl, projects]);

  const handleTabChange = (tab: 'client' | 'internal') => {
    setActiveTab(tab);
    setSelectedProjectId(null);
    setSearchParams({}, { replace: true });
  };

  const handleProjectSelect = (projectId: string) => {
    setSelectedProjectId(projectId);
    setSearchParams({ id: projectId }, { replace: true });
  };

  const handleProjectDeleted = () => {
    setSelectedProjectId(null);
    setSearchParams({}, { replace: true });
  };

  const filteredProjects = projects.filter((p) =>
    (p.project_type || 'client') === activeTab &&
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const statusColors: Record<string, string> = {
    pending: 'bg-muted text-muted-foreground',
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    completed: 'bg-blue-50 text-blue-700 border-blue-200',
    cancelled: 'bg-red-50 text-red-600 border-red-200',
  };

  const statusLabels: Record<string, string> = {
    pending: '진행 예정',
    active: '진행중',
    completed: '완료',
    cancelled: '취소',
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">로그인이 필요합니다.</p>
      </div>
    );
  }

  return (
    <PageShell maxWidth="7xl">
      <PageHeader
        eyebrow="Projects"
        title="프로젝트 관리"
        description="견적서, 거래처, 담당자, 결제 상태를 프로젝트 기준으로 확인합니다."
        icon={<FolderOpen className="h-5 w-5" />}
        actions={(
          <>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              새 프로젝트
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/')}>
              <Home className="h-4 w-4" />
              홈
            </Button>
          </>
        )}
      />
      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />

      <div className="flex flex-col gap-5 lg:flex-row">
          {/* Left: Project List */}
          <div className="w-full shrink-0 flex flex-col lg:w-[360px]">
            {/* Tab buttons */}
            <SearchFilterBar className="mb-3 space-y-3">
              <div className="flex bg-muted rounded-lg p-0.5">
                <button
                  onClick={() => handleTabChange('client')}
                  className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-md transition-all ${
                    activeTab === 'client'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Briefcase className="h-3.5 w-3.5" />
                  클라이언트 (매출)
                </button>
                <button
                  onClick={() => handleTabChange('internal')}
                  className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-md transition-all ${
                    activeTab === 'internal'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Home className="h-3.5 w-3.5" />
                  내부 (매입)
                </button>
              </div>

              {/* Search */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="프로젝트 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-8 text-xs"
                  />
                </div>
              </div>
            </SearchFilterBar>

            {/* Project list */}
            <div className="space-y-1.5 max-h-[calc(100vh-240px)] overflow-y-auto pr-0.5">
              {isLoading ? (
                <div className="space-y-2 py-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : filteredProjects.length === 0 ? (
                <div className="text-center py-16">
                  <FolderOpen className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">
                    {searchQuery ? '검색 결과가 없습니다.' : '프로젝트가 없습니다.'}
                  </p>
                </div>
              ) : (
                filteredProjects.map((project) => {
                  const qs = quoteData[project.id];
                  const assignees = allAssignments
                    .filter((a) => a.project_id === project.id)
                    .map((a) => a.user_name)
                    .filter(Boolean);
                  const isSelected = selectedProjectId === project.id;
                  const payment = paymentStatusConfig[project.payment_status || 'unpaid'];

                  return (
                    <div
                      key={project.id}
                      onClick={() => handleProjectSelect(project.id)}
                      className={`group cursor-pointer rounded-lg border p-3 transition-all ${
                        isSelected
                          ? 'border-primary/40 bg-primary/[0.03] shadow-sm'
                          : 'border-transparent hover:bg-muted/50 hover:border-border'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <h3 className="font-semibold text-[13px] truncate leading-tight">{project.name}</h3>
                            {qs && qs.count > 0 && (
                              <FileText className="h-3 w-3 text-primary/60 shrink-0" />
                            )}
                          </div>
                        </div>
                        <Badge
                          variant="secondary"
                          className={`text-[10px] px-1.5 py-0 h-[18px] font-medium border shrink-0 ${statusColors[project.status] || ''}`}
                        >
                          {statusLabels[project.status] || project.status}
                        </Badge>
                      </div>

                      {project.description && (
                        <p className="text-[11px] text-muted-foreground line-clamp-1 mb-1.5">{project.description}</p>
                      )}

                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] text-muted-foreground">
                        {project.recipients && (
                          <span className="flex items-center gap-0.5">
                            <Building2 className="h-2.5 w-2.5" />
                            {project.recipients.company_name}
                            {project.recipients.contact_person && (
                              <span className="opacity-60">· {project.recipients.contact_person}</span>
                            )}
                          </span>
                        )}
                        {qs && qs.count > 0 && (
                          <span className="flex items-center gap-0.5">
                            <CircleDollarSign className="h-2.5 w-2.5" />
                            ₩{Math.round(qs.totalAmount).toLocaleString()}
                          </span>
                        )}
                        {assignees.length > 0 && (
                          <span className="flex items-center gap-0.5">
                            <Users className="h-2.5 w-2.5" />
                            {assignees.length <= 2 ? assignees.join(', ') : `${assignees[0]} 외 ${assignees.length - 1}명`}
                          </span>
                        )}
                        {payment && (
                          <span className="flex items-center gap-1">
                            <span className={`w-1.5 h-1.5 rounded-full ${payment.dot}`} />
                            {payment.label}
                          </span>
                        )}
                        <span className="ml-auto tabular-nums">
                          {format(new Date(project.created_at), 'yy.MM.dd', { locale: ko })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Project Detail */}
          <div className="flex-1 min-w-0">
            {selectedProjectId ? (
              <ProjectDetailPanel
                projectId={selectedProjectId}
                onDeleted={handleProjectDeleted}
              />
            ) : (
              <div className="flex items-center justify-center h-[500px] border border-dashed rounded-xl bg-muted/20">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                    <FolderOpen className="h-5 w-5 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm text-muted-foreground">프로젝트를 선택하세요</p>
                  <p className="text-[11px] text-muted-foreground/60 mt-0.5">좌측 목록에서 프로젝트를 클릭하면 상세 정보가 표시됩니다</p>
                </div>
              </div>
            )}
          </div>
      </div>
    </PageShell>
  );
};

export default ProjectManagementPage;
