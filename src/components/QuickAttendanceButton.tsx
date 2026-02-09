import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LogIn, LogOut, MapPin, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

const QuickAttendanceButton = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [todayRecord, setTodayRecord] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const today = format(new Date(), 'yyyy-MM-dd');

  const fetchTodayRecord = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle();
    setTodayRecord(data);
    setFetching(false);
  };

  useEffect(() => {
    fetchTodayRecord();
  }, [user]);

  const getLocation = (): Promise<{ lat: number; lng: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 5000 }
      );
    });
  };

  const handleCheckIn = async () => {
    if (!user || !profile) return;
    setLoading(true);
    try {
      const location = await getLocation();
      const now = new Date().toISOString();
      const { error } = await supabase.from('attendance_records').insert({
        user_id: user.id,
        user_name: profile.full_name || user.email || '',
        date: today,
        check_in: now,
        check_in_location: location,
        status: 'present',
      });
      if (error) throw error;
      toast.success('출근이 기록되었습니다.');
      fetchTodayRecord();
    } catch (e: any) {
      toast.error('출근 기록 실패: ' + (e.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!todayRecord) return;
    setLoading(true);
    try {
      const location = await getLocation();
      const now = new Date().toISOString();
      const checkIn = new Date(todayRecord.check_in);
      const workHours = (new Date(now).getTime() - checkIn.getTime()) / (1000 * 60 * 60);
      const { error } = await supabase
        .from('attendance_records')
        .update({
          check_out: now,
          check_out_location: location,
          work_hours: Math.round(workHours * 100) / 100,
        })
        .eq('id', todayRecord.id);
      if (error) throw error;
      toast.success('퇴근이 기록되었습니다.');
      fetchTodayRecord();
    } catch (e: any) {
      toast.error('퇴근 기록 실패: ' + (e.message || ''));
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <Card className="w-full">
        <CardContent className="p-4 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const checkedIn = !!todayRecord?.check_in;
  const checkedOut = !!todayRecord?.check_out;

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">근태 관리</p>
              <div className="flex items-center gap-2 mt-0.5">
                {checkedIn && (
                  <Badge variant="secondary" className="text-xs">
                    출근 {format(new Date(todayRecord.check_in), 'HH:mm')}
                  </Badge>
                )}
                {checkedOut && (
                  <Badge variant="outline" className="text-xs">
                    퇴근 {format(new Date(todayRecord.check_out), 'HH:mm')}
                  </Badge>
                )}
                {!checkedIn && (
                  <span className="text-xs text-muted-foreground">미출근</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!checkedIn ? (
              <Button size="sm" onClick={handleCheckIn} disabled={loading} className="gap-1.5">
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogIn className="h-3.5 w-3.5" />}
                출근
              </Button>
            ) : !checkedOut ? (
              <Button size="sm" variant="outline" onClick={handleCheckOut} disabled={loading} className="gap-1.5">
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
                퇴근
              </Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => navigate('/attendance')} className="gap-1.5 text-xs">
                상세보기
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default QuickAttendanceButton;
