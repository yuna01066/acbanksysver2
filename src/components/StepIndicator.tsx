
import React from 'react';

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
            className={`w-3 h-3 rounded-full transition-all duration-300 ${
              step < currentStep 
                ? 'bg-primary' 
                : step === currentStep
                ? 'bg-primary scale-125'
                : 'bg-muted'
            }`}
          />
          {step < maxSteps && (
            <div className={`w-8 h-0.5 mx-2 transition-all duration-300 ${
              step < currentStep ? 'bg-primary' : 'bg-muted'
            }`} />
          )}
        </div>
      ))}
    </div>
  );
};

export default StepIndicator;
