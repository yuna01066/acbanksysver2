import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import BusinessDashboard from '@/components/dashboard/BusinessDashboard';
import { useAuth } from '@/contexts/AuthContext';

const BusinessDashboardPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">로그인이 필요합니다.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="flex items-center gap-2.5 mb-6">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/project-management')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold tracking-tight">경영 대시보드</h1>
        </div>
        <BusinessDashboard />
      </div>
    </div>
  );
};

export default BusinessDashboardPage;
