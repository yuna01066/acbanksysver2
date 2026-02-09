import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

const FEEDBACK_CONFIG: Record<FeedbackType, { label: string; emoji: string; placeholder: string; color: string }> = {
  recognition: { label: '인정 보내기', emoji: '🙏💕', placeholder: '동료의 어떤 점이 인상적이었는지 알려주세요...', color: 'text-pink-600' },
  feedback: { label: '피드백 보내기', emoji: '💬', placeholder: '도움이 될 만한 피드백을 남겨주세요...', color: 'text-blue-600' },
  one_on_one: { label: '1:1 미팅 요청', emoji: '☕', placeholder: '미팅 주제나 이유를 간단히 적어주세요...', color: 'text-amber-600' },
};

const OnlineEmployeesCard: React.FC = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<CheckedInEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<CheckedInEmployee | null>(null);
  const [feedbackType, setFeedbackType] = useState<FeedbackType | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchCheckedInEmployees();
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

    // Fetch profiles for avatar
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

      // Create notification for receiver
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
            {employees.map(emp => (
              <div key={emp.user_id} className="group relative">
                <div className="flex flex-col items-center gap-1.5">
                  <div className="relative">
                    <Avatar className="h-12 w-12 rounded-lg border-2 border-green-200 dark:border-green-800 shadow-sm cursor-pointer transition-transform hover:scale-110">
                      <AvatarImage src={emp.avatar_url || undefined} alt={emp.user_name} className="object-cover" />
                      <AvatarFallback className="rounded-lg bg-primary/10 text-primary text-sm font-semibold">
                        {emp.user_name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 border-2 border-card" />
                  </div>
                  <span className="text-xs text-muted-foreground font-medium max-w-[56px] truncate">{emp.user_name}</span>
                </div>
                {/* Hover actions */}
                {user && emp.user_id !== user.id && (
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full opacity-0 group-hover:opacity-100 transition-all duration-200 z-10 pointer-events-none group-hover:pointer-events-auto">
                    <div className="bg-card border rounded-lg shadow-lg p-1.5 flex gap-1 whitespace-nowrap">
                      <button
                        onClick={() => openFeedbackDialog(emp, 'recognition')}
                        className="p-1.5 rounded-md hover:bg-pink-50 dark:hover:bg-pink-950/30 transition-colors text-sm"
                        title="인정 보내기"
                      >🙏</button>
                      <button
                        onClick={() => openFeedbackDialog(emp, 'feedback')}
                        className="p-1.5 rounded-md hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors text-sm"
                        title="피드백 보내기"
                      >💬</button>
                      <button
                        onClick={() => openFeedbackDialog(emp, 'one_on_one')}
                        className="p-1.5 rounded-md hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors text-sm"
                        title="1:1 미팅 요청"
                      >☕</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
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
