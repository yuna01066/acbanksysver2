import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Heart, MessageSquare, Users2, Send, Loader2, CalendarIcon, Clock } from 'lucide-react';
import { useProjectSuggestions, TaggableProject } from '@/hooks/useProjectSuggestions';
import ProjectDropdown from '@/components/chat/ProjectDropdown';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface CheckedInEmployee {
  user_id: string;
  user_name: string;
  check_in: string;
  avatar_url?: string | null;
  department?: string | null;
  position?: string | null;
}

type FeedbackType = 'recognition' | 'feedback' | 'one_on_one' | 'meeting';
type WorkStatus = 'available' | 'busy' | 'focusing' | 'meeting';

const FEEDBACK_CONFIG: Record<FeedbackType, { label: string; emoji: string; placeholder: string; color: string }> = {
  recognition: { label: '인정 보내기', emoji: '❤️', placeholder: '동료의 어떤 점이 인상적이었는지 알려주세요...', color: 'text-pink-600' },
  feedback: { label: '피드백 보내기', emoji: '💬', placeholder: '도움이 될 만한 피드백을 남겨주세요...', color: 'text-blue-600' },
  one_on_one: { label: '업무 요청', emoji: '🙏', placeholder: '요청할 업무 내용을 간단히 적어주세요...', color: 'text-amber-600' },
  meeting: { label: '1:1 미팅 요청', emoji: '☕', placeholder: '미팅 주제나 이유를 간단히 적어주세요...', color: 'text-orange-600' },
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Project tagging
  const { filterProjects } = useProjectSuggestions();
  const [projectQuery, setProjectQuery] = useState('');
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [projectSelectedIndex, setProjectSelectedIndex] = useState(0);
  const projectResults = showProjectDropdown ? filterProjects(projectQuery) : [];

  // Meeting date/time
  const [meetingDate, setMeetingDate] = useState<Date | undefined>(undefined);
  const [meetingTime, setMeetingTime] = useState<string>('');

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
      let finalMessage = message.trim();
      if (feedbackType === 'meeting' && meetingDate) {
        const dateStr = format(meetingDate, 'yyyy-MM-dd (EEE)', { locale: ko });
        const timeStr = meetingTime || '시간 미정';
        finalMessage = `📅 ${dateStr} ${timeStr}\n${finalMessage}`;
      }

      const insertData: any = {
        sender_id: user.id,
        receiver_id: selectedEmployee.user_id,
        feedback_type: feedbackType,
        message: finalMessage,
        emoji: FEEDBACK_CONFIG[feedbackType].emoji,
      };

      if (feedbackType === 'meeting') {
        insertData.meeting_date = meetingDate ? format(meetingDate, 'yyyy-MM-dd') : null;
        insertData.meeting_time = meetingTime || null;
        insertData.meeting_status = 'pending';
      }

      const { error } = await supabase.from('peer_feedback').insert(insertData);
      if (error) throw error;

      // Also create a DM so the conversation appears in the messenger
      const feedbackLabel = FEEDBACK_CONFIG[feedbackType].label;
      const dmMessage = `[${feedbackLabel}] ${finalMessage}`;
      await supabase.from('direct_messages').insert({
        sender_id: user.id,
        receiver_id: selectedEmployee.user_id,
        message: dmMessage,
      });

      await supabase.from('notifications').insert({
        user_id: selectedEmployee.user_id,
        type: 'peer_feedback',
        title: feedbackType === 'recognition' ? '❤️ 인정을 받았어요!' : feedbackType === 'one_on_one' ? '🙏 업무 요청이 도착했어요' : feedbackType === 'meeting' ? '☕ 1:1 미팅 요청' : '💬 피드백이 도착했어요',
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
    setShowProjectDropdown(false);
    setMeetingDate(undefined);
    setMeetingTime('');
  };

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setMessage(val);

    const cursorPos = e.target.selectionStart || val.length;
    const textBeforeCursor = val.slice(0, cursorPos);
    const projectMatch = textBeforeCursor.match(/#([^\s]*)$/);
    if (projectMatch) {
      setShowProjectDropdown(true);
      setProjectQuery(projectMatch[1]);
      setProjectSelectedIndex(0);
    } else {
      setShowProjectDropdown(false);
    }
  };

  const insertProjectTag = (project: TaggableProject) => {
    const cursorPos = textareaRef.current?.selectionStart || message.length;
    const before = message.slice(0, cursorPos).replace(/#([^\s]*)$/, '');
    const after = message.slice(cursorPos);
    const tagText = project.title.replace(/\s+/g, '_');
    setMessage(`${before}#${tagText} ${after}`);
    setShowProjectDropdown(false);
    textareaRef.current?.focus();
  };

  const handleMessageKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showProjectDropdown || projectResults.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setProjectSelectedIndex(i => (i + 1) % projectResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setProjectSelectedIndex(i => (i - 1 + projectResults.length) % projectResults.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      insertProjectTag(projectResults[projectSelectedIndex]);
    } else if (e.key === 'Escape') {
      setShowProjectDropdown(false);
    }
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
      <div className="rounded-xl border bg-card p-5 shadow-sm animate-fade-in flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Users2 className="h-4 w-4 text-green-500" />
            현재 출근 중
            <Badge variant="secondary" className="text-xs">{employees.length}명</Badge>
          </h3>
        </div>

        <div className="flex-1">
          {employees.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-3">현재 출근한 직원이 없습니다.</p>
          ) : (
            <div className="space-y-4">
              {/* My avatar row */}
              {sortedEmployees.filter(emp => user && emp.user_id === user.id).map(emp => {
                const empStatus = getEmployeeStatus(emp.user_id);
                const statusCfg = STATUS_CONFIG[empStatus];
                return (
                  <div key={emp.user_id} className="flex flex-wrap gap-3">
                    <div className="relative">
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="relative">
                          <Popover open={statusPopoverOpen} onOpenChange={setStatusPopoverOpen}>
                            <PopoverTrigger asChild>
                              <Avatar
                                className={`h-20 w-20 rounded-xl border-2 ${statusCfg.borderColor} shadow-md cursor-pointer transition-transform hover:scale-110 ring-2 ring-primary/30`}
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
                          <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ${statusCfg.dotColor} border-2 border-card`} />
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-xs text-muted-foreground font-medium max-w-[56px] truncate">나</span>
                          {empStatus !== 'available' && (
                            <span className={`text-[9px] ${statusCfg.color} font-medium`}>
                              {statusCfg.label}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Others row */}
              {sortedEmployees.filter(emp => !(user && emp.user_id === user.id)).length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {sortedEmployees.filter(emp => !(user && emp.user_id === user.id)).map(emp => {
                    const empStatus = getEmployeeStatus(emp.user_id);
                    const statusCfg = STATUS_CONFIG[empStatus];
                    return (
                      <div key={emp.user_id} className="relative">
                        <div className="flex flex-col items-center gap-1.5">
                          <div className="relative">
                            <Avatar
                              className={`h-16 w-16 rounded-xl border-2 ${statusCfg.borderColor} shadow-sm cursor-pointer transition-transform hover:scale-110`}
                              onClick={() => {
                                setActiveEmpId(activeEmpId === emp.user_id ? null : emp.user_id);
                              }}
                            >
                              <AvatarImage src={emp.avatar_url || undefined} alt={emp.user_name} className="object-cover" />
                              <AvatarFallback className="rounded-lg bg-primary/10 text-primary text-sm font-semibold">
                                {emp.user_name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ${statusCfg.dotColor} border-2 border-card`} />
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="text-xs text-muted-foreground font-medium max-w-[56px] truncate">
                              {emp.user_name}
                            </span>
                            {empStatus !== 'available' && (
                              <span className={`text-[9px] ${statusCfg.color} font-medium`}>
                                {statusCfg.label}
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Click-triggered actions */}
                        {user && activeEmpId === emp.user_id && (
                          <div className="absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full z-10 animate-fade-in">
                            <div className="bg-card border rounded-lg shadow-lg p-1.5 flex gap-1 whitespace-nowrap">
                              <button
                                onClick={() => { openFeedbackDialog(emp, 'recognition'); setActiveEmpId(null); }}
                                className="p-1.5 rounded-md hover:bg-pink-50 dark:hover:bg-pink-950/30 transition-colors text-sm"
                                title="인정 보내기"
                              >❤️</button>
                              <button
                                onClick={() => { openFeedbackDialog(emp, 'feedback'); setActiveEmpId(null); }}
                                className="p-1.5 rounded-md hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors text-sm"
                                title="피드백 보내기"
                              >💬</button>
                              <button
                                onClick={() => { openFeedbackDialog(emp, 'one_on_one'); setActiveEmpId(null); }}
                                className="p-1.5 rounded-md hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors text-sm"
                                title="업무 요청"
                              >🙏</button>
                              <button
                                onClick={() => { openFeedbackDialog(emp, 'meeting'); setActiveEmpId(null); }}
                                className="p-1.5 rounded-md hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-colors text-sm"
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
            </div>
          )}
        </div>

        {/* Feature guide - bottom aligned */}
        <div className="mt-auto pt-4 border-t space-y-2">
          <p className="text-[11px] font-semibold text-muted-foreground">💡 사용 방법</p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span>❤️</span><span>인정 보내기</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>💬</span><span>피드백 보내기</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>🙏</span><span>업무 요청</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>☕</span><span>1:1 미팅 요청</span>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground/70">동료 아바타를 클릭하면 메시지를 보낼 수 있어요. #으로 프로젝트 태그도 가능!</p>
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
              <div className="relative">
                {showProjectDropdown && projectResults.length > 0 && (
                  <ProjectDropdown
                    projects={projectResults}
                    selectedIndex={projectSelectedIndex}
                    onSelect={insertProjectTag}
                  />
                )}
                <Textarea
                  ref={textareaRef}
                  value={message}
                  onChange={handleMessageChange}
                  onKeyDown={handleMessageKeyDown}
                  placeholder={`${FEEDBACK_CONFIG[feedbackType].placeholder}\n#으로 프로젝트를 태그할 수 있어요`}
                  rows={4}
                  className="resize-none"
                  maxLength={500}
                />
              </div>
              {feedbackType === 'meeting' && (
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn("flex-1 justify-start text-left font-normal", !meetingDate && "text-muted-foreground")}>
                        <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                        {meetingDate ? format(meetingDate, 'MM/dd (EEE)', { locale: ko }) : '날짜 선택'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={meetingDate}
                        onSelect={setMeetingDate}
                        disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                  <Select value={meetingTime} onValueChange={setMeetingTime}>
                    <SelectTrigger className="w-[120px]">
                      <Clock className="h-3.5 w-3.5 mr-1.5" />
                      <SelectValue placeholder="시간" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 19 }, (_, i) => {
                        const h = Math.floor(i / 2) + 9;
                        const m = i % 2 === 0 ? '00' : '30';
                        const time = `${String(h).padStart(2, '0')}:${m}`;
                        // Filter out past times if selected date is today
                        const now = new Date();
                        const isToday = meetingDate && 
                          meetingDate.getFullYear() === now.getFullYear() && 
                          meetingDate.getMonth() === now.getMonth() && 
                          meetingDate.getDate() === now.getDate();
                        if (isToday && (h < now.getHours() || (h === now.getHours() && parseInt(m) <= now.getMinutes()))) {
                          return null;
                        }
                        return <SelectItem key={time} value={time}>{time}</SelectItem>;
                      }).filter(Boolean)}
                    </SelectContent>
                  </Select>
                </div>
              )}
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
