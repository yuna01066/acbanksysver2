import React from 'react';
import { FileText, Loader2, Receipt } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TaxDependentsTab from '@/components/year-end-tax/TaxDependentsTab';
import TaxDeductionsTab from '@/components/year-end-tax/TaxDeductionsTab';
import TaxDocumentsTab from '@/components/year-end-tax/TaxDocumentsTab';
import TaxSummaryTab from '@/components/year-end-tax/TaxSummaryTab';
import { STATUS_LABELS, TAX_YEAR, useYearEndTax } from '@/hooks/useYearEndTax';

const editableStatuses = ['not_started', 'in_progress', 'revision_requested'];

const MyTaxSection: React.FC = () => {
  const tax = useYearEndTax(TAX_YEAR);
  const isEditable = !tax.settlement || editableStatuses.includes(tax.settlement.status);

  if (tax.loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!tax.settlement) {
    return (
      <Card className="border">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            {TAX_YEAR}년 귀속 연말정산
          </CardTitle>
          <CardDescription>연말정산 자료 입력을 시작하세요.</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button onClick={() => tax.initSettlement()} size="lg">
            <FileText className="mr-2 h-5 w-5" />
            연말정산 시작하기
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>{TAX_YEAR}년 귀속 연말정산</CardTitle>
              <CardDescription>부양가족, 공제자료, 제출 서류를 확인하고 제출합니다.</CardDescription>
            </div>
            <Badge className={STATUS_LABELS[tax.settlement.status || 'not_started']?.color}>
              {STATUS_LABELS[tax.settlement.status || 'not_started']?.label}
            </Badge>
          </div>
        </CardHeader>
        {tax.settlement.status === 'revision_requested' && tax.settlement.review_comment && (
          <CardContent className="pt-0">
            <div className="rounded-lg border border-orange-300 bg-orange-50 p-3 text-sm text-orange-800 dark:bg-orange-950/20 dark:text-orange-300">
              <p className="font-medium">관리자 수정 요청</p>
              <p className="mt-1">{tax.settlement.review_comment}</p>
            </div>
          </CardContent>
        )}
      </Card>

      <Tabs defaultValue="dependents" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dependents" className="text-xs sm:text-sm">부양가족</TabsTrigger>
          <TabsTrigger value="deductions" className="text-xs sm:text-sm">공제자료</TabsTrigger>
          <TabsTrigger value="documents" className="text-xs sm:text-sm">서류제출</TabsTrigger>
          <TabsTrigger value="summary" className="text-xs sm:text-sm">확인/제출</TabsTrigger>
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
    </div>
  );
};

export default MyTaxSection;
