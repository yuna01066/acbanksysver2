
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import PanelCalculator from './PanelCalculator';

const CalculatorWidget = () => {
  const navigate = useNavigate();

  return (
    <div className="w-full min-h-screen bg-gray-50">
      <div className="fixed top-4 right-4 z-50 print:hidden">
        <Button
          onClick={() => navigate('/admin-settings')}
          variant="outline"
          size="sm"
          className="flex items-center gap-2 bg-white shadow-md hover:shadow-lg"
        >
          <Settings className="w-4 h-4" />
          관리자 설정
        </Button>
      </div>
      <PanelCalculator />
    </div>
  );
};

export default CalculatorWidget;
