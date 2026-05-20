
import React from 'react';
import HomeLogoButton from "@/components/HomeLogoButton";
import EmbedCodeGenerator from "@/components/EmbedCodeGenerator";

const EmbedCodePage = () => {
  return (
    <div className="min-h-screen bg-gray-50 p-2">
      <div className="w-full max-w-5xl mx-auto">
        <div className="mb-4">
          <HomeLogoButton />
        </div>
        
        <EmbedCodeGenerator />
      </div>
    </div>
  );
};

export default EmbedCodePage;
