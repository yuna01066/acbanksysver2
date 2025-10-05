
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import ModernPriceManager from "@/components/ModernPriceManager";

const PriceManagement = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-6">
      <div className="w-full max-w-7xl mx-auto">
        <div className="mb-8 flex gap-2">
          <Button 
            variant="minimal" 
            onClick={() => navigate('/admin-settings')}
            className="animate-slide-in"
            size="sm"
          >
            <ArrowLeft className="w-4 h-4" />
            관리자 설정으로 돌아가기
          </Button>
          <Button 
            variant="outline" 
            onClick={() => navigate('/')}
            size="sm"
          >
            홈으로 가기
          </Button>
        </div>
        
        <ModernPriceManager />
      </div>
    </div>
  );
};

export default PriceManagement;
