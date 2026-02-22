import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Sparkles, Plus, Trash2, Eye, Volume2, VolumeX, Clock, Calendar } from 'lucide-react';
import { toast } from 'sonner';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
const EMOJI_OPTIONS = ['🎉', '🎊', '🔥', '🌟', '✨', '💪', '🎄', '🎆', '🦉', '🌠', '📅', '🔔', '🎂', '🏆', '💎', '🚀', '🌈', '☕', '🍕', '🎯'];
const GRADIENT_PRESETS = [
  { label: '보라 네온', value: 'from-indigo-500/20 via-purple-500/15 to-pink-500/10 dark:from-indigo-800/40 dark:via-purple-800/30 dark:to-pink-800/20' },
  { label: '불꽃 오렌지', value: 'from-orange-500/20 via-red-500/15 to-pink-500/10 dark:from-orange-800/40 dark:via-red-800/30 dark:to-pink-800/20' },
  { label: '프레시 블루', value: 'from-blue-500/15 via-cyan-500/10 to-teal-500/10 dark:from-blue-800/30 dark:via-cyan-800/20 dark:to-teal-800/15' },
  { label: '자연 그린', value: 'from-emerald-500/15 via-green-500/10 to-lime-500/10 dark:from-emerald-800/30 dark:via-green-800/20 dark:to-lime-800/15' },
  { label: '골드 앰버', value: 'from-amber-400/15 via-yellow-400/10 to-orange-400/10 dark:from-amber-800/25 dark:via-yellow-800/15 dark:to-orange-800/10' },
  { label: '크리스마스', value: 'from-red-500/20 via-green-500/15 to-red-500/10 dark:from-red-800/40 dark:via-green-800/30 dark:to-red-800/20' },
];

type SecretEventRow = {
  id: string;
  name: string;
  emoji: string;
  message: string;
  sub_message: string | null;
  event_type: string;
  trigger_hour: number | null;
  trigger_minute: number | null;
  trigger_day_of_week: number | null;
  trigger_date: number | null;
  trigger_month: number | null;
  gradient: string | null;
  particles: string[] | null;
  sound_enabled: boolean | null;
  sound_freq: number | null;
  is_active: boolean | null;
  display_duration: number | null;
};

const defaultForm = {
  name: '',
  emoji: '🎉',
  message: '',
  sub_message: '',
  trigger_hour: '',
  trigger_minute: '',
  trigger_day_of_week: '',
  trigger_date: '',
  trigger_month: '',
  gradient: GRADIENT_PRESETS[0].value,
  particles: '✨,🎉',
  sound_enabled: false,
  sound_freq: '440',
  display_duration: '10',
};

const SecretEventManager: React.FC = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [previewEvent, setPreviewEvent] = useState<SecretEventRow | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['secret-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('secret_events')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as SecretEventRow[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: typeof defaultForm) => {
      const { error } = await supabase.from('secret_events').insert({
        name: values.name,
        emoji: values.emoji,
        message: values.message,
        sub_message: values.sub_message || null,
        trigger_hour: values.trigger_hour ? parseInt(values.trigger_hour) : null,
        trigger_minute: values.trigger_minute ? parseInt(values.trigger_minute) : null,
        trigger_day_of_week: values.trigger_day_of_week ? parseInt(values.trigger_day_of_week) : null,
        trigger_date: values.trigger_date ? parseInt(values.trigger_date) : null,
        trigger_month: values.trigger_month ? parseInt(values.trigger_month) : null,
        gradient: values.gradient,
        particles: values.particles.split(',').map(p => p.trim()),
        sound_enabled: values.sound_enabled,
        sound_freq: parseInt(values.sound_freq) || 440,
        display_duration: parseInt(values.display_duration) || 10,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['secret-events'] });
      toast.success('시크릿 이벤트가 추가되었습니다!');
      setDialogOpen(false);
      setForm(defaultForm);
    },
    onError: () => toast.error('추가 실패'),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('secret_events').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['secret-events'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('secret_events').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['secret-events'] });
      toast.success('삭제되었습니다');
    },
  });

  const getTriggerLabel = (ev: SecretEventRow) => {
    const parts: string[] = [];
    if (ev.trigger_month != null) parts.push(`${ev.trigger_month}월`);
    if (ev.trigger_date != null) parts.push(`${ev.trigger_date}일`);
    if (ev.trigger_day_of_week != null) parts.push(`${DAY_NAMES[ev.trigger_day_of_week]}요일`);
    if (ev.trigger_hour != null) {
      const min = ev.trigger_minute != null ? `:${String(ev.trigger_minute).padStart(2, '0')}` : ':00';
      parts.push(`${ev.trigger_hour}시${min !== ':00' ? min : ''}`);
    }
    return parts.length ? parts.join(' ') : '항상';
  };

  const handlePreview = (ev: SecretEventRow) => {
    setPreviewEvent(ev);
    setShowPreview(true);
    if (ev.sound_enabled) {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(ev.sound_freq || 440, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime((ev.sound_freq || 440) * 1.5, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.5);
      } catch (e) {}
    }
    setTimeout(() => setShowPreview(false), (ev.display_duration || 10) * 1000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="w-5 h-5 text-primary" />
          시크릿 이벤트 관리
        </CardTitle>
        <CardDescription>특정 시간/날짜에 대시보드에 나타나는 시크릿 메시지를 관리합니다</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 미리보기 배너 */}
        {showPreview && previewEvent && (
          <div
            className={`rounded-xl p-3 bg-gradient-to-r ${previewEvent.gradient} border border-border/30 backdrop-blur-sm animate-secret-banner cursor-pointer relative overflow-hidden`}
            onClick={() => setShowPreview(false)}
          >
            {(previewEvent.particles || []).map((p, i) => (
              <span
                key={i}
                className="absolute text-lg pointer-events-none animate-secret-particle"
                style={{ left: `${Math.random() * 100}%`, top: '-20px', animationDelay: `${Math.random() * 2}s` }}
              >
                {p}
              </span>
            ))}
            <div className="flex items-center gap-2">
              <span className="text-2xl animate-bounce" style={{ animationDuration: '1.5s' }}>{previewEvent.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground">{previewEvent.message}</p>
                <p className="text-xs text-muted-foreground">{previewEvent.sub_message}</p>
              </div>
              <Sparkles className="h-4 w-4 text-primary animate-pulse shrink-0" />
            </div>
          </div>
        )}

        {/* 추가 버튼 */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="w-full">
              <Plus className="w-4 h-4 mr-1" /> 새 시크릿 이벤트 추가
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>시크릿 이벤트 추가</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-[auto_1fr] gap-3 items-end">
                <div>
                  <Label className="text-xs">이모지</Label>
                  <Select value={form.emoji} onValueChange={v => setForm(f => ({ ...f, emoji: v }))}>
                    <SelectTrigger className="w-16"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EMOJI_OPTIONS.map(e => (
                        <SelectItem key={e} value={e}>{e}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">이벤트 이름</Label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="예: 불금 이벤트" />
                </div>
              </div>

              <div>
                <Label className="text-xs">메인 메시지</Label>
                <Input value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="예: 불금이다! 🔥" />
              </div>

              <div>
                <Label className="text-xs">서브 메시지</Label>
                <Input value={form.sub_message} onChange={e => setForm(f => ({ ...f, sub_message: e.target.value }))} placeholder="예: 즐거운 주말 보내세요!" />
              </div>

              <div className="border rounded-lg p-3 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> 트리거 조건 (비워두면 항상)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">시 (0~23)</Label>
                    <Input type="number" min="0" max="23" value={form.trigger_hour} onChange={e => setForm(f => ({ ...f, trigger_hour: e.target.value }))} placeholder="예: 17" />
                  </div>
                  <div>
                    <Label className="text-xs">분 (0~59)</Label>
                    <Input type="number" min="0" max="59" value={form.trigger_minute} onChange={e => setForm(f => ({ ...f, trigger_minute: e.target.value }))} placeholder="예: 30" />
                  </div>
                  <div>
                    <Label className="text-xs">요일</Label>
                    <Select value={form.trigger_day_of_week} onValueChange={v => setForm(f => ({ ...f, trigger_day_of_week: v }))}>
                      <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">없음</SelectItem>
                        {DAY_NAMES.map((d, i) => (
                          <SelectItem key={i} value={String(i)}>{d}요일</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">일 (1~31)</Label>
                    <Input type="number" min="1" max="31" value={form.trigger_date} onChange={e => setForm(f => ({ ...f, trigger_date: e.target.value }))} placeholder="예: 25" />
                  </div>
                  <div>
                    <Label className="text-xs">월 (1~12)</Label>
                    <Input type="number" min="1" max="12" value={form.trigger_month} onChange={e => setForm(f => ({ ...f, trigger_month: e.target.value }))} placeholder="예: 12" />
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-xs">그라디언트 프리셋</Label>
                <Select value={form.gradient} onValueChange={v => setForm(f => ({ ...f, gradient: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GRADIENT_PRESETS.map(g => (
                      <SelectItem key={g.label} value={g.value}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">파티클 이모지 (쉼표 구분)</Label>
                <Input value={form.particles} onChange={e => setForm(f => ({ ...f, particles: e.target.value }))} placeholder="✨,🎉,🎊" />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-xs">효과음</Label>
                <Switch checked={form.sound_enabled} onCheckedChange={v => setForm(f => ({ ...f, sound_enabled: v }))} />
              </div>

              {form.sound_enabled && (
                <div>
                  <Label className="text-xs">주파수 (Hz)</Label>
                  <Input type="number" value={form.sound_freq} onChange={e => setForm(f => ({ ...f, sound_freq: e.target.value }))} />
                </div>
              )}

              <div>
                <Label className="text-xs">표시 시간 (초)</Label>
                <Input type="number" value={form.display_duration} onChange={e => setForm(f => ({ ...f, display_duration: e.target.value }))} />
              </div>

              <Button onClick={() => createMutation.mutate(form)} disabled={!form.name || !form.message || createMutation.isPending} className="w-full">
                {createMutation.isPending ? '추가 중...' : '추가하기'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* 이벤트 목록 */}
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-4">로딩 중...</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">등록된 시크릿 이벤트가 없습니다</p>
        ) : (
          <div className="space-y-2">
            {events.map(ev => (
              <div key={ev.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                <span className="text-2xl shrink-0">{ev.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{ev.name}</p>
                    <Badge variant={ev.is_active ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                      {ev.is_active ? '활성' : '비활성'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{ev.message}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      <Calendar className="w-3 h-3" /> {getTriggerLabel(ev)}
                    </span>
                    {ev.sound_enabled && <Volume2 className="w-3 h-3 text-muted-foreground" />}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handlePreview(ev)} title="미리보기">
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Switch
                    checked={ev.is_active ?? true}
                    onCheckedChange={v => toggleMutation.mutate({ id: ev.id, is_active: v })}
                  />
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => {
                    if (confirm('정말 삭제하시겠습니까?')) deleteMutation.mutate(ev.id);
                  }} title="삭제">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SecretEventManager;
