import React, { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { QuoteRecipient } from "@/contexts/QuoteContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface SavedRecipient {
  company: string;
  name: string;
  phone: string;
  email: string;
  address: string;
}

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
  const { user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [savedRecipients, setSavedRecipients] = useState<SavedRecipient[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isDialogOpen && user) {
      fetchSavedRecipients();
    }
  }, [isDialogOpen, user]);

  const fetchSavedRecipients = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('saved_quotes')
      .select('recipient_company, recipient_name, recipient_phone, recipient_email, recipient_address')
      .eq('user_id', user.id)
      .not('recipient_company', 'is', null)
      .not('recipient_name', 'is', null);

    if (!error && data) {
      // Remove duplicates based on company + name + email
      const uniqueRecipients = new Map<string, SavedRecipient>();
      data.forEach((item) => {
        const key = `${item.recipient_company}-${item.recipient_name}-${item.recipient_email}`;
        if (!uniqueRecipients.has(key)) {
          uniqueRecipients.set(key, {
            company: item.recipient_company || '',
            name: item.recipient_name || '',
            phone: item.recipient_phone || '',
            email: item.recipient_email || '',
            address: item.recipient_address || ''
          });
        }
      });
      setSavedRecipients(Array.from(uniqueRecipients.values()));
    }
  };

  const handleSelectRecipient = (recipient: SavedRecipient) => {
    onChange('companyName', recipient.company);
    onChange('contactPerson', recipient.name);
    onChange('phoneNumber', recipient.phone);
    onChange('email', recipient.email);
    onChange('deliveryAddress', recipient.address);
    setIsDialogOpen(false);
  };

  const filteredRecipients = savedRecipients.filter((recipient) => {
    const search = searchTerm.toLowerCase();
    return (
      recipient.company.toLowerCase().includes(search) ||
      recipient.name.toLowerCase().includes(search) ||
      recipient.email.toLowerCase().includes(search)
    );
  });

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
              <div className="flex gap-2">
                <Input
                  id="companyName"
                  value={recipientData.companyName}
                  onChange={(e) => onChange('companyName', e.target.value)}
                  placeholder="회사명을 입력하세요"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setIsDialogOpen(true)}
                  title="저장된 담당자 검색"
                >
                  <Search className="h-4 w-4" />
                </Button>
              </div>
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

      {/* 발신 담당자 정보 */}
      <div className="mb-8 p-4 bg-muted/30 rounded-lg">
        <h3 className="text-xl font-bold text-gray-900 mb-4">발신 담당자 정보</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="issuerName">담당자</Label>
            <Input
              id="issuerName"
              value={recipientData.issuerName || ''}
              onChange={(e) => onChange('issuerName', e.target.value)}
              placeholder="담당자명"
            />
          </div>
          <div>
            <Label htmlFor="issuerEmail">이메일</Label>
            <Input
              id="issuerEmail"
              type="email"
              value={recipientData.issuerEmail || ''}
              onChange={(e) => onChange('issuerEmail', e.target.value)}
              placeholder="이메일"
            />
          </div>
          <div>
            <Label htmlFor="issuerPhone">연락처</Label>
            <Input
              id="issuerPhone"
              value={recipientData.issuerPhone || ''}
              onChange={(e) => onChange('issuerPhone', e.target.value)}
              placeholder="연락처"
            />
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

      {/* 저장된 담당자 검색 Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>저장된 수신 담당자 검색</DialogTitle>
            <DialogDescription>
              이전에 사용한 수신 담당자를 선택하여 정보를 자동으로 채울 수 있습니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Input
                placeholder="회사명, 담당자명, 이메일로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {filteredRecipients.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm ? '검색 결과가 없습니다.' : '저장된 담당자가 없습니다.'}
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>회사명</TableHead>
                      <TableHead>담당자</TableHead>
                      <TableHead>연락처</TableHead>
                      <TableHead>이메일</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecipients.map((recipient, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{recipient.company}</TableCell>
                        <TableCell>{recipient.name}</TableCell>
                        <TableCell>{recipient.phone}</TableCell>
                        <TableCell>{recipient.email}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => handleSelectRecipient(recipient)}
                          >
                            선택
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RecipientInfoForm;