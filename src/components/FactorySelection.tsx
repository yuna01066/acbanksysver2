
import React from 'react';
import { Button } from "@/components/ui/button";
import { Factory } from "lucide-react";

interface Factory {
  id: string;
  name: string;
}

interface FactorySelectionProps {
  factories: Factory[];
  selectedFactory: string;
  onFactorySelect: (factoryId: string) => void;
}

const FactorySelection: React.FC<FactorySelectionProps> = ({
  factories,
  selectedFactory,
  onFactorySelect
}) => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">판재 공장을 선택해주세요</h3>
        <p className="text-gray-600">원하시는 판재 공장을 선택해주세요</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {factories.map((factory) => (
          <Button
            key={factory.id}
            variant={selectedFactory === factory.id ? "default" : "outline"}
            className={`h-20 text-lg font-semibold transition-all duration-200 rounded-lg ${
              selectedFactory === factory.id
                ? 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'
                : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-900'
            }`}
            onClick={() => onFactorySelect(factory.id)}
          >
            <div className="flex flex-col items-center gap-2">
              <Factory className="w-6 h-6" />
              {factory.name}
            </div>
          </Button>
        ))}
      </div>
    </div>
  );
};

export default FactorySelection;
