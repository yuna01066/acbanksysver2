
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Code, Settings } from "lucide-react";

const AdminSettingsPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="w-full max-w-4xl mx-auto">
        <div className="mb-6">
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
        
        <Card className="w-full">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Settings className="w-6 h-6" />
              관리자 설정
            </CardTitle>
            <p className="text-gray-600">
              계산기 관리 및 설정을 할 수 있습니다.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-2">위젯 관리</h3>
                <p className="text-sm text-gray-600 mb-3">
                  외부 사이트에 임베드할 수 있는 위젯 코드를 관리합니다.
                </p>
                <Button
                  onClick={() => navigate('/embed-code')}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Code className="w-4 h-4" />
                  위젯 코드 생성
                </Button>
              </div>
              
              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-2">원판 관리</h3>
                <p className="text-sm text-gray-600 mb-3">
                  원판 사이즈, 두께, 가격을 관리합니다. 견적 계산기와 수율 계산기에서 공유됩니다.
                </p>
                <Button
                  onClick={() => navigate('/panel-management')}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Settings className="w-4 h-4" />
                  원판 관리
                </Button>
              </div>
              
              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-2">가격 관리 (구버전)</h3>
                <p className="text-sm text-gray-600 mb-3">
                  제품별 가격을 설정하고 관리합니다.
                </p>
                <Button
                  onClick={() => navigate('/price-management')}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Settings className="w-4 h-4" />
                  가격 설정
                </Button>
              </div>
              
              <div className="border rounded-lg p-4 opacity-50">
                <h3 className="font-medium mb-2">사용자 관리</h3>
                <p className="text-sm text-gray-600 mb-3">
                  사용자 권한 및 접근을 관리합니다. (준비중)
                </p>
                <Button
                  variant="outline"
                  disabled
                  className="flex items-center gap-2"
                >
                  <Settings className="w-4 h-4" />
                  사용자 설정 (준비중)
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminSettingsPage;
