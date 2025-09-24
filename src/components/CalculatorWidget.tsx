
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import PanelCalculator from './PanelCalculator';

const CalculatorWidget = () => {
  const navigate = useNavigate();

  return (
    <div className="w-full min-h-screen">
      {/* Apple-style floating admin button */}
      <div className="fixed top-6 right-6 z-50 print:hidden">
        <Button
          onClick={() => navigate('/admin-settings')}
          variant="secondary"
          size="sm"
          className="flex items-center gap-2 glass border-0 shadow-apple hover:shadow-apple-lg transition-all duration-300 hover:scale-105 backdrop-blur-xl"
        >
          <Settings className="w-4 h-4" />
          <span className="hidden sm:inline">관리자 설정</span>
        </Button>
      </div>
      
      {/* Main content with Apple-style padding and spacing */}
      <div className="relative z-10">
        <PanelCalculator />
      </div>
    </div>
  );
};

export default CalculatorWidget;
