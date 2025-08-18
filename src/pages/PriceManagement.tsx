
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import PriceManager from "@/components/PriceManager";

const PriceManagement = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="w-full max-w-6xl mx-auto">
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
        
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">가격 관리</h1>
          <p className="text-gray-600">
            제품별 가격을 설정하고 관리할 수 있습니다. 소재, 재질, 두께, 사이즈, 면수별로 세부적인 가격 설정이 가능합니다.
          </p>
        </div>
        
        <PriceManager />
      </div>
    </div>
  );
};

export default PriceManagement;
