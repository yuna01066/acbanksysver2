import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Loader2, CalendarDays, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface Holiday {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_recurring: boolean;
  holiday_type: string;
  substitute_holiday: boolean;
}

const HOLIDAY_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  public: { label: '법정 공휴일', color: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400' },
  custom: { label: '회사 지정', color: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400' },
};

const CompanyHolidayManager: React.FC = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Holiday | null>(null);
  const [form, setForm] = useState({
    name: '',
    start_date: '',
    end_date: '',
    is_recurring: false,
    holiday_type: 'custom',
    substitute_holiday: false,
  });

  const { data: holidays, isLoading } = useQuery({
    queryKey: ['company-holidays'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_holidays')
        .select('*')
        .order('start_date', { ascending: true });
      if (error) throw error;
      return data as Holiday[];
    },
  });

  const resetForm = () => {
    setForm({ name: '', start_date: '', end_date: '', is_recurring: false, holiday_type: 'custom', substitute_holiday: false });
    setEditing(null);
  };

  const openEdit = (h: Holiday) => {
    setEditing(h);
    setForm({
      name: h.name,
      start_date: h.start_date,
      end_date: h.end_date,
      is_recurring: h.is_recurring,
      holiday_type: h.holiday_type,
      substitute_holiday: h.substitute_holiday,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.start_date) {
      toast.error('이름과 시작일을 입력하세요');
      return;
    }
    try {
      const payload = {
        ...form,
        end_date: form.end_date || form.start_date,
      };
      if (editing) {
        const { error } = await supabase
          .from('company_holidays')
          .update(payload)
          .eq('id', editing.id);
        if (error) throw error;
        toast.success('휴일이 수정되었습니다');
      } else {
        const { error } = await supabase
          .from('company_holidays')
          .insert(payload);
        if (error) throw error;
        toast.success('휴일이 추가되었습니다');
      }
      queryClient.invalidateQueries({ queryKey: ['company-holidays'] });
      setDialogOpen(false);
      resetForm();
    } catch (e: any) {
      toast.error('저장 실패: ' + (e.message || ''));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 휴일을 삭제하시겠습니까?')) return;
    const { error } = await supabase.from('company_holidays').delete().eq('id', id);
    if (error) {
      toast.error('삭제 실패');
      return;
    }
    toast.success('삭제되었습니다');
    queryClient.invalidateQueries({ queryKey: ['company-holidays'] });
  };

  const formatDateRange = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    const sf = format(s, 'M월 d일', { locale: ko });
    if (start === end) return sf;
    return `${sf} ~ ${format(e, 'M월 d일', { locale: ko })}`;
  };

  const totalCount = holidays?.length || 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="h-5 w-5" /> 쉬는 날
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              2026년 <span className="font-semibold text-primary">총 {totalCount}일</span> · 법정 공휴일과 함께, 회사 지정 휴일도 정할 수 있어요.
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" /> 쉬는 날 추가
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editing ? '휴일 수정' : '쉬는 날 추가'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label>휴일 이름</Label>
                  <Input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} placeholder="예: 창립기념일" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>시작일</Label>
                    <Input type="date" value={form.start_date} onChange={(e) => setForm(p => ({ ...p, start_date: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>종료일</Label>
                    <Input type="date" value={form.end_date} onChange={(e) => setForm(p => ({ ...p, end_date: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>유형</Label>
                  <Select value={form.holiday_type} onValueChange={(v) => setForm(p => ({ ...p, holiday_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">법정 공휴일</SelectItem>
                      <SelectItem value="custom">회사 지정 휴일</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Label>매년 반복</Label>
                  <Switch checked={form.is_recurring} onCheckedChange={(v) => setForm(p => ({ ...p, is_recurring: v }))} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>토·일요일 대체휴일</Label>
                  <Switch checked={form.substitute_holiday} onCheckedChange={(v) => setForm(p => ({ ...p, substitute_holiday: v }))} />
                </div>
                <Button onClick={handleSave} className="w-full">{editing ? '수정' : '추가'}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !holidays?.length ? (
          <p className="text-sm text-muted-foreground text-center py-8">등록된 휴일이 없습니다</p>
        ) : (
          <div className="space-y-1">
            {holidays.map((h) => {
              const typeInfo = HOLIDAY_TYPE_LABELS[h.holiday_type] || HOLIDAY_TYPE_LABELS.custom;
              return (
                <div key={h.id} className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-muted/50 transition-colors group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{h.name}</p>
                    <p className="text-xs text-muted-foreground">{formatDateRange(h.start_date, h.end_date)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {h.substitute_holiday && (
                      <Badge variant="outline" className="text-[10px] h-5">토·일요일 대체휴일</Badge>
                    )}
                    {h.is_recurring && (
                      <Badge variant="secondary" className="text-[10px] h-5">매년</Badge>
                    )}
                    <Badge className={`text-[10px] h-5 ${typeInfo.color} border-0`}>{typeInfo.label}</Badge>
                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => openEdit(h)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => handleDelete(h.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CompanyHolidayManager;
