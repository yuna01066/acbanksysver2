
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home } from "lucide-react";
import ModernPriceManager from "@/components/ModernPriceManager";
import { PageShell } from "@/components/layout/PageLayout";

const PriceManagement = () => {
  const navigate = useNavigate();

  return (
    <PageShell maxWidth="7xl" className="to-muted/20">
      <ModernPriceManager
        navigationActions={(
          <>
            <Button
              variant="minimal"
              onClick={() => navigate('/admin-settings')}
              size="sm"
            >
              <ArrowLeft className="w-4 h-4" />
              관리자 설정
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/')}
              size="sm"
            >
              <Home className="w-4 h-4" />
              홈
            </Button>
          </>
        )}
      />
    </PageShell>
  );
};

export default PriceManagement;
