
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import EmbedCodeGenerator from "@/components/EmbedCodeGenerator";

const EmbedCodePage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 p-2">
      <div className="w-full max-w-5xl mx-auto">
        <div className="mb-4">
          <Button 
            variant="outline" 
            onClick={() => navigate('/')}
            className="flex items-center gap-2"
            size="sm"
          >
            <ArrowLeft className="w-4 h-4" />
            홈으로 돌아가기
          </Button>
        </div>
        
        <EmbedCodeGenerator />
      </div>
    </div>
  );
};

export default EmbedCodePage;
