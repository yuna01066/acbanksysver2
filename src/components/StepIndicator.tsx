
import React from 'react';

interface StepIndicatorProps {
  currentStep: number;
  maxSteps: number;
}

const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep, maxSteps }) => {
  const steps = Array.from({ length: maxSteps }, (_, i) => i + 1);
  
  return (
    <div className="mb-8 flex items-center justify-center space-x-2">
      {steps.map((step) => (
        <div key={step} className="flex items-center">
          <div 
            className={`h-3 w-3 rounded-full transition-all duration-300 ${
              step < currentStep 
                ? 'bg-slate-950' 
                : step === currentStep
                ? 'bg-white ring-4 ring-slate-950'
                : 'bg-slate-200'
            }`}
          />
          {step < maxSteps && (
            <div className={`mx-2 h-0.5 w-8 transition-all duration-300 ${
              step < currentStep ? 'bg-slate-950' : 'bg-slate-200'
            }`} />
          )}
        </div>
      ))}
    </div>
  );
};

export default StepIndicator;
