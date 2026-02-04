import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Calendar, DollarSign, FileText, TrendingUp, User, Trash2, Users, Cloud, CloudOff, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { usePluuugApi, PluuugClient } from '@/hooks/usePluuugApi';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

interface SavedQuote {
  id: string;
  quote_number: string;
  quote_date: string;
  recipient_company: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_email: string;
  recipient_address: string;
  total: number;
  items: any;
  desired_delivery_date: string | null;
  pluuug_synced: boolean | null;
  pluuug_synced_at: string | null;
  pluuug_estimate_id: string | null;
}

interface RecipientInfo {
  company: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  quoteCount: number;
}

const MyPage = () => {
  const { user, profile, signOut, updateProfile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { getClients, createClient, loading: pluuugLoading } = usePluuugApi();
  
  const [quotes, setQuotes] = useState<SavedQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteQuoteId, setDeleteQuoteId] = useState<string | null>(null);
  const [selectedRecipient, setSelectedRecipient] = useState<RecipientInfo | null>(null);
  const [pluuugClients, setPluuugClients] = useState<PluuugClient[]>([]);
  const [syncingRecipient, setSyncingRecipient] = useState<string | null>(null);
  
  // Profile edit state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name);
      setPhone(profile.phone || '');
    }
  }, [profile]);

  useEffect(() => {
    if (user) {
      fetchMyQuotes();
      fetchPluuugClients();
    }
  }, [user]);

  const fetchPluuugClients = async () => {
    try {
      const result = await getClients();
      if (result.data && Array.isArray(result.data)) {
        setPluuugClients(result.data);
      }
    } catch (err) {
      console.error('Pluuug 고객 조회 에러:', err);
    }
  };

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
    if (!deleteQuoteId || !user) return;

    try {
      const { data, error } = await supabase
        .from('saved_quotes')
        .delete()
        .eq('id', deleteQuoteId)
        .eq('user_id', user.id)
        .select();

      if (error) throw error;

      // 실제로 삭제된 행이 있는지 확인
      if (!data || data.length === 0) {
        toast.error('견적서를 삭제할 권한이 없습니다.');
        setDeleteQuoteId(null);
        return;
      }

      toast.success('견적서가 삭제되었습니다.');
      fetchMyQuotes();
    } catch (error) {
      console.error('Error deleting quote:', error);
      toast.error('견적서 삭제에 실패했습니다.');
    }
    setDeleteQuoteId(null);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfile({
      full_name: fullName,
      phone
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

  const getUniqueRecipients = (): RecipientInfo[] => {
    const recipientsMap = new Map<string, RecipientInfo>();
    
    quotes.forEach((quote) => {
      const key = `${quote.recipient_company}-${quote.recipient_name}-${quote.recipient_email}`;
      
      if (recipientsMap.has(key)) {
        const existing = recipientsMap.get(key)!;
        existing.quoteCount += 1;
      } else {
        recipientsMap.set(key, {
          company: quote.recipient_company || '-',
          name: quote.recipient_name || '-',
          phone: quote.recipient_phone || '-',
          email: quote.recipient_email || '-',
          address: quote.recipient_address || '-',
          quoteCount: 1
        });
      }
    });

    return Array.from(recipientsMap.values()).sort((a, b) => b.quoteCount - a.quoteCount);
  };

  const isRecipientSyncedToPluuug = (recipient: RecipientInfo) => {
    return pluuugClients.some(
      c => c.companyName === recipient.company && c.inCharge === recipient.name
    );
  };

  const handleSyncRecipientToPluuug = async (recipient: RecipientInfo, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    
    const key = `${recipient.company}-${recipient.name}`;
    setSyncingRecipient(key);
    
    try {
      if (isRecipientSyncedToPluuug(recipient)) {
        toast.info('이미 Pluuug에 등록된 고객입니다.');
        setSyncingRecipient(null);
        return;
      }

      const result = await createClient({
        companyName: recipient.company,
        inCharge: recipient.name,
        contact: recipient.phone,
        email: recipient.email,
        content: recipient.address !== '-' ? `주소: ${recipient.address}` : undefined
      });

      if (result.data) {
        toast.success('Pluuug에 고객이 등록되었습니다!');
        await fetchPluuugClients();
      } else {
        toast.error('Pluuug 등록에 실패했습니다.');
      }
    } catch (err) {
      console.error('Pluuug 동기화 에러:', err);
      toast.error('Pluuug 동기화 중 오류가 발생했습니다.');
    } finally {
      setSyncingRecipient(null);
    }
  };

  const getQuotesByRecipient = (recipient: RecipientInfo): SavedQuote[] => {
    return quotes.filter(quote => 
      quote.recipient_company === recipient.company &&
      quote.recipient_name === recipient.name &&
      quote.recipient_email === recipient.email
    );
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
                                {quote.pluuug_synced ? (
                                  <Badge variant="secondary" className="text-xs flex items-center gap-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                    <Cloud className="w-3 h-3" />
                                    Pluuug
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs flex items-center gap-1 text-muted-foreground">
                                    <CloudOff className="w-3 h-3" />
                                    미연동
                                  </Badge>
                                )}
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
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  수신 담당자 리스트
                </CardTitle>
                <CardDescription>
                  견적서에 등록된 수신 담당자 목록입니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {getUniqueRecipients().length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    등록된 수신 담당자가 없습니다.
                  </p>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>회사명</TableHead>
                          <TableHead>담당자</TableHead>
                          <TableHead>연락처</TableHead>
                          <TableHead>이메일</TableHead>
                          <TableHead>Pluuug</TableHead>
                          <TableHead className="text-right">견적서 수</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getUniqueRecipients().map((recipient, index) => {
                          const synced = isRecipientSyncedToPluuug(recipient);
                          const key = `${recipient.company}-${recipient.name}`;
                          return (
                            <TableRow 
                              key={index}
                              className="cursor-pointer hover:bg-accent/50 transition-colors"
                              onClick={() => setSelectedRecipient(recipient)}
                            >
                              <TableCell className="font-medium">{recipient.company}</TableCell>
                              <TableCell>{recipient.name}</TableCell>
                              <TableCell>{recipient.phone}</TableCell>
                              <TableCell>{recipient.email}</TableCell>
                              <TableCell>
                                {synced ? (
                                  <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                    <Cloud className="w-3 h-3 mr-1" />
                                    연동됨
                                  </Badge>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(e) => handleSyncRecipientToPluuug(recipient, e)}
                                    disabled={syncingRecipient === key || pluuugLoading}
                                    className="text-xs"
                                  >
                                    {syncingRecipient === key ? (
                                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                    ) : (
                                      <Upload className="w-3 h-3 mr-1" />
                                    )}
                                    Pluuug 등록
                                  </Button>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="font-semibold text-primary">{recipient.quoteCount}건</span>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
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

      <Dialog open={!!selectedRecipient} onOpenChange={() => setSelectedRecipient(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {selectedRecipient?.name}님 견적서 목록
            </DialogTitle>
            <DialogDescription>
              {selectedRecipient?.company} - 총 {selectedRecipient?.quoteCount}건의 견적서
            </DialogDescription>
          </DialogHeader>
          
          {selectedRecipient && (
            <div className="space-y-4">
              <Card className="bg-muted/30">
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">회사명:</span>
                      <span className="ml-2 font-medium">{selectedRecipient.company}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">담당자:</span>
                      <span className="ml-2 font-medium">{selectedRecipient.name}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">연락처:</span>
                      <span className="ml-2 font-medium">{selectedRecipient.phone}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">이메일:</span>
                      <span className="ml-2 font-medium">{selectedRecipient.email}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">주소:</span>
                      <span className="ml-2 font-medium">{selectedRecipient.address}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground">발행 견적서</h3>
                {getQuotesByRecipient(selectedRecipient).map((quote) => (
                  <Card key={quote.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold">{quote.quote_number}</h4>
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(quote.quote_date), 'yyyy년 MM월 dd일', { locale: ko })}
                            </span>
                          </div>
                          <div className="text-sm space-y-1">
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
                            onClick={() => {
                              setSelectedRecipient(null);
                              navigate(`/saved-quotes/${quote.id}`);
                            }}
                          >
                            상세보기
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MyPage;
