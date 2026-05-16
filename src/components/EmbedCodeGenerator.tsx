
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Code, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const EmbedCodeGenerator = () => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  // 현재 도메인을 기반으로 임베드 URL 생성
  const currentDomain = window.location.origin;
  const embedUrl = `${currentDomain}/calculator?type=quote`;

  const embedCode = `<!-- 판재 단가 계산기 위젯 -->
<div style="width: 100%; max-width: 1400px; margin: 0 auto;">
  <iframe 
    src="${embedUrl}" 
    width="100%" 
    height="1000" 
    frameborder="0" 
    scrolling="yes"
    style="border: 1px solid #e5e7eb; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);"
    title="판재 단가 계산기"
    loading="lazy">
  </iframe>
</div>

<!-- 반응형 스타일 (선택사항) -->
<style>
  @media (max-width: 768px) {
    iframe[title="판재 단가 계산기"] {
      height: 800px;
    }
  }
</style>`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(embedCode);
      setCopied(true);
      toast({
        title: "복사 완료!",
        description: "임베드 코드가 클립보드에 복사되었습니다.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "복사 실패",
        description: "코드를 수동으로 선택해서 복사해주세요.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Code className="w-5 h-5" />
          아임웹 위젯 임베드 코드
        </CardTitle>
        <p className="text-gray-600 text-sm">
          아래 코드를 복사해서 아임웹의 HTML/CSS 편집 영역에 붙여넣으세요.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h4 className="font-medium text-sm">임베드 코드</h4>
            <Button
              onClick={copyToClipboard}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 h-8"
            >
              <Copy className="w-3 h-3" />
              {copied ? '복사됨!' : '코드 복사'}
            </Button>
          </div>
          <Textarea
            value={embedCode}
            readOnly
            className="font-mono text-xs h-48 resize-none"
            onClick={(e) => e.currentTarget.select()}
          />
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <h4 className="font-medium text-blue-800 mb-2 flex items-center gap-2 text-sm">
            <ExternalLink className="w-4 h-4" />
            아임웹 설치 방법
          </h4>
          <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
            <li>아임웹 관리자 페이지에 로그인합니다</li>
            <li>원하는 페이지의 편집 모드로 들어갑니다</li>
            <li>"위젯 추가" → "HTML/CSS" 위젯을 선택합니다</li>
            <li>위의 임베드 코드를 HTML 영역에 붙여넣습니다</li>
            <li>"적용" 또는 "저장" 버튼을 클릭합니다</li>
          </ol>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <h4 className="font-medium text-yellow-800 mb-2 text-sm">주의사항</h4>
          <ul className="text-xs text-yellow-700 space-y-1 list-disc list-inside">
            <li>iframe의 높이(height)는 필요에 따라 조정할 수 있습니다</li>
            <li>모바일에서는 자동으로 높이가 600px로 조정됩니다</li>
            <li>위젯이 제대로 표시되지 않으면 아임웹 고객센터에 문의하세요</li>
            <li>HTTPS 환경에서만 정상 작동합니다</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default EmbedCodeGenerator;
