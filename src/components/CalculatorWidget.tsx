
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import PanelCalculator from './PanelCalculator';

const CalculatorWidget = () => {
  const navigate = useNavigate();

  return (
    <div className="w-full min-h-screen">
      <div className="fixed top-6 right-6 z-50 print:hidden">
        <Button
          onClick={() => navigate('/admin-settings')}
          variant="minimal"
          size="sm"
          className="animate-fade-up backdrop-blur-sm bg-white/90 border-border/50 hover:bg-white hover:shadow-smooth"
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
