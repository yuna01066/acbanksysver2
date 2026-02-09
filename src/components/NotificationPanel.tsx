import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, X, CheckCircle, XCircle, Trash2, KeyRound, UserPlus, Loader2, Megaphone, FileText, UserCheck, Edit, CalendarDays, CalendarCheck, CalendarX, Heart } from 'lucide-react';
import { AppNotification } from '@/hooks/useNotifications';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface NotificationPanelProps {
  notifications: AppNotification[];
  unviewedCount: number;
  onMarkViewed: () => void;
  onRemove: (id: string) => void;
  onRefresh: () => void;
}

const NotificationPanel = ({
  notifications,
  unviewedCount,
  onMarkViewed,
  onRemove,
  onRefresh,
}: NotificationPanelProps) => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleOpen = () => {
    setOpen(true);
    onMarkViewed();
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleApproveResetRequest = async (notification: AppNotification) => {
    if (!session) return;
    setProcessingId(notification.id);
    try {
      const { data, error } = await supabase.functions.invoke('password-reset', {
        body: { action: 'approve', requestId: notification.data?.requestId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('비밀번호가 1234로 초기화되었습니다.');
      onRemove(notification.id);
      onRefresh();
    } catch (err: any) {
      toast.error('처리 실패: ' + (err.message || '알 수 없는 오류'));
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectResetRequest = async (notification: AppNotification) => {
    if (!session) return;
    setProcessingId(notification.id);
    try {
      const { data, error } = await supabase.functions.invoke('password-reset', {
        body: { action: 'reject', requestId: notification.data?.requestId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      toast.success('요청이 거부되었습니다.');
      onRemove(notification.id);
      onRefresh();
    } catch (err: any) {
      toast.error('처리 실패: ' + (err.message || '알 수 없는 오류'));
    } finally {
      setProcessingId(null);
    }
  };

  const handleApproveUser = async (notification: AppNotification) => {
    setProcessingId(notification.id);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_approved: true })
        .eq('id', notification.data?.userId);
      if (error) throw error;
      toast.success('사용자가 승인되었습니다.');
      onRemove(notification.id);
      onRefresh();
    } catch (err: any) {
      toast.error('승인 실패: ' + (err.message || '알 수 없는 오류'));
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectUser = async (notification: AppNotification) => {
    if (!session) return;
    setProcessingId(notification.id);
    try {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId: notification.data?.userId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      toast.success('사용자가 거부(삭제)되었습니다.');
      onRemove(notification.id);
      onRefresh();
    } catch (err: any) {
      toast.error('처리 실패: ' + (err.message || '알 수 없는 오류'));
    } finally {
      setProcessingId(null);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'password_reset':
        return <KeyRound className="h-4 w-4 text-warning" />;
      case 'pending_approval':
        return <UserPlus className="h-4 w-4 text-primary" />;
      case 'system':
        return <Megaphone className="h-4 w-4 text-accent" />;
      case 'quote_update':
        return <FileText className="h-4 w-4 text-primary" />;
      case 'approval_complete':
        return <UserCheck className="h-4 w-4 text-primary" />;
      case 'quote_modified':
        return <Edit className="h-4 w-4 text-accent" />;
      case 'leave_request':
        return <CalendarDays className="h-4 w-4 text-yellow-500" />;
      case 'leave_approved':
        return <CalendarCheck className="h-4 w-4 text-green-500" />;
      case 'leave_rejected':
        return <CalendarX className="h-4 w-4 text-red-500" />;
      case 'peer_feedback':
        return <Heart className="h-4 w-4 text-pink-500" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  return (
    <>
      {/* Bell Button */}
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={handleOpen}
      >
        <Bell className="h-5 w-5" />
        {unviewedCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
            {unviewedCount > 99 ? '99+' : unviewedCount}
          </span>
        )}
      </Button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-40"
          onClick={handleClose}
        />
      )}

      {/* Side Panel */}
      <div
        className={cn(
          "fixed top-0 left-0 h-full w-[380px] max-w-[90vw] bg-background border-r shadow-xl z-50 transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-lg">알림</h2>
            {notifications.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {notifications.length}
              </Badge>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="h-[calc(100%-65px)]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Bell className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">새로운 알림이 없습니다</p>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="rounded-lg border bg-card p-3 space-y-2"
                >
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5">{getIcon(notification.type)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{notification.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {notification.description}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        {new Date(notification.created_at).toLocaleDateString('ko-KR', {
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-1.5 justify-end">
                    {notification.type === 'password_reset' && (
                      <>
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 text-xs"
                          onClick={() => handleApproveResetRequest(notification)}
                          disabled={!!processingId}
                        >
                          {processingId === notification.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle className="h-3 w-3 mr-1" />
                              승인
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => handleRejectResetRequest(notification)}
                          disabled={!!processingId}
                        >
                          <XCircle className="h-3 w-3 mr-1" />
                          거부
                        </Button>
                      </>
                    )}

                    {notification.type === 'pending_approval' && (
                      <>
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 text-xs"
                          onClick={() => handleApproveUser(notification)}
                          disabled={!!processingId}
                        >
                          {processingId === notification.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle className="h-3 w-3 mr-1" />
                              승인
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 text-xs"
                          onClick={() => handleRejectUser(notification)}
                          disabled={!!processingId}
                        >
                          <XCircle className="h-3 w-3 mr-1" />
                          거부
                        </Button>
                      </>
                    )}

                    {notification.type === 'system' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => {
                          navigate('/announcements');
                          setOpen(false);
                        }}
                      >
                        <Megaphone className="h-3 w-3 mr-1" />
                        바로가기
                      </Button>
                    )}

                    {(notification.type === 'quote_update' || notification.type === 'quote_modified') && notification.data?.quoteId && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => {
                          navigate(`/saved-quotes/${notification.data?.quoteId}`);
                          setOpen(false);
                        }}
                      >
                        <FileText className="h-3 w-3 mr-1" />
                        바로가기
                      </Button>
                    )}

                    {(notification.type === 'leave_request' || notification.type === 'leave_approved' || notification.type === 'leave_rejected') && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => {
                          navigate('/leave-management');
                          setOpen(false);
                        }}
                      >
                        <CalendarDays className="h-3 w-3 mr-1" />
                        바로가기
                      </Button>
                    )}

                    {notification.type === 'peer_feedback' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => {
                          navigate('/my-page');
                          setOpen(false);
                        }}
                      >
                        <Heart className="h-3 w-3 mr-1" />
                        바로가기
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-muted-foreground"
                      onClick={() => onRemove(notification.id)}
                      disabled={!!processingId}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </>
  );
};

export default NotificationPanel;
