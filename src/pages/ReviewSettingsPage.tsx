import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Star, Loader2, Settings, ClipboardList } from 'lucide-react';
import ReviewCycleManager from '@/components/employee/ReviewCycleManager';
import AdminReviewDetailViewer from '@/components/performance/AdminReviewDetailViewer';

const ReviewSettingsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAdmin, userRole, loading } = useAuth();
  const hasAccess = isAdmin || userRole === 'moderator';

  const initialTab = searchParams.get('tab') || 'settings';
  const initialEmployeeId = searchParams.get('employeeId') || undefined;

  useEffect(() => {
    if (!loading && (!user || !hasAccess)) navigate('/');
  }, [user, hasAccess, loading, navigate]);

  if (loading || !hasAccess) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b px-4 py-3 flex items-center gap-3 bg-card">
        <Button variant="ghost" size="sm" onClick={() => navigate('/admin-settings')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-base font-semibold flex items-center gap-2">
          <Star className="h-5 w-5 text-primary" />
          업무평가 관리
        </h1>
      </div>
      <div className="container max-w-5xl mx-auto px-4 py-6">
        <Tabs defaultValue={initialTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="settings" className="gap-1.5">
              <Settings className="h-3.5 w-3.5" /> 평가 설정
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5">
              <ClipboardList className="h-3.5 w-3.5" /> 평가 내역 열람
            </TabsTrigger>
          </TabsList>

          <TabsContent value="settings">
            <ReviewCycleManager />
          </TabsContent>

          <TabsContent value="history">
            <AdminReviewDetailViewer initialEmployeeId={initialEmployeeId} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ReviewSettingsPage;
