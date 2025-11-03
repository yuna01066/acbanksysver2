import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Calendar, DollarSign, FileText, TrendingUp, User, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface SavedQuote {
  id: string;
  quote_number: string;
  quote_date: string;
  recipient_company: string;
  recipient_name: string;
  total: number;
  items: any;
  desired_delivery_date: string | null;
}

const MyPage = () => {
  const { user, profile, signOut, updateProfile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState<SavedQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteQuoteId, setDeleteQuoteId] = useState<string | null>(null);
  
  // Profile edit state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('');
  const [position, setPosition] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name);
      setPhone(profile.phone || '');
      setDepartment(profile.department || '');
      setPosition(profile.position || '');
    }
  }, [profile]);

  useEffect(() => {
    if (user) {
      fetchMyQuotes();
    }
  }, [user]);

  const fetchMyQuotes = async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('saved_quotes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setQuotes(data);
    }
    setLoading(false);
  };

  const handleDeleteQuote = async () => {
    if (!deleteQuoteId) return;

    const { error } = await supabase
      .from('saved_quotes')
      .delete()
      .eq('id', deleteQuoteId);

    if (!error) {
      toast.success('견적서가 삭제되었습니다.');
      fetchMyQuotes();
    } else {
      toast.error('견적서 삭제에 실패했습니다.');
    }
    setDeleteQuoteId(null);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile({
      full_name: fullName,
      phone,
      department,
      position
    });
  };

  const calculateStats = () => {
    const totalQuotes = quotes.length;
    const totalAmount = quotes.reduce((sum, q) => sum + Number(q.total), 0);
    const avgAmount = totalQuotes > 0 ? totalAmount / totalQuotes : 0;

    const now = new Date();
    const thisMonth = quotes.filter(q => {
      const quoteDate = new Date(q.quote_date);
      return quoteDate.getMonth() === now.getMonth() && 
             quoteDate.getFullYear() === now.getFullYear();
    }).length;

    return { totalQuotes, totalAmount, avgAmount, thisMonth };
  };

  const stats = calculateStats();

  if (authLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center">로딩 중...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={() => navigate('/')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            홈으로
          </Button>
          <Button variant="outline" onClick={signOut}>
            로그아웃
          </Button>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">마이페이지</h1>
          <p className="text-muted-foreground">
            {profile?.full_name}님, 환영합니다!
          </p>
        </div>

        <Tabs defaultValue="quotes" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="quotes">내 견적서</TabsTrigger>
            <TabsTrigger value="stats">통계</TabsTrigger>
            <TabsTrigger value="profile">프로필</TabsTrigger>
          </TabsList>

          <TabsContent value="quotes" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>발행한 견적서 목록</CardTitle>
                <CardDescription>
                  총 {quotes.length}개의 견적서를 발행하셨습니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p>로딩 중...</p>
                ) : quotes.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    아직 발행한 견적서가 없습니다.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {quotes.map((quote) => (
                      <Card key={quote.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="font-semibold">{quote.quote_number}</h3>
                                <span className="text-sm text-muted-foreground">
                                  {format(new Date(quote.quote_date), 'yyyy년 MM월 dd일', { locale: ko })}
                                </span>
                              </div>
                              <div className="text-sm space-y-1">
                                <p>수신: {quote.recipient_company} {quote.recipient_name}</p>
                                <p className="font-semibold text-primary">
                                  총액: {quote.total.toLocaleString()}원
                                </p>
                                {quote.desired_delivery_date && (
                                  <p className="text-muted-foreground">
                                    납기희망일: {format(new Date(quote.desired_delivery_date), 'yyyy-MM-dd')}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/saved-quotes/${quote.id}`)}
                              >
                                보기
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setDeleteQuoteId(quote.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stats" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">총 견적서</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalQuotes}개</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">이번 달</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.thisMonth}개</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">총 견적 금액</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.totalAmount.toLocaleString()}원
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">평균 견적 금액</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {Math.round(stats.avgAmount).toLocaleString()}원
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>수신 담당자 통계</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Array.from(
                    quotes.reduce((acc, quote) => {
                      const key = `${quote.recipient_company} - ${quote.recipient_name}`;
                      acc.set(key, (acc.get(key) || 0) + 1);
                      return acc;
                    }, new Map<string, number>())
                  )
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 10)
                    .map(([name, count]) => (
                      <div key={name} className="flex justify-between items-center p-2 border rounded">
                        <span>{name}</span>
                        <span className="font-semibold">{count}건</span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  프로필 수정
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">이름</Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">이메일</Label>
                    <Input
                      id="email"
                      value={profile?.email || ''}
                      disabled
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">전화번호</Label>
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="010-1234-5678"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="department">부서</Label>
                    <Input
                      id="department"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="영업팀"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="position">직급</Label>
                    <Input
                      id="position"
                      value={position}
                      onChange={(e) => setPosition(e.target.value)}
                      placeholder="대리"
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    프로필 업데이트
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={!!deleteQuoteId} onOpenChange={() => setDeleteQuoteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>견적서를 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              이 작업은 되돌릴 수 없습니다. 견적서가 영구적으로 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteQuote}>삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MyPage;
