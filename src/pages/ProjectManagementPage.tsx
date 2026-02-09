import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowLeft, Plus, FolderOpen, Building2, FileText, Search, Trash2, Users, CircleDollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import ProjectDetailPanel from '@/components/project/ProjectDetailPanel';

const ProjectManagementPage = () => {
  const navigate = useNavigate();
  const { user, profile, isAdmin, isModerator } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*, recipients(company_name, contact_person)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: quoteData = {} } = useQuery({
    queryKey: ['project-quote-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saved_quotes')
        .select('project_id, total')
        .not('project_id', 'is', null);
      if (error) throw error;
      const summary: Record<string, { count: number; totalAmount: number }> = {};
      data?.forEach((q: any) => {
        if (!summary[q.project_id]) summary[q.project_id] = { count: 0, totalAmount: 0 };
        summary[q.project_id].count += 1;
        summary[q.project_id].totalAmount += Number(q.total || 0);
      });
      return summary;
    },
    enabled: !!user,
  });

  const { data: allAssignments = [] } = useQuery({
    queryKey: ['project-assignments-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_assignments')
        .select('project_id, user_name');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const createProject = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('로그인 필요');
      const { error } = await supabase.from('projects').insert({
        name: newName.trim(),
        description: newDesc.trim() || null,
        user_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setCreateOpen(false);
      setNewName('');
      setNewDesc('');
      toast.success('프로젝트가 생성되었습니다.');
    },
    onError: () => toast.error('프로젝트 생성에 실패했습니다.'),
  });

  const filteredProjects = projects.filter((p: any) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const statusColors: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-700',
    active: 'bg-green-100 text-green-700',
    completed: 'bg-blue-100 text-blue-700',
    cancelled: 'bg-red-100 text-red-700',
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">프로젝트 관리</h1>
        </div>

        <div className="flex gap-6">
          {/* Left: Project List */}
          <div className="w-[380px] shrink-0 space-y-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="프로젝트 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1 shrink-0">
                    <Plus className="h-4 w-4" /> 새 프로젝트
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>새 프로젝트 만들기</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 mt-2">
                    <div>
                      <label className="text-sm font-medium mb-1 block">프로젝트명 *</label>
                      <Input
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="프로젝트명을 입력하세요"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">설명</label>
                      <Textarea
                        value={newDesc}
                        onChange={(e) => setNewDesc(e.target.value)}
                        placeholder="프로젝트 설명 (선택)"
                        rows={3}
                      />
                    </div>
                    <Button
                      onClick={() => createProject.mutate()}
                      disabled={!newName.trim() || createProject.isPending}
                      className="w-full"
                    >
                      {createProject.isPending ? '생성 중...' : '프로젝트 생성'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="space-y-2 max-h-[calc(100vh-220px)] overflow-y-auto">
              {isLoading ? (
                <p className="text-sm text-muted-foreground text-center py-8">로딩 중...</p>
              ) : filteredProjects.length === 0 ? (
                <div className="text-center py-12">
                  <FolderOpen className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {searchQuery ? '검색 결과가 없습니다.' : '아직 프로젝트가 없습니다.'}
                  </p>
                </div>
              ) : (
                filteredProjects.map((project: any) => {
                  const qs = (quoteData as any)[project.id];
                  const assignees = allAssignments
                    .filter((a: any) => a.project_id === project.id)
                    .map((a: any) => a.user_name);

                  return (
                    <Card
                      key={project.id}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        selectedProjectId === project.id ? 'ring-2 ring-primary' : ''
                      }`}
                      onClick={() => setSelectedProjectId(project.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <h3 className="font-semibold text-sm truncate">{project.name}</h3>
                              {qs && qs.count > 0 && (
                                <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                              )}
                            </div>
                            {project.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{project.description}</p>
                            )}
                          </div>
                          <Badge variant="secondary" className={`text-[10px] shrink-0 ${statusColors[project.status] || ''}`}>
                            {statusLabels[project.status] || project.status}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] text-muted-foreground">
                          {project.recipients && (
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {project.recipients.company_name}
                              {project.recipients.contact_person && (
                                <span className="text-muted-foreground/70">· {project.recipients.contact_person}</span>
                              )}
                            </span>
                          )}
                          {qs && qs.count > 0 && (
                            <span className="flex items-center gap-1">
                              <CircleDollarSign className="h-3 w-3" />
                              ₩{Math.round(qs.totalAmount).toLocaleString()}
                            </span>
                          )}
                          {assignees.length > 0 && (
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {assignees.length <= 2 ? assignees.join(', ') : `${assignees[0]} 외 ${assignees.length - 1}명`}
                            </span>
                          )}
                          <span className="ml-auto">
                            {format(new Date(project.created_at), 'yy.MM.dd', { locale: ko })}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
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
                onDeleted={() => setSelectedProjectId(null)}
              />
            ) : (
              <div className="flex items-center justify-center h-[400px] border-2 border-dashed rounded-lg">
                <div className="text-center">
                  <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground">프로젝트를 선택하세요</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectManagementPage;
