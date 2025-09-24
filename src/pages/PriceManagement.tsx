
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import ModernPriceManager from "@/components/ModernPriceManager";

const PriceManagement = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="w-full max-w-7xl mx-auto">
        <div className="mb-6">
          <Button 
            variant="outline" 
            onClick={() => navigate('/admin-settings')}
            className="flex items-center gap-2 bg-white shadow-sm"
            size="sm"
          >
            <ArrowLeft className="w-4 h-4" />
            관리자 설정으로 돌아가기
          </Button>
        </div>
        
        <ModernPriceManager />
      </div>
    </div>
  );
};

export default PriceManagement;
