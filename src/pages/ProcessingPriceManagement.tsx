import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import ProcessingOptionsManager from "@/components/admin/ProcessingOptionsManager";

const ProcessingPriceManagement = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen p-6">
      <div className="w-full max-w-4xl mx-auto">
        <div className="mb-6">
          <Button 
            onClick={() => navigate('/admin-settings')}
            variant="outline"
            size="sm"
            className="animate-fade-up"
          >
            <ArrowLeft className="w-4 h-4" />
            관리자 설정으로
          </Button>
        </div>
        
        <ProcessingOptionsManager />
      </div>
    </div>
  );
};

export default ProcessingPriceManagement;
