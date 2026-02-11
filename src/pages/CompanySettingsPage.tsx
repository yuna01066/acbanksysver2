import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Building2, CalendarDays, FileSignature, Shield, Calendar } from 'lucide-react';
import CompanyInfoForm from '@/components/company/CompanyInfoForm';
import CompanyHolidayManager from '@/components/company/CompanyHolidayManager';
import ContractTemplateSettings from '@/components/contract/ContractTemplateSettings';
import PageAccessManager from '@/components/company/PageAccessManager';
import LeavePolicySettings from '@/components/leave/LeavePolicySettings';

const CompanySettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAdmin, isModerator } = useAuth();

  if (!user || (!isAdmin && !isModerator)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">관리자 권한이 필요합니다.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">회사 설정</h1>
        </div>

        <Tabs defaultValue="holidays" className="space-y-4">
          <TabsList>
            <TabsTrigger value="info" className="gap-1.5">
              <Building2 className="h-4 w-4" /> 회사 정보
            </TabsTrigger>
            <TabsTrigger value="holidays" className="gap-1.5">
              <CalendarDays className="h-4 w-4" /> 쉬는 날
            </TabsTrigger>
            <TabsTrigger value="contracts" className="gap-1.5">
              <FileSignature className="h-4 w-4" /> 계약서 관리
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="access" className="gap-1.5">
                <Shield className="h-4 w-4" /> 접근 권한
              </TabsTrigger>
            )}
            <TabsTrigger value="leave" className="gap-1.5">
              <Calendar className="h-4 w-4" /> 연차 설정
            </TabsTrigger>
          </TabsList>
          <TabsContent value="info">
            <CompanyInfoForm />
          </TabsContent>
          <TabsContent value="holidays">
            <CompanyHolidayManager />
          </TabsContent>
          <TabsContent value="contracts">
            <ContractTemplateSettings />
          </TabsContent>
          {isAdmin && (
            <TabsContent value="access">
              <PageAccessManager />
            </TabsContent>
          )}
          <TabsContent value="leave">
            <LeavePolicySettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default CompanySettingsPage;
