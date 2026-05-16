import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { X, FileText, Users, Briefcase, Home, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_OPTIONS = [
  { value: 'pending', label: '진행 예정' },
  { value: 'active', label: '진행중' },
  { value: 'completed', label: '완료' },
  { value: 'cancelled', label: '취소' },
];

const CreateProjectDialog: React.FC<Props> = ({ open, onOpenChange }) => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [status, setStatus] = useState('pending');
  const [projectType, setProjectType] = useState<'client' | 'internal'>('client');
  const [notionUrl, setNotionUrl] = useState('');
  const [linkedProjectId, setLinkedProjectId] = useState<string | null>(null);
  const [selectedEmployees, setSelectedEmployees] = useState<{ id: string; name: string }[]>([]);
  const [linkQuotes, setLinkQuotes] = useState(false);
  const [selectedQuoteIds, setSelectedQuoteIds] = useState<string[]>([]);

  // Fetch employees
  const { data: employees = [] } = useQuery({
    queryKey: ['all-employees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, department, position')
        .eq('is_approved', true)
        .order('full_name');
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch unlinked quotes
  const { data: availableQuotes = [] } = useQuery({
    queryKey: ['unlinked-quotes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saved_quotes')
        .select('id, quote_number, project_name, recipient_company, recipient_name, recipient_phone, recipient_email, total, quote_date, desired_delivery_date')
        .is('project_id', null)
        .order('quote_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open && linkQuotes && projectType === 'client',
  });

  // Fetch client projects for linking (resale case)
  const { data: clientProjects = [] } = useQuery({
    queryKey: ['client-projects-for-link'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .eq('project_type', 'client')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open && projectType === 'internal',
  });

  const createProject = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('로그인 필요');

      const selectedQuotes = availableQuotes.filter((quote: any) => selectedQuoteIds.includes(quote.id));
      const primaryQuote = selectedQuotes[0] as any | undefined;
      let recipientId: string | null = null;

      if (projectType === 'client' && primaryQuote?.recipient_company?.trim()) {
        const { data: recipient, error: recipientError } = await supabase
          .from('recipients')
          .select('id')
          .eq('company_name', primaryQuote.recipient_company.trim())
          .maybeSingle();

        if (recipientError) throw recipientError;
        recipientId = recipient?.id || null;
      }

      // 1. Create project
      const { data: project, error } = await supabase
        .from('projects')
        .insert({
          name: name.trim(),
          description: desc.trim() || null,
          status,
          project_type: projectType,
          recipient_id: recipientId,
          contact_name: primaryQuote?.recipient_name || null,
          contact_phone: primaryQuote?.recipient_phone || null,
          contact_email: primaryQuote?.recipient_email || null,
          notion_url: projectType === 'internal' && notionUrl.trim() ? notionUrl.trim() : null,
          linked_project_id: projectType === 'internal' && linkedProjectId ? linkedProjectId : null,
          specs: selectedQuotes.length > 0 ? {
            sourceQuoteIds: selectedQuotes.map((quote: any) => quote.id),
            sourceQuoteNumbers: selectedQuotes.map((quote: any) => quote.quote_number),
            quoteTotal: selectedQuotes.reduce((sum: number, quote: any) => sum + Number(quote.total || 0), 0),
            desiredDeliveryDate: primaryQuote?.desired_delivery_date || null,
          } : null,
          user_id: user.id,
        } as any)
        .select('id')
        .single();
      if (error) throw error;

      // 2. Assign employees
      if (selectedEmployees.length > 0) {
        const assignments = selectedEmployees.map((e) => ({
          project_id: project.id,
          user_id: e.id,
          user_name: e.name,
        }));
        const { error: aError } = await supabase.from('project_assignments').insert(assignments);
        if (aError) throw aError;
      }

      // 3. Link quotes
      if (linkQuotes && selectedQuoteIds.length > 0) {
        const { error: qError } = await supabase
          .from('saved_quotes')
          .update({ project_id: project.id })
          .in('id', selectedQuoteIds);
        if (qError) throw qError;

        const { error: fileError } = await supabase
          .from('document_files' as any)
          .update({ project_id: project.id })
          .in('quote_id', selectedQuoteIds)
          .is('project_id', null);
        if (fileError) throw fileError;
      }

      return project.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project-quote-summary'] });
      queryClient.invalidateQueries({ queryKey: ['project-assignments-all'] });
      resetForm();
      onOpenChange(false);
      toast.success('프로젝트가 생성되었습니다.');
    },
    onError: () => toast.error('프로젝트 생성에 실패했습니다.'),
  });

  const resetForm = () => {
    setName('');
    setDesc('');
    setStatus('pending');
    setProjectType('client');
    setNotionUrl('');
    setLinkedProjectId(null);
    setSelectedEmployees([]);
    setLinkQuotes(false);
    setSelectedQuoteIds([]);
  };

  const toggleEmployee = (emp: { id: string; full_name: string }) => {
    setSelectedEmployees((prev) =>
      prev.some((e) => e.id === emp.id)
        ? prev.filter((e) => e.id !== emp.id)
        : [...prev, { id: emp.id, name: emp.full_name }]
    );
  };

  const toggleQuote = (quoteId: string) => {
    setSelectedQuoteIds((prev) =>
      prev.includes(quoteId) ? prev.filter((id) => id !== quoteId) : [...prev, quoteId]
    );
  };

  const selectedQuoteSummary = useMemo(() => {
    const selected = availableQuotes.filter((quote: any) => selectedQuoteIds.includes(quote.id));
    return {
      selected,
      totalAmount: selected.reduce((sum: number, quote: any) => sum + Number(quote.total || 0), 0),
    };
  }, [availableQuotes, selectedQuoteIds]);

  useEffect(() => {
    if (!linkQuotes || selectedQuoteIds.length !== 1) return;
    const selectedQuote = availableQuotes.find((quote: any) => quote.id === selectedQuoteIds[0]) as any | undefined;
    if (!selectedQuote) return;

    const autoName = selectedQuote.project_name?.trim()
      || [selectedQuote.recipient_company, selectedQuote.quote_number].filter(Boolean).join(' · ')
      || `견적 ${selectedQuote.quote_number}`;

    if (!name.trim()) setName(autoName);
    if (!desc.trim()) setDesc(`견적서 ${selectedQuote.quote_number}에서 생성된 프로젝트입니다.`);
  }, [availableQuotes, desc, linkQuotes, name, selectedQuoteIds]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>새 프로젝트 만들기</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* 프로젝트 유형 */}
          <div>
            <label className="text-sm font-medium mb-2 block">프로젝트 유형 *</label>
            <RadioGroup value={projectType} onValueChange={(v) => setProjectType(v as any)} className="flex gap-3">
              <Label className={`flex items-center gap-2 border rounded-lg px-4 py-3 cursor-pointer transition-all flex-1 ${projectType === 'client' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50'}`}>
                <RadioGroupItem value="client" />
                <Briefcase className="h-4 w-4" />
                <div>
                  <div className="text-sm font-medium">클라이언트</div>
                  <div className="text-[10px] text-muted-foreground">매출 프로젝트</div>
                </div>
              </Label>
              <Label className={`flex items-center gap-2 border rounded-lg px-4 py-3 cursor-pointer transition-all flex-1 ${projectType === 'internal' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50'}`}>
                <RadioGroupItem value="internal" />
                <Home className="h-4 w-4" />
                <div>
                  <div className="text-sm font-medium">내부</div>
                  <div className="text-[10px] text-muted-foreground">매입 프로젝트</div>
                </div>
              </Label>
            </RadioGroup>
          </div>

          {/* 프로젝트명 */}
          <div>
            <label className="text-sm font-medium mb-1 block">프로젝트명 *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="프로젝트명을 입력하세요" />
          </div>

          {/* 설명 */}
          <div>
            <label className="text-sm font-medium mb-1 block">설명</label>
            <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="프로젝트 설명 (선택)" rows={2} />
          </div>

          {/* 단계 */}
          <div>
            <label className="text-sm font-medium mb-1 block">단계</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 노션 링크 (내부 프로젝트) */}
          {projectType === 'internal' && (
            <div>
              <label className="text-sm font-medium mb-1 block">
                <LinkIcon className="h-3.5 w-3.5 inline mr-1" />
                노션 링크
              </label>
              <Input
                value={notionUrl}
                onChange={(e) => setNotionUrl(e.target.value)}
                placeholder="https://www.notion.so/..."
              />
              <p className="text-[10px] text-muted-foreground mt-1">노션 페이지 URL을 입력하면 프로젝트 상세에서 임베드로 확인할 수 있습니다.</p>
            </div>
          )}

          {/* 연결된 클라이언트 프로젝트 (사입 → 판매 연결) */}
          {projectType === 'internal' && (
            <div>
              <label className="text-sm font-medium mb-1 block">
                <Briefcase className="h-3.5 w-3.5 inline mr-1" />
                연결 클라이언트 프로젝트 (사입→판매)
              </label>
              <Select value={linkedProjectId || 'none'} onValueChange={(v) => setLinkedProjectId(v === 'none' ? null : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="선택 안 함" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">선택 안 함</SelectItem>
                  {clientProjects.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-1">이 매입이 특정 클라이언트 프로젝트(매출)와 관련된 경우 연결하세요.</p>
            </div>
          )}

          {/* 담당 직원 */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              <Users className="h-3.5 w-3.5 inline mr-1" />
              담당 직원
            </label>
            {selectedEmployees.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {selectedEmployees.map((e) => (
                  <Badge key={e.id} variant="secondary" className="text-xs gap-1 pr-1">
                    {e.name}
                    <button onClick={() => setSelectedEmployees((prev) => prev.filter((p) => p.id !== e.id))} className="hover:bg-muted rounded-full p-0.5">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <ScrollArea className="h-[120px] border rounded-md p-2">
              {employees.map((emp: any) => (
                <label key={emp.id} className="flex items-center gap-2 py-1.5 px-1 hover:bg-muted/50 rounded cursor-pointer text-sm">
                  <Checkbox
                    checked={selectedEmployees.some((e) => e.id === emp.id)}
                    onCheckedChange={() => toggleEmployee(emp)}
                  />
                  <span>{emp.full_name}</span>
                  {emp.department && <span className="text-xs text-muted-foreground">({emp.department})</span>}
                </label>
              ))}
            </ScrollArea>
          </div>

          {/* 견적서 연결 (클라이언트만) */}
          {projectType === 'client' && <div>
            <label className="flex items-center gap-2 text-sm font-medium mb-1.5 cursor-pointer">
              <Checkbox checked={linkQuotes} onCheckedChange={(v) => { setLinkQuotes(!!v); if (!v) setSelectedQuoteIds([]); }} />
              <FileText className="h-3.5 w-3.5" />
              견적서 연결
            </label>
            {linkQuotes && (
              <div className="space-y-2">
                {selectedQuoteSummary.selected.length > 0 && (
                  <div className="rounded-lg border border-primary/20 bg-primary/[0.03] px-3 py-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">선택 견적 {selectedQuoteSummary.selected.length}건</span>
                      <span className="font-semibold tabular-nums">{selectedQuoteSummary.totalAmount.toLocaleString()}원</span>
                    </div>
                    <p className="mt-1 text-muted-foreground">
                      프로젝트 생성 시 견적서와 첨부 파일 원장이 함께 연결됩니다.
                    </p>
                  </div>
                )}
                <ScrollArea className="h-[140px] border rounded-md p-2">
                  {availableQuotes.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">연결 가능한 견적서가 없습니다.</p>
                  ) : (
                    availableQuotes.map((q: any) => (
                      <label key={q.id} className="flex items-center gap-2 py-1.5 px-1 hover:bg-muted/50 rounded cursor-pointer text-sm">
                        <Checkbox
                          checked={selectedQuoteIds.includes(q.id)}
                          onCheckedChange={() => toggleQuote(q.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <span className="font-mono text-xs">{q.quote_number}</span>
                          {q.recipient_company && <span className="text-xs text-muted-foreground ml-1.5">· {q.recipient_company}</span>}
                          {q.project_name && <div className="truncate text-[10px] text-muted-foreground">{q.project_name}</div>}
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {q.total?.toLocaleString()}원
                        </span>
                      </label>
                    ))
                  )}
                </ScrollArea>
              </div>
            )}
          </div>}

          <Button
            onClick={() => createProject.mutate()}
            disabled={!name.trim() || createProject.isPending}
            className="w-full"
          >
            {createProject.isPending ? '생성 중...' : '프로젝트 생성'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateProjectDialog;
