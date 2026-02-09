import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Heart, MessageSquare, Users2, Send, Loader2 } from 'lucide-react';

interface CheckedInEmployee {
  user_id: string;
  user_name: string;
  check_in: string;
  avatar_url?: string | null;
  department?: string | null;
  position?: string | null;
}

type FeedbackType = 'recognition' | 'feedback' | 'one_on_one';
type WorkStatus = 'available' | 'busy' | 'focusing' | 'meeting';

const FEEDBACK_CONFIG: Record<FeedbackType, { label: string; emoji: string; placeholder: string; color: string }> = {
  recognition: { label: '인정 보내기', emoji: '🙏💕', placeholder: '동료의 어떤 점이 인상적이었는지 알려주세요...', color: 'text-pink-600' },
  feedback: { label: '피드백 보내기', emoji: '💬', placeholder: '도움이 될 만한 피드백을 남겨주세요...', color: 'text-blue-600' },
  one_on_one: { label: '1:1 미팅 요청', emoji: '☕', placeholder: '미팅 주제나 이유를 간단히 적어주세요...', color: 'text-amber-600' },
};

const STATUS_CONFIG: Record<WorkStatus, { label: string; emoji: string; color: string; borderColor: string; dotColor: string }> = {
  available: { label: '여유', emoji: '🟢', color: 'text-green-600', borderColor: 'border-green-200 dark:border-green-800', dotColor: 'bg-green-500' },
  busy: { label: '바쁨', emoji: '🔴', color: 'text-red-600', borderColor: 'border-red-200 dark:border-red-800', dotColor: 'bg-red-500' },
  focusing: { label: '집중 중', emoji: '🟡', color: 'text-yellow-600', borderColor: 'border-yellow-200 dark:border-yellow-800', dotColor: 'bg-yellow-500' },
  meeting: { label: '미팅 중', emoji: '🟣', color: 'text-purple-600', borderColor: 'border-purple-200 dark:border-purple-800', dotColor: 'bg-purple-500' },
};

const OnlineEmployeesCard: React.FC = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<CheckedInEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<CheckedInEmployee | null>(null);
  const [feedbackType, setFeedbackType] = useState<FeedbackType | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [activeEmpId, setActiveEmpId] = useState<string | null>(null);

  // Status tracking via Realtime Presence
  const [myStatus, setMyStatus] = useState<WorkStatus>('available');
  const [statusMap, setStatusMap] = useState<Record<string, WorkStatus>>({});
  const [statusPopoverOpen, setStatusPopoverOpen] = useState(false);

  useEffect(() => {
    fetchCheckedInEmployees();
  }, []);

  // Realtime Presence for status
  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel('employee-status', {
      config: { presence: { key: user.id } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const newMap: Record<string, WorkStatus> = {};
        for (const [userId, presences] of Object.entries(state)) {
          const latest = presences[presences.length - 1] as any;
          if (latest?.status) {
            newMap[userId] = latest.status as WorkStatus;
          }
        }
        setStatusMap(newMap);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ status: myStatus, online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Update presence when status changes
  const updateMyStatus = useCallback(async (newStatus: WorkStatus) => {
    setMyStatus(newStatus);
    setStatusPopoverOpen(false);

    const channel = supabase.channel('employee-status');
    await channel.track({ status: newStatus, online_at: new Date().toISOString() });
    toast.success(`상태가 "${STATUS_CONFIG[newStatus].label}"(으)로 변경되었습니다`);
  }, []);

  const fetchCheckedInEmployees = async () => {
    const today = new Date().toISOString().split('T')[0];
    
    const { data: attendanceData, error: attError } = await supabase
      .from('attendance_records')
      .select('user_id, user_name, check_in')
      .eq('date', today)
      .in('status', ['checked_in', 'present']);

    if (attError || !attendanceData) {
      setLoading(false);
      return;
    }

    const userIds = attendanceData.map(a => a.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, avatar_url, department, position')
      .in('id', userIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

    const merged = attendanceData.map(a => ({
      ...a,
      avatar_url: profileMap.get(a.user_id)?.avatar_url,
      department: profileMap.get(a.user_id)?.department,
      position: profileMap.get(a.user_id)?.position,
    }));

    setEmployees(merged);
    setLoading(false);
  };

  // Sort: current user first
  const sortedEmployees = React.useMemo(() => {
    if (!user) return employees;
    return [...employees].sort((a, b) => {
      if (a.user_id === user.id) return -1;
      if (b.user_id === user.id) return 1;
      return 0;
    });
  }, [employees, user]);

  const handleSendFeedback = async () => {
    if (!user || !selectedEmployee || !feedbackType || !message.trim()) return;
    setSending(true);
    try {
      const { error } = await supabase.from('peer_feedback').insert({
        sender_id: user.id,
        receiver_id: selectedEmployee.user_id,
        feedback_type: feedbackType,
        message: message.trim(),
        emoji: FEEDBACK_CONFIG[feedbackType].emoji,
      });
      if (error) throw error;

      await supabase.from('notifications').insert({
        user_id: selectedEmployee.user_id,
        type: 'peer_feedback',
        title: feedbackType === 'recognition' ? '🙏 인정을 받았어요!' : feedbackType === 'one_on_one' ? '☕ 1:1 미팅 요청' : '💬 피드백이 도착했어요',
        description: message.trim().substring(0, 100),
      });

      toast.success('전송되었습니다!');
      setSelectedEmployee(null);
      setFeedbackType(null);
      setMessage('');
    } catch (e: any) {
      toast.error('전송 실패: ' + (e.message || ''));
    } finally {
      setSending(false);
    }
  };

  const openFeedbackDialog = (emp: CheckedInEmployee, type: FeedbackType) => {
    setSelectedEmployee(emp);
    setFeedbackType(type);
    setMessage('');
  };

  const getEmployeeStatus = (userId: string): WorkStatus => {
    return statusMap[userId] || 'available';
  };

  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border bg-card p-5 shadow-sm animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Users2 className="h-4 w-4 text-green-500" />
            현재 출근 중
            <Badge variant="secondary" className="text-xs">{employees.length}명</Badge>
          </h3>
        </div>

        {employees.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-3">현재 출근한 직원이 없습니다.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {sortedEmployees.map(emp => {
              const isMe = user && emp.user_id === user.id;
              const empStatus = getEmployeeStatus(emp.user_id);
              const statusCfg = STATUS_CONFIG[empStatus];

              return (
                <div key={emp.user_id} className="relative">
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="relative">
                      {isMe ? (
                        <Popover open={statusPopoverOpen} onOpenChange={setStatusPopoverOpen}>
                          <PopoverTrigger asChild>
                            <Avatar
                              className={`h-16 w-16 rounded-lg border-2 ${statusCfg.borderColor} shadow-md cursor-pointer transition-transform hover:scale-110 ring-2 ring-primary/30`}
                            >
                              <AvatarImage src={emp.avatar_url || undefined} alt={emp.user_name} className="object-cover" />
                              <AvatarFallback className="rounded-lg bg-primary/10 text-primary text-sm font-semibold">
                                {emp.user_name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                          </PopoverTrigger>
                          <PopoverContent className="w-44 p-1.5" side="bottom" align="center">
                            <p className="text-[10px] font-medium text-muted-foreground px-2 py-1">내 상태 변경</p>
                            {(Object.entries(STATUS_CONFIG) as [WorkStatus, typeof STATUS_CONFIG[WorkStatus]][]).map(([key, cfg]) => (
                              <button
                                key={key}
                                onClick={() => updateMyStatus(key)}
                                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                                  myStatus === key ? 'bg-accent font-medium' : 'hover:bg-muted'
                                }`}
                              >
                                <span>{cfg.emoji}</span>
                                <span>{cfg.label}</span>
                              </button>
                            ))}
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <Avatar
                          className={`h-12 w-12 rounded-lg border-2 ${statusCfg.borderColor} shadow-sm cursor-pointer transition-transform hover:scale-110`}
                          onClick={() => {
                            setActiveEmpId(activeEmpId === emp.user_id ? null : emp.user_id);
                          }}
                        >
                          <AvatarImage src={emp.avatar_url || undefined} alt={emp.user_name} className="object-cover" />
                          <AvatarFallback className="rounded-lg bg-primary/10 text-primary text-sm font-semibold">
                            {emp.user_name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ${statusCfg.dotColor} border-2 border-card`} />
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-xs text-muted-foreground font-medium max-w-[56px] truncate">
                        {isMe ? '나' : emp.user_name}
                      </span>
                      {empStatus !== 'available' && (
                        <span className={`text-[9px] ${statusCfg.color} font-medium`}>
                          {statusCfg.label}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Click-triggered actions for others */}
                  {user && !isMe && activeEmpId === emp.user_id && (
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full z-10 animate-fade-in">
                      <div className="bg-card border rounded-lg shadow-lg p-1.5 flex gap-1 whitespace-nowrap">
                        <button
                          onClick={() => { openFeedbackDialog(emp, 'recognition'); setActiveEmpId(null); }}
                          className="p-1.5 rounded-md hover:bg-pink-50 dark:hover:bg-pink-950/30 transition-colors text-sm"
                          title="인정 보내기"
                        >🙏</button>
                        <button
                          onClick={() => { openFeedbackDialog(emp, 'feedback'); setActiveEmpId(null); }}
                          className="p-1.5 rounded-md hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors text-sm"
                          title="피드백 보내기"
                        >💬</button>
                        <button
                          onClick={() => { openFeedbackDialog(emp, 'one_on_one'); setActiveEmpId(null); }}
                          className="p-1.5 rounded-md hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors text-sm"
                          title="1:1 미팅 요청"
                        >☕</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Recognition CTA */}
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-start gap-3">
            <div className="text-2xl">🙏💕</div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">동료들을 응원해요!</p>
              <p className="text-xs text-muted-foreground">함께하는 동료들에게 인정 메시지를 보낼 수 있어요.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Dialog */}
      <Dialog open={!!selectedEmployee && !!feedbackType} onOpenChange={(open) => { if (!open) { setSelectedEmployee(null); setFeedbackType(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {feedbackType && <span>{FEEDBACK_CONFIG[feedbackType].emoji}</span>}
              {feedbackType && FEEDBACK_CONFIG[feedbackType].label}
            </DialogTitle>
          </DialogHeader>
          {selectedEmployee && feedbackType && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Avatar className="h-10 w-10 rounded-lg">
                  <AvatarImage src={selectedEmployee.avatar_url || undefined} className="object-cover" />
                  <AvatarFallback className="rounded-lg bg-primary/10 text-primary">
                    {selectedEmployee.user_name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{selectedEmployee.user_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedEmployee.department || '부서 미설정'}
                    {selectedEmployee.position && ` · ${selectedEmployee.position}`}
                  </p>
                </div>
              </div>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={FEEDBACK_CONFIG[feedbackType].placeholder}
                rows={4}
                className="resize-none"
                maxLength={500}
              />
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">{message.length}/500</span>
                <Button onClick={handleSendFeedback} disabled={!message.trim() || sending} className="gap-2">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  보내기
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default OnlineEmployeesCard;
