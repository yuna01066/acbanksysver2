import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { KeyRound, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ResetRequest {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  status: string;
  created_at: string;
}

const PasswordResetRequests = () => {
  const { session, userRole } = useAuth();
  const [requests, setRequests] = useState<ResetRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (userRole === 'admin') {
      fetchRequests();
    }
  }, [userRole]);

  const fetchRequests = async () => {
    const { data, error } = await supabase
      .from('password_reset_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setRequests(data as ResetRequest[]);
    }
    setLoading(false);
  };

  const handleAction = async (requestId: string, action: 'approve' | 'reject') => {
    if (!session) return;
    setProcessingId(requestId);

    try {
      const { data, error } = await supabase.functions.invoke('password-reset', {
        body: { action, requestId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (action === 'approve') {
        toast.success('비밀번호가 1234로 초기화되었습니다.');
      } else {
        toast.success('요청이 거부되었습니다.');
      }
      fetchRequests();
    } catch (err: any) {
      toast.error('처리 중 오류: ' + (err.message || '알 수 없는 오류'));
    } finally {
      setProcessingId(null);
    }
  };

  if (userRole !== 'admin' || loading) return null;
  if (requests.length === 0) return null;

  return (
    <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <KeyRound className="h-4 w-4 text-amber-600" />
          <h3 className="font-semibold text-sm">비밀번호 초기화 요청 ({requests.length}건)</h3>
        </div>
        <div className="space-y-2">
          {requests.map((req) => (
            <div key={req.id} className="flex items-center justify-between bg-background rounded-lg p-3 border">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{req.full_name}</span>
                  <Badge variant="outline" className="text-xs">{req.email}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  전화번호: {req.phone} · {new Date(req.created_at).toLocaleDateString('ko-KR')}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handleAction(req.id, 'approve')}
                  disabled={!!processingId}
                >
                  {processingId === req.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-1" />
                      승인
                    </>
                  )}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleAction(req.id, 'reject')}
                  disabled={!!processingId}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  거부
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default PasswordResetRequests;
