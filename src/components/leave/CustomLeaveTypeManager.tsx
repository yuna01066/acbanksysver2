import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Plus, MoreHorizontal, Edit, Trash2, Loader2, Heart, Shield, Baby, Award, Coffee, Sun, AlertTriangle, BookOpen, Star, Gem, Thermometer, Calendar, Stethoscope } from 'lucide-react';
import { toast } from 'sonner';

interface CustomLeaveType {
  id: string;
  name: string;
  description: string | null;
  icon_name: string;
  is_required: boolean;
  approval_required: boolean;
  reference_required: boolean;
  paid: boolean;
  max_days: number | null;
  display_order: number;
  is_active: boolean;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  Heart: <Heart className="h-5 w-5 text-rose-400" />,
  Shield: <Shield className="h-5 w-5 text-amber-500" />,
  Baby: <Baby className="h-5 w-5 text-emerald-400" />,
  Award: <Award className="h-5 w-5 text-violet-400" />,
  Coffee: <Coffee className="h-5 w-5 text-amber-600" />,
  Sun: <Sun className="h-5 w-5 text-yellow-500" />,
  AlertTriangle: <AlertTriangle className="h-5 w-5 text-red-500" />,
  BookOpen: <BookOpen className="h-5 w-5 text-blue-400" />,
  Star: <Star className="h-5 w-5 text-yellow-400" />,
  Gem: <Gem className="h-5 w-5 text-pink-400" />,
  Thermometer: <Thermometer className="h-5 w-5 text-orange-400" />,
  Calendar: <Calendar className="h-5 w-5 text-muted-foreground" />,
  Stethoscope: <Stethoscope className="h-5 w-5 text-teal-500" />,
};

const CustomLeaveTypeManager: React.FC = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<CustomLeaveType | null>(null);
  const [form, setForm] = useState({
    name: '', description: '', icon_name: 'Calendar', is_required: false,
    approval_required: false, reference_required: false, paid: true, max_days: '',
  });

  const { data: leaveTypes = [], isLoading } = useQuery({
    queryKey: ['custom-leave-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_leave_types')
        .select('*')
        .order('display_order');
      if (error) throw error;
      return data as CustomLeaveType[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        description: form.description || null,
        icon_name: form.icon_name,
        is_required: form.is_required,
        approval_required: form.approval_required,
        reference_required: form.reference_required,
        paid: form.paid,
        max_days: form.max_days ? Number(form.max_days) : null,
      };
      if (editingType) {
        const { error } = await supabase.from('custom_leave_types').update(payload).eq('id', editingType.id);
        if (error) throw error;
      } else {
        const maxOrder = leaveTypes.length > 0 ? Math.max(...leaveTypes.map(t => t.display_order)) + 1 : 0;
        const { error } = await supabase.from('custom_leave_types').insert({ ...payload, display_order: maxOrder });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingType ? '수정되었습니다.' : '추가되었습니다.');
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['custom-leave-types'] });
    },
    onError: (e: any) => toast.error('실패: ' + e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('custom_leave_types').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('삭제되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['custom-leave-types'] });
    },
    onError: (e: any) => toast.error('삭제 실패: ' + e.message),
  });

  const openCreate = () => {
    setEditingType(null);
    setForm({ name: '', description: '', icon_name: 'Calendar', is_required: false, approval_required: false, reference_required: false, paid: true, max_days: '' });
    setDialogOpen(true);
  };

  const openEdit = (t: CustomLeaveType) => {
    setEditingType(t);
    setForm({
      name: t.name, description: t.description || '', icon_name: t.icon_name,
      is_required: t.is_required, approval_required: t.approval_required,
      reference_required: t.reference_required, paid: t.paid, max_days: t.max_days ? String(t.max_days) : '',
    });
    setDialogOpen(true);
  };

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">맞춤 휴가</h2>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-muted-foreground">휴가 종류</h3>
          <Button variant="outline" size="sm" className="gap-1" onClick={openCreate}>
            <Plus className="h-4 w-4" /> 맞춤 휴가 추가
          </Button>
        </div>

        <div className="space-y-1">
          {leaveTypes.map(lt => (
            <div key={lt.id} className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-muted/30 transition-colors border-b last:border-b-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center">
                  {ICON_MAP[lt.icon_name] || ICON_MAP.Calendar}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{lt.name}</span>
                    {lt.is_required && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0 border-primary text-primary">필수</Badge>
                    )}
                  </div>
                  {lt.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{lt.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  {lt.approval_required ? '승인 있음' : '승인 없음'}
                </span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground">
                  {lt.reference_required ? '참조 있음' : '참조 없음'}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEdit(lt)}>
                      <Edit className="h-3.5 w-3.5 mr-2" /> 수정
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onClick={() => { if (confirm('삭제하시겠습니까?')) deleteMutation.mutate(lt.id); }}>
                      <Trash2 className="h-3.5 w-3.5 mr-2" /> 삭제
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingType ? '휴가 종류 수정' : '맞춤 휴가 추가'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-sm">휴가 이름</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="예: 경조사 휴가" className="mt-1" />
            </div>
            <div>
              <Label className="text-sm">설명 (선택)</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="휴가에 대한 설명" className="mt-1" rows={2} />
            </div>
            <div>
              <Label className="text-sm">아이콘</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {Object.entries(ICON_MAP).map(([key, icon]) => (
                  <button key={key} className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-colors ${form.icon_name === key ? 'border-primary bg-primary/10' : 'hover:bg-muted'}`}
                    onClick={() => setForm(f => ({ ...f, icon_name: key }))}>
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-sm">최대 일수 (선택)</Label>
              <Input type="number" value={form.max_days} onChange={e => setForm(f => ({ ...f, max_days: e.target.value }))} placeholder="제한 없음" className="mt-1" />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">법정 필수 휴가</Label>
                <Switch checked={form.is_required} onCheckedChange={v => setForm(f => ({ ...f, is_required: v }))} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">승인 필요</Label>
                <Switch checked={form.approval_required} onCheckedChange={v => setForm(f => ({ ...f, approval_required: v }))} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">참조자 필요</Label>
                <Switch checked={form.reference_required} onCheckedChange={v => setForm(f => ({ ...f, reference_required: v }))} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">유급 휴가</Label>
                <Switch checked={form.paid} onCheckedChange={v => setForm(f => ({ ...f, paid: v }))} />
              </div>
            </div>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.name.trim() || saveMutation.isPending} className="w-full">
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingType ? '수정' : '추가'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomLeaveTypeManager;
