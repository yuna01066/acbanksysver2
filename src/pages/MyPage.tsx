import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, User, Briefcase } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MyPageHRSection from '@/components/mypage/MyPageHRSection';
import MyPageBusinessSection from '@/components/mypage/MyPageBusinessSection';

const MyPage = () => {
  const { user, profile, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

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

        <Tabs defaultValue="hr" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-sm">
            <TabsTrigger value="hr" className="gap-2">
              <User className="h-4 w-4" />
              인사 관리
            </TabsTrigger>
            <TabsTrigger value="business" className="gap-2">
              <Briefcase className="h-4 w-4" />
              업무 관리
            </TabsTrigger>
          </TabsList>

          <TabsContent value="hr">
            <MyPageHRSection />
          </TabsContent>

          <TabsContent value="business">
            <MyPageBusinessSection />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default MyPage;
