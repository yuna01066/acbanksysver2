import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Users, FileText, Upload, Calculator, Send, Loader2 } from 'lucide-react';
import { useYearEndTax, TAX_YEAR, STATUS_LABELS } from '@/hooks/useYearEndTax';
import TaxDependentsTab from '@/components/year-end-tax/TaxDependentsTab';
import TaxDeductionsTab from '@/components/year-end-tax/TaxDeductionsTab';
import TaxDocumentsTab from '@/components/year-end-tax/TaxDocumentsTab';
import TaxSummaryTab from '@/components/year-end-tax/TaxSummaryTab';
import { Badge } from '@/components/ui/badge';

const YearEndTaxPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const tax = useYearEndTax(TAX_YEAR);
  const [activeTab, setActiveTab] = useState('dependents');

  if (authLoading || tax.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    navigate('/auth');
    return null;
  }

  const statusInfo = STATUS_LABELS[tax.settlement?.status || 'not_started'];
  const isEditable = !tax.settlement || ['not_started', 'in_progress', 'revision_requested'].includes(tax.settlement.status);

  const handleStart = async () => {
    await tax.initSettlement();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{TAX_YEAR}년 귀속 연말정산</h1>
            <p className="text-sm text-muted-foreground">{profile?.full_name}님의 연말정산 자료</p>
          </div>
          {tax.settlement && (
            <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
          )}
        </div>

        {!tax.settlement ? (
          <Card>
            <CardHeader className="text-center">
              <CardTitle>{TAX_YEAR}년 귀속 연말정산</CardTitle>
              <CardDescription>
                연말정산 자료 입력을 시작하세요. 부양가족 등록, 공제자료 입력, 서류 업로드를 진행할 수 있습니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Button onClick={handleStart} size="lg">
                <FileText className="mr-2 h-5 w-5" />
                연말정산 시작하기
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {tax.settlement.status === 'revision_requested' && tax.settlement.review_comment && (
              <Card className="mb-4 border-orange-300 bg-orange-50">
                <CardContent className="py-3">
                  <p className="text-sm font-medium text-orange-800">📋 관리자 수정 요청</p>
                  <p className="text-sm text-orange-700 mt-1">{tax.settlement.review_comment}</p>
                </CardContent>
              </Card>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="dependents" className="gap-1.5 text-xs sm:text-sm">
                  <Users className="h-4 w-4 hidden sm:block" /> 부양가족
                </TabsTrigger>
                <TabsTrigger value="deductions" className="gap-1.5 text-xs sm:text-sm">
                  <Calculator className="h-4 w-4 hidden sm:block" /> 공제자료
                </TabsTrigger>
                <TabsTrigger value="documents" className="gap-1.5 text-xs sm:text-sm">
                  <Upload className="h-4 w-4 hidden sm:block" /> 서류제출
                </TabsTrigger>
                <TabsTrigger value="summary" className="gap-1.5 text-xs sm:text-sm">
                  <Send className="h-4 w-4 hidden sm:block" /> 확인/제출
                </TabsTrigger>
              </TabsList>

              <TabsContent value="dependents">
                <TaxDependentsTab
                  settlement={tax.settlement}
                  dependents={tax.dependents}
                  onAdd={tax.addDependent}
                  onUpdate={tax.updateDependent}
                  onDelete={tax.deleteDependent}
                  isEditable={isEditable}
                />
              </TabsContent>

              <TabsContent value="deductions">
                <TaxDeductionsTab
                  settlement={tax.settlement}
                  deductionItems={tax.deductionItems}
                  dependents={tax.dependents}
                  onAdd={tax.addDeductionItem}
                  onUpdate={tax.updateDeductionItem}
                  onDelete={tax.deleteDeductionItem}
                  isEditable={isEditable}
                />
              </TabsContent>

              <TabsContent value="documents">
                <TaxDocumentsTab
                  settlement={tax.settlement}
                  documents={tax.documents}
                  onUpload={tax.uploadDocument}
                  onDelete={tax.deleteDocument}
                  isEditable={isEditable}
                />
              </TabsContent>

              <TabsContent value="summary">
                <TaxSummaryTab
                  settlement={tax.settlement}
                  dependents={tax.dependents}
                  deductionItems={tax.deductionItems}
                  documents={tax.documents}
                  onUpdateSettlement={tax.updateSettlement}
                  onSubmit={tax.submitSettlement}
                  isEditable={isEditable}
                />
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
};

export default YearEndTaxPage;
