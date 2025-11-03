import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, TrendingUp, Lock, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface UserStatistics {
  user_id: string;
  email: string;
  full_name: string;
  quote_count: number;
  total_amount: number;
  avg_amount: number;
}

const UserStatisticsPage = () => {
  const navigate = useNavigate();
  const { userRole, loading: authLoading } = useAuth();
  const [statistics, setStatistics] = useState<UserStatistics[]>([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (!authLoading && userRole !== 'admin' && userRole !== 'moderator') {
      navigate('/');
    }
  }, [authLoading, userRole, navigate]);

  useEffect(() => {
    if (!authLoading && (userRole === 'admin' || userRole === 'moderator')) {
      fetchStatistics();
    }
  }, [authLoading, userRole]);

  const fetchStatistics = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('saved_quotes')
        .select('user_id, total, created_at');

      if (startDate) {
        query = query.gte('created_at', new Date(startDate).toISOString());
      }
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        query = query.lte('created_at', endDateTime.toISOString());
      }

      const { data: quotesData, error: quotesError } = await query;

      if (quotesError) throw quotesError;

      // Group by user_id and calculate statistics
      const userStats = new Map<string, { quote_count: number; total_amount: number }>();
      
      quotesData?.forEach((quote) => {
        if (!quote.user_id) return;
        
        const existing = userStats.get(quote.user_id) || { quote_count: 0, total_amount: 0 };
        userStats.set(quote.user_id, {
          quote_count: existing.quote_count + 1,
          total_amount: existing.total_amount + Number(quote.total || 0)
        });
      });

      // Fetch user profiles
      const userIds = Array.from(userStats.keys());
      if (userIds.length === 0) {
        setStatistics([]);
        setLoading(false);
        return;
      }

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Combine data
      const statsArray: UserStatistics[] = profilesData?.map((profile) => {
        const stats = userStats.get(profile.id)!;
        return {
          user_id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
          quote_count: stats.quote_count,
          total_amount: stats.total_amount,
          avg_amount: stats.total_amount / stats.quote_count
        };
      }) || [];

      // Sort by total_amount descending
      statsArray.sort((a, b) => b.total_amount - a.total_amount);

      setStatistics(statsArray);
    } catch (error: any) {
      console.error('Error fetching statistics:', error);
      toast.error('통계 데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW'
    }).format(amount);
  };

  const handleApplyFilter = () => {
    fetchStatistics();
  };

  const handleResetFilter = () => {
    setStartDate('');
    setEndDate('');
    setTimeout(() => fetchStatistics(), 0);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-muted-foreground">로딩 중...</div>
        </div>
      </div>
    );
  }

  if (userRole !== 'admin' && userRole !== 'moderator') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <Lock className="w-6 h-6 text-destructive" />
            </div>
            <CardTitle>접근 권한 없음</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              이 페이지에 접근할 권한이 없습니다.
            </p>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => navigate('/admin-settings')}
              className="w-full"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              관리자 설정으로 돌아가기
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalQuotes = statistics.reduce((sum, stat) => sum + stat.quote_count, 0);
  const totalRevenue = statistics.reduce((sum, stat) => sum + stat.total_amount, 0);
  const avgQuoteValue = totalQuotes > 0 ? totalRevenue / totalQuotes : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 p-4">
      <div className="w-full max-w-7xl mx-auto">
        <div className="mb-6">
          <Button 
            variant="outline" 
            onClick={() => navigate('/admin-settings')}
            className="flex items-center gap-2"
            size="sm"
          >
            <ArrowLeft className="w-4 h-4" />
            관리자 설정으로 돌아가기
          </Button>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-6 h-6" />
              담당자별 통계
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-primary">{statistics.length}</div>
                  <div className="text-sm text-muted-foreground">총 담당자 수</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-primary">{totalQuotes}</div>
                  <div className="text-sm text-muted-foreground">총 견적서 수</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="text-2xl font-bold text-primary">{formatCurrency(totalRevenue)}</div>
                  <div className="text-sm text-muted-foreground">총 견적 금액</div>
                </CardContent>
              </Card>
            </div>

            <div className="flex gap-4 mb-6 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium mb-2 block">시작 날짜</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium mb-2 block">종료 날짜</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="flex gap-2 items-end">
                <Button onClick={handleApplyFilter} disabled={loading}>
                  필터 적용
                </Button>
                <Button variant="outline" onClick={handleResetFilter} disabled={loading}>
                  초기화
                </Button>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-8">
                <div className="text-muted-foreground">로딩 중...</div>
              </div>
            ) : statistics.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                <div className="text-muted-foreground">통계 데이터가 없습니다.</div>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>담당자명</TableHead>
                      <TableHead>이메일</TableHead>
                      <TableHead className="text-right">견적서 수</TableHead>
                      <TableHead className="text-right">총 견적 금액</TableHead>
                      <TableHead className="text-right">평균 견적 금액</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {statistics.map((stat) => (
                      <TableRow key={stat.user_id}>
                        <TableCell className="font-medium">{stat.full_name}</TableCell>
                        <TableCell>{stat.email}</TableCell>
                        <TableCell className="text-right">{stat.quote_count}건</TableCell>
                        <TableCell className="text-right">{formatCurrency(stat.total_amount)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(stat.avg_amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UserStatisticsPage;
