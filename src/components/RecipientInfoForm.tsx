import React from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { QuoteRecipient } from "@/contexts/QuoteContext";

interface RecipientInfoFormProps {
  recipientData: QuoteRecipient;
  onChange: (field: keyof QuoteRecipient, value: any) => void;
  showClientMemo?: boolean;
}

const RecipientInfoForm: React.FC<RecipientInfoFormProps> = ({
  recipientData,
  onChange,
  showClientMemo = false
}) => {
  return (
    <div>
      {/* 견적 수신 섹션 */}
      <div className="mb-8">
        <h3 className="text-xl font-bold text-gray-900 mb-6">견적서 수신</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 기본 정보 */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="projectName">프로젝트명</Label>
              <Input
                id="projectName"
                value={recipientData.projectName}
                onChange={(e) => onChange('projectName', e.target.value)}
                placeholder="프로젝트명을 입력하세요"
              />
            </div>
            <div>
              <Label htmlFor="quoteNumber">견적번호</Label>
              <Input
                id="quoteNumber"
                value={recipientData.quoteNumber}
                onChange={(e) => onChange('quoteNumber', e.target.value)}
                placeholder="견적번호"
              />
            </div>
            <div>
              <Label>견적일자</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !recipientData.quoteDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {recipientData.quoteDate ? format(recipientData.quoteDate, "yyyy년 MM월 dd일") : <span>날짜 선택</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={recipientData.quoteDate || undefined}
                    onSelect={(date) => onChange('quoteDate', date)}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label htmlFor="validUntil">유효기간</Label>
              <Input
                id="validUntil"
                value={recipientData.validUntil}
                onChange={(e) => onChange('validUntil', e.target.value)}
                placeholder="견적일자로 부터 14일"
              />
            </div>
            <div>
              <Label htmlFor="deliveryPeriod">납기</Label>
              <Input
                id="deliveryPeriod"
                value={recipientData.deliveryPeriod}
                onChange={(e) => onChange('deliveryPeriod', e.target.value)}
                placeholder="최대 14일 소요 예상"
              />
            </div>
            <div>
              <Label htmlFor="paymentCondition">지불 조건</Label>
              <Input
                id="paymentCondition"
                value={recipientData.paymentCondition}
                onChange={(e) => onChange('paymentCondition', e.target.value)}
                placeholder="선지급 조건"
              />
            </div>
          </div>

          {/* 담당자 정보 */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="companyName">회사명</Label>
              <Input
                id="companyName"
                value={recipientData.companyName}
                onChange={(e) => onChange('companyName', e.target.value)}
                placeholder="회사명을 입력하세요"
              />
            </div>
            <div>
              <Label htmlFor="contactPerson">담당자 *</Label>
              <Input
                id="contactPerson"
                value={recipientData.contactPerson}
                onChange={(e) => onChange('contactPerson', e.target.value)}
                placeholder="담당자명을 입력하세요"
              />
            </div>
            <div>
              <Label htmlFor="phoneNumber">연락처 *</Label>
              <Input
                id="phoneNumber"
                value={recipientData.phoneNumber}
                onChange={(e) => onChange('phoneNumber', e.target.value)}
                placeholder="연락처를 입력하세요"
              />
            </div>
            <div>
              <Label htmlFor="email">이메일 *</Label>
              <Input
                id="email"
                type="email"
                value={recipientData.email}
                onChange={(e) => onChange('email', e.target.value)}
                placeholder="이메일을 입력하세요"
              />
            </div>
            <div>
              <Label>납기 희망일 *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !recipientData.desiredDeliveryDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {recipientData.desiredDeliveryDate ? format(recipientData.desiredDeliveryDate, "yyyy년 MM월 dd일") : <span>희망일 선택</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={recipientData.desiredDeliveryDate || undefined}
                    onSelect={(date) => onChange('desiredDeliveryDate', date)}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label htmlFor="deliveryAddress">납기현장 주소 *</Label>
              <Textarea
                id="deliveryAddress"
                value={recipientData.deliveryAddress}
                onChange={(e) => onChange('deliveryAddress', e.target.value)}
                placeholder="납기현장 주소를 입력하세요"
                rows={3}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 클라이언트 요청사항 (선택적) */}
      {showClientMemo && (
        <div className="mb-8">
          <h3 className="text-xl font-bold text-gray-900 mb-4">클라이언트 요청사항</h3>
          <p className="text-sm text-gray-600 mb-4">
            클라이언트의 요청사항이나 참고할 내용을 입력해주세요.
          </p>
          <Textarea
            value={recipientData.clientMemo}
            onChange={(e) => onChange('clientMemo', e.target.value)}
            placeholder="요청사항을 입력하세요 (예: 제품 관련 특이사항, 배송 요청사항 등)"
            rows={4}
            className="w-full"
          />
        </div>
      )}
    </div>
  );
};

export default RecipientInfoForm;