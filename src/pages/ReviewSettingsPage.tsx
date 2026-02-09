import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Star, Loader2 } from 'lucide-react';
import ReviewCycleManager from '@/components/employee/ReviewCycleManager';

const ReviewSettingsPage = () => {
  const navigate = useNavigate();
  const { user, isAdmin, userRole, loading } = useAuth();
  const hasAccess = isAdmin || userRole === 'moderator';

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
          업무평가 설정
        </h1>
      </div>
      <div className="container max-w-4xl mx-auto px-4 py-6">
        <ReviewCycleManager />
      </div>
    </div>
  );
};

export default ReviewSettingsPage;
