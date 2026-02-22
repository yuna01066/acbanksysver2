import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash2, ExternalLink, CheckSquare, Users, Link as LinkIcon, Calendar, MapPin, Building2, Edit2, StickyNote, CalendarCheck, FileText, FolderOpen, Presentation, LayoutGrid } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

type DashboardView = 'dashboard' | 'meetings' | 'consult-form' | 'documents' | 'portfolio' | 'exhibitions';

const statusLabels: Record<string, string> = {
  upcoming: '예정',
  ongoing: '진행중',
  completed: '완료',
  cancelled: '취소',
};
const statusColors: Record<string, string> = {
  upcoming: 'bg-blue-100 text-blue-800',
  ongoing: 'bg-green-100 text-green-800',
  completed: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
};

const ExhibitionManagementPage = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [currentView, setCurrentView] = useState<DashboardView>('dashboard');
  const [selectedExhibitionId, setSelectedExhibitionId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [form, setForm] = useState({ name: '', start_date: '', end_date: '', location: '', booth_number: '', cost: '', description: '' });

  // Fetch exhibitions
  const { data: exhibitions = [] } = useQuery({
    queryKey: ['exhibitions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('exhibitions').select('*').order('start_date', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user,
  });

  const selectedExhibition = exhibitions.find((e: any) => e.id === selectedExhibitionId);

  // Create exhibition
  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('exhibitions').insert({
        name: form.name,
        start_date: form.start_date,
        end_date: form.end_date,
        location: form.location || null,
        booth_number: form.booth_number || null,
        cost: form.cost ? Number(form.cost) : 0,
        description: form.description || null,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exhibitions'] });
      setShowCreateDialog(false);
      setForm({ name: '', start_date: '', end_date: '', location: '', booth_number: '', cost: '', description: '' });
      toast.success('박람회가 등록되었습니다.');
    },
    onError: () => toast.error('등록 실패'),
  });

  // Delete exhibition
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('exhibitions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exhibitions'] });
      setSelectedExhibitionId(null);
      toast.success('삭제되었습니다.');
    },
  });

  // Update status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('exhibitions').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exhibitions'] });
      toast.success('상태가 변경되었습니다.');
    },
  });

  if (!user) {
    return <div className="p-8 text-center text-muted-foreground">로그인이 필요합니다.</div>;
  }

  const dashboardCards = [
    { key: 'meetings' as DashboardView, title: '현장 미팅 예약', description: '박람회 현장 미팅 일정 관리', icon: CalendarCheck, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { key: 'consult-form' as DashboardView, title: '상담폼', description: '고객 상담 기록 및 관리', icon: FileText, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { key: 'documents' as DashboardView, title: '자료', description: '박람회 관련 자료 관리', icon: FolderOpen, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { key: 'portfolio' as DashboardView, title: '포트폴리오', description: '포트폴리오 관리', icon: Presentation, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { key: 'exhibitions' as DashboardView, title: '등록된 박람회', description: '박람회 등록 및 상세 관리', icon: Building2, color: 'text-rose-500', bg: 'bg-rose-500/10' },
    { key: null, title: '준비중', description: '추후 업데이트 예정', icon: LayoutGrid, color: 'text-muted-foreground', bg: 'bg-muted/50', disabled: true },
  ];

  const renderSubPageHeader = (title: string) => (
    <div className="flex items-center gap-4 mb-6">
      <Button variant="ghost" size="icon" onClick={() => setCurrentView('dashboard')}>
        <ArrowLeft className="h-5 w-5" />
      </Button>
      <h1 className="text-2xl font-bold">{title}</h1>
    </div>
  );

  const renderPlaceholder = (title: string) => (
    <div>
      {renderSubPageHeader(title)}
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground">
          <p className="text-lg font-medium mb-1">{title}</p>
          <p className="text-sm">이 기능은 준비중입니다.</p>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">

        {currentView === 'dashboard' && (
          <>
            {/* Dashboard Header */}
            <div className="flex items-center gap-4 mb-8">
              <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex-1">
                <h1 className="text-2xl font-bold">박람회 관리</h1>
                <p className="text-sm text-muted-foreground">박람회 관련 업무를 한 곳에서 관리합니다</p>
              </div>
            </div>

            {/* Dashboard Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {dashboardCards.map((card, i) => (
                <Card
                  key={i}
                  className={`cursor-pointer group transition-all hover:shadow-md ${card.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={() => { if (!card.disabled && card.key) setCurrentView(card.key); }}
                >
                  <CardContent className="p-6 text-center">
                    <div className={`w-12 h-12 rounded-xl ${card.bg} flex items-center justify-center mx-auto mb-3 transition-transform group-hover:scale-110`}>
                      <card.icon className={`w-6 h-6 ${card.color}`} />
                    </div>
                    <h3 className="font-semibold text-sm mb-1">{card.title}</h3>
                    <p className="text-xs text-muted-foreground">{card.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

          </>
        )}

        {currentView === 'exhibitions' && (
          <div>
            {renderSubPageHeader('등록된 박람회')}
            <div className="flex items-center justify-end mb-4">
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2"><Plus className="h-4 w-4" />박람회 등록</Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader><DialogTitle>새 박람회 등록</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>박람회명 *</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><Label>시작일 *</Label><Input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} /></div>
                      <div><Label>종료일 *</Label><Input type="date" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} /></div>
                    </div>
                    <div><Label>장소</Label><Input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} /></div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><Label>부스번호</Label><Input value={form.booth_number} onChange={e => setForm(p => ({ ...p, booth_number: e.target.value }))} /></div>
                      <div><Label>참가비용</Label><Input type="number" value={form.cost} onChange={e => setForm(p => ({ ...p, cost: e.target.value }))} /></div>
                    </div>
                    <div><Label>설명</Label><Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} /></div>
                    <Button className="w-full" disabled={!form.name || !form.start_date || !form.end_date} onClick={() => createMutation.mutate()}>등록</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {exhibitions.length === 0 && <p className="col-span-full text-center text-muted-foreground py-12">등록된 박람회가 없습니다.</p>}
              {exhibitions.map((ex: any) => (
                <Card key={ex.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setSelectedExhibitionId(ex.id); }}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-lg">{ex.name}</h3>
                      <Badge className={statusColors[ex.status]}>{statusLabels[ex.status]}</Badge>
                    </div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{ex.start_date} ~ {ex.end_date}</div>
                      {ex.location && <div className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{ex.location}</div>}
                      {ex.booth_number && <div className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />부스 {ex.booth_number}</div>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {selectedExhibitionId && selectedExhibition && (
              <Dialog open={!!selectedExhibitionId} onOpenChange={(open) => { if (!open) setSelectedExhibitionId(null); }}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <ExhibitionDetail
                    exhibition={selectedExhibition}
                    onBack={() => setSelectedExhibitionId(null)}
                    onDelete={(id: string) => deleteMutation.mutate(id)}
                    onStatusChange={(id: string, status: string) => updateStatusMutation.mutate({ id, status })}
                    user={user}
                    profile={profile}
                  />
                </DialogContent>
              </Dialog>
            )}
          </div>
        )}

        {currentView === 'meetings' && renderPlaceholder('현장 미팅 예약')}
        {currentView === 'consult-form' && renderPlaceholder('상담폼')}
        {currentView === 'documents' && renderPlaceholder('자료')}
        {currentView === 'portfolio' && renderPlaceholder('포트폴리오')}

      </div>
    </div>
  );
};

/* ─── Detail view ─── */
function ExhibitionDetail({ exhibition, onBack, onDelete, onStatusChange, user, profile }: any) {
  const qc = useQueryClient();
  if (!exhibition) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold">{exhibition.name}</h2>
            <Badge className={statusColors[exhibition.status]}>{statusLabels[exhibition.status]}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {exhibition.start_date} ~ {exhibition.end_date}
            {exhibition.location && ` · ${exhibition.location}`}
            {exhibition.booth_number && ` · 부스 ${exhibition.booth_number}`}
          </p>
        </div>
        <Select value={exhibition.status} onValueChange={(v) => onStatusChange(exhibition.id, v)}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="destructive" size="sm" onClick={() => { if (confirm('삭제하시겠습니까?')) onDelete(exhibition.id); }}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      {exhibition.description && <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">{exhibition.description}</p>}

      <Tabs defaultValue="checklist">
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="checklist" className="gap-1"><CheckSquare className="h-4 w-4" />체크리스트</TabsTrigger>
          <TabsTrigger value="consultations" className="gap-1"><Users className="h-4 w-4" />상담기록</TabsTrigger>
          <TabsTrigger value="links" className="gap-1"><LinkIcon className="h-4 w-4" />링크/메모</TabsTrigger>
        </TabsList>

        <TabsContent value="checklist"><ChecklistTab exhibitionId={exhibition.id} /></TabsContent>
        <TabsContent value="consultations"><ConsultationTab exhibitionId={exhibition.id} user={user} profile={profile} /></TabsContent>
        <TabsContent value="links"><LinksTab exhibitionId={exhibition.id} /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ─── Checklist Tab ─── */
function ChecklistTab({ exhibitionId }: { exhibitionId: string }) {
  const qc = useQueryClient();
  const [newItem, setNewItem] = useState('');

  const { data: items = [] } = useQuery({
    queryKey: ['exhibition-checklist', exhibitionId],
    queryFn: async () => {
      const { data, error } = await supabase.from('exhibition_checklist_items').select('*').eq('exhibition_id', exhibitionId).order('display_order');
      if (error) throw error;
      return data as any[];
    },
  });

  const addItem = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('exhibition_checklist_items').insert({ exhibition_id: exhibitionId, title: newItem, display_order: items.length });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['exhibition-checklist', exhibitionId] }); setNewItem(''); },
  });

  const toggleItem = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase.from('exhibition_checklist_items').update({ is_completed: completed }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exhibition-checklist', exhibitionId] }),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('exhibition_checklist_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exhibition-checklist', exhibitionId] }),
  });

  const completedCount = items.filter((i: any) => i.is_completed).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          준비물 체크리스트
          <span className="text-sm font-normal text-muted-foreground">{completedCount}/{items.length} 완료</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex gap-2">
          <Input placeholder="새 항목 추가..." value={newItem} onChange={e => setNewItem(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newItem.trim()) addItem.mutate(); }} />
          <Button size="sm" disabled={!newItem.trim()} onClick={() => addItem.mutate()}><Plus className="h-4 w-4" /></Button>
        </div>
        {items.map((item: any) => (
          <div key={item.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 group">
            <Checkbox checked={item.is_completed} onCheckedChange={(v) => toggleItem.mutate({ id: item.id, completed: !!v })} />
            <span className={`flex-1 text-sm ${item.is_completed ? 'line-through text-muted-foreground' : ''}`}>{item.title}</span>
            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => deleteItem.mutate(item.id)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* ─── Consultation Tab ─── */
function ConsultationTab({ exhibitionId, user, profile }: { exhibitionId: string; user: any; profile: any }) {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ customer_name: '', customer_company: '', customer_phone: '', customer_email: '', consultation_content: '', follow_up_action: '' });

  const { data: consults = [] } = useQuery({
    queryKey: ['exhibition-consultations', exhibitionId],
    queryFn: async () => {
      const { data, error } = await supabase.from('exhibition_consultations').select('*').eq('exhibition_id', exhibitionId).order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const addConsult = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('exhibition_consultations').insert({
        exhibition_id: exhibitionId,
        ...form,
        consulted_by: user.id,
        consulted_by_name: profile?.full_name || user.email,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exhibition-consultations', exhibitionId] });
      setShowAdd(false);
      setForm({ customer_name: '', customer_company: '', customer_phone: '', customer_email: '', consultation_content: '', follow_up_action: '' });
      toast.success('상담 기록이 추가되었습니다.');
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('exhibition_consultations').update({ follow_up_status: status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exhibition-consultations', exhibitionId] }),
  });

  const deleteConsult = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('exhibition_consultations').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['exhibition-consultations', exhibitionId] }); toast.success('삭제되었습니다.'); },
  });

  const followUpLabels: Record<string, string> = { pending: '대기', in_progress: '진행중', completed: '완료' };
  const followUpColors: Record<string, string> = { pending: 'bg-yellow-100 text-yellow-800', in_progress: 'bg-blue-100 text-blue-800', completed: 'bg-green-100 text-green-800' };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          고객 상담 기록 <span className="text-sm font-normal text-muted-foreground">{consults.length}건</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!showAdd ? (
          <Button variant="outline" className="w-full gap-2" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4" />상담 기록 추가</Button>
        ) : (
          <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
            <div className="grid grid-cols-2 gap-2">
              <div><Label>고객명 *</Label><Input value={form.customer_name} onChange={e => setForm(p => ({ ...p, customer_name: e.target.value }))} /></div>
              <div><Label>회사명</Label><Input value={form.customer_company} onChange={e => setForm(p => ({ ...p, customer_company: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>연락처</Label><Input value={form.customer_phone} onChange={e => setForm(p => ({ ...p, customer_phone: e.target.value }))} /></div>
              <div><Label>이메일</Label><Input value={form.customer_email} onChange={e => setForm(p => ({ ...p, customer_email: e.target.value }))} /></div>
            </div>
            <div><Label>상담 내용</Label><Textarea value={form.consultation_content} onChange={e => setForm(p => ({ ...p, consultation_content: e.target.value }))} rows={2} /></div>
            <div><Label>후속 조치</Label><Input value={form.follow_up_action} onChange={e => setForm(p => ({ ...p, follow_up_action: e.target.value }))} /></div>
            <div className="flex gap-2">
              <Button size="sm" disabled={!form.customer_name} onClick={() => addConsult.mutate()}>저장</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>취소</Button>
            </div>
          </div>
        )}
        {consults.map((c: any) => (
          <div key={c.id} className="border rounded-lg p-4 space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <span className="font-medium">{c.customer_name}</span>
                {c.customer_company && <span className="text-sm text-muted-foreground ml-2">({c.customer_company})</span>}
              </div>
              <div className="flex items-center gap-2">
                <Select value={c.follow_up_status} onValueChange={(v) => updateStatus.mutate({ id: c.id, status: v })}>
                  <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(followUpLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { if (confirm('삭제하시겠습니까?')) deleteConsult.mutate(c.id); }}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
            {(c.customer_phone || c.customer_email) && (
              <p className="text-xs text-muted-foreground">{[c.customer_phone, c.customer_email].filter(Boolean).join(' · ')}</p>
            )}
            {c.consultation_content && <p className="text-sm">{c.consultation_content}</p>}
            {c.follow_up_action && <p className="text-sm text-muted-foreground">📋 후속: {c.follow_up_action}</p>}
            <p className="text-xs text-muted-foreground">작성: {c.consulted_by_name} · {format(new Date(c.created_at), 'yyyy.MM.dd HH:mm')}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* ─── Links/Memo Tab ─── */
function LinksTab({ exhibitionId }: { exhibitionId: string }) {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: '', url: '', memo: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMemo, setEditMemo] = useState('');

  const { data: links = [] } = useQuery({
    queryKey: ['exhibition-links', exhibitionId],
    queryFn: async () => {
      const { data, error } = await supabase.from('exhibition_links').select('*').eq('exhibition_id', exhibitionId).order('display_order');
      if (error) throw error;
      return data as any[];
    },
  });

  const addLink = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('exhibition_links').insert({ exhibition_id: exhibitionId, title: form.title, url: form.url, memo: form.memo || null, display_order: links.length });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exhibition-links', exhibitionId] });
      setShowAdd(false);
      setForm({ title: '', url: '', memo: '' });
      toast.success('링크가 추가되었습니다.');
    },
  });

  const updateMemo = useMutation({
    mutationFn: async ({ id, memo }: { id: string; memo: string }) => {
      const { error } = await supabase.from('exhibition_links').update({ memo }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['exhibition-links', exhibitionId] });
      setEditingId(null);
      toast.success('메모가 저장되었습니다.');
    },
  });

  const deleteLink = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('exhibition_links').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['exhibition-links', exhibitionId] }); toast.success('삭제되었습니다.'); },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          관련 링크 & 메모 <span className="text-sm font-normal text-muted-foreground">{links.length}개</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!showAdd ? (
          <Button variant="outline" className="w-full gap-2" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4" />링크 추가</Button>
        ) : (
          <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
            <div><Label>링크 이름 *</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="예: 박람회 공식 사이트" /></div>
            <div><Label>URL *</Label><Input value={form.url} onChange={e => setForm(p => ({ ...p, url: e.target.value }))} placeholder="https://" /></div>
            <div><Label>메모</Label><Textarea value={form.memo} onChange={e => setForm(p => ({ ...p, memo: e.target.value }))} rows={2} placeholder="해당 사이트에서 해야 할 업데이트 등..." /></div>
            <div className="flex gap-2">
              <Button size="sm" disabled={!form.title || !form.url} onClick={() => addLink.mutate()}>저장</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>취소</Button>
            </div>
          </div>
        )}
        {links.map((link: any) => (
          <div key={link.id} className="border rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline flex items-center gap-1">
                <ExternalLink className="h-3.5 w-3.5" />{link.title}
              </a>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditingId(link.id); setEditMemo(link.memo || ''); }}>
                  <StickyNote className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { if (confirm('삭제하시겠습니까?')) deleteLink.mutate(link.id); }}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground break-all">{link.url}</p>
            {editingId === link.id ? (
              <div className="space-y-2">
                <Textarea value={editMemo} onChange={e => setEditMemo(e.target.value)} rows={2} placeholder="메모 입력..." />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => updateMemo.mutate({ id: link.id, memo: editMemo })}>저장</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>취소</Button>
                </div>
              </div>
            ) : (
              link.memo && <p className="text-sm bg-muted/50 rounded p-2"><StickyNote className="h-3 w-3 inline mr-1" />{link.memo}</p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default ExhibitionManagementPage;
