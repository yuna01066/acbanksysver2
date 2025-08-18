
import React from 'react';
import { CheckCircle } from "lucide-react";

interface StepIndicatorProps {
  currentStep: number;
  maxSteps: number;
}

const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep, maxSteps }) => {
  const steps = Array.from({ length: maxSteps }, (_, i) => i + 1);
  
  return (
    <div className="flex items-center justify-center mb-8 space-x-2">
      {steps.map((step) => (
        <div key={step} className="flex items-center">
          <div 
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300 ${
              step < currentStep 
                ? 'bg-slate-900 text-white' 
                : step === currentStep
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-400'
            }`}
          >
            {step < currentStep ? <CheckCircle className="w-4 h-4" /> : step}
          </div>
          {step < maxSteps && (
            <div className={`w-8 h-0.5 mx-2 transition-all duration-300 ${
              step < currentStep ? 'bg-slate-900' : 'bg-gray-200'
            }`} />
          )}
        </div>
      ))}
    </div>
  );
};

export default StepIndicator;
