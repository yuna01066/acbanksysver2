import React, { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Search, Cloud, Upload, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { QuoteRecipient } from "@/contexts/QuoteContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePluuugApi, PluuugClient } from "@/hooks/usePluuugApi";
import { useRecipients, Recipient } from "@/hooks/useRecipients";
import { toast } from "sonner";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface RecipientInfoFormProps {
  recipientData: QuoteRecipient;
  onChange: (field: keyof QuoteRecipient, value: any) => void;
  onBulkChange?: (updates: Partial<QuoteRecipient>) => void;
  showClientMemo?: boolean;
}

const RecipientInfoForm: React.FC<RecipientInfoFormProps> = ({
  recipientData,
  onChange,
  onBulkChange,
  showClientMemo = false
}) => {
  const { user } = useAuth();
  const { getClients, getClientStatuses, createClient, loading: pluuugLoading } = usePluuugApi();
  const { 
    recipients: savedRecipients, 
    fetchRecipients, 
    markAsSyncedToPluuug, 
    toPluuugClientData,
    loading: recipientsLoading 
  } = useRecipients();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [pluuugClients, setPluuugClients] = useState<PluuugClient[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'local' | 'pluuug'>('local');
  const [loadingPluuug, setLoadingPluuug] = useState(false);
  const [syncingToPluuug, setSyncingToPluuug] = useState<string | null>(null);

  useEffect(() => {
    if (isDialogOpen && user) {
      fetchRecipients();
      fetchPluuugClients();
    }
  }, [isDialogOpen, user, fetchRecipients]);

  const resolveDefaultPluuugClientStatusId = async (): Promise<number | null> => {
    const statuses = await getClientStatuses();
    const id = statuses.data?.results?.[0]?.id;
    return typeof id === 'number' ? id : null;
  };

  const fetchPluuugClients = async () => {
    setLoadingPluuug(true);
    try {
      const result = await getClients();
      const payload: any = result.data;
      const list = Array.isArray(payload) ? payload : payload?.results;
      if (Array.isArray(list)) setPluuugClients(list);
    } catch (err) {
      console.error('Pluuug 고객 조회 에러:', err);
    } finally {
      setLoadingPluuug(false);
    }
  };

  const handleSelectRecipient = (recipient: Recipient) => {
    if (onBulkChange) {
      onBulkChange({
        companyName: recipient.company_name,
        contactPerson: recipient.contact_person,
        phoneNumber: recipient.phone,
        email: recipient.email,
        deliveryAddress: recipient.address || ''
      });
    } else {
      onChange('companyName', recipient.company_name);
      onChange('contactPerson', recipient.contact_person);
      onChange('phoneNumber', recipient.phone);
      onChange('email', recipient.email);
      onChange('deliveryAddress', recipient.address || '');
    }
    
    setIsDialogOpen(false);
  };

  const handleSelectPluuugClient = (client: PluuugClient) => {
    if (onBulkChange) {
      onBulkChange({
        companyName: client.companyName || '',
        contactPerson: client.inCharge || '',
        phoneNumber: client.contact || '',
        email: client.email || '',
      });
    } else {
      onChange('companyName', client.companyName || '');
      onChange('contactPerson', client.inCharge || '');
      onChange('phoneNumber', client.contact || '');
      onChange('email', client.email || '');
    }
    
    toast.success('Pluuug 고객 정보가 적용되었습니다.');
    setIsDialogOpen(false);
  };

  const handleSyncToPluuug = async (recipient: Recipient) => {
    const key = `${recipient.company_name}-${recipient.contact_person}`;
    setSyncingToPluuug(key);
    
    try {
      // Check if already synced via our database
      if (recipient.pluuug_client_id) {
        toast.info('이미 Pluuug에 등록된 고객입니다.');
        setSyncingToPluuug(null);
        return;
      }

      // Also check if client already exists in Pluuug (by name match)
      const existingClient = pluuugClients.find(
        c => c.companyName === recipient.company_name && c.inCharge === recipient.contact_person
      );

      if (existingClient) {
        // Update our local record with the Pluuug ID
        await markAsSyncedToPluuug(recipient.id, existingClient.id);
        toast.info('이미 Pluuug에 등록된 고객입니다. 연동 상태를 업데이트했습니다.');
        await fetchRecipients();
        setSyncingToPluuug(null);
        return;
      }

      const statusId = await resolveDefaultPluuugClientStatusId();
      if (!statusId) {
        toast.error('Pluuug 고객 상태 목록을 불러오지 못했습니다.');
        return;
      }

      // Use the unified data converter
      const clientData = toPluuugClientData(recipient, statusId);
      const result = await createClient(clientData as any);

      if (result.data && !result.error && result.status >= 200 && result.status < 300) {
        // Update our local record with the Pluuug client ID
        const pluuugClientId = result.data.id;
        if (pluuugClientId) {
          await markAsSyncedToPluuug(recipient.id, pluuugClientId);
        }
        toast.success('Pluuug에 고객이 등록되었습니다!');
        await fetchPluuugClients();
        await fetchRecipients();
      } else if (result.error) {
        console.error('Pluuug API Error:', result.error);
        toast.error(`Pluuug 등록 실패: ${result.error}`);
      } else {
        toast.error('Pluuug 등록에 실패했습니다.');
      }
    } catch (err) {
      console.error('Pluuug 동기화 에러:', err);
      toast.error('Pluuug 동기화 중 오류가 발생했습니다.');
    } finally {
      setSyncingToPluuug(null);
    }
  };

  const isAlreadySynced = (recipient: Recipient) => {
    // Check our local database first
    if (recipient.pluuug_client_id) return true;
    // Fallback to checking Pluuug clients list
    return pluuugClients.some(
      c => c.companyName === recipient.company_name && c.inCharge === recipient.contact_person
    );
  };

  const filteredRecipients = savedRecipients.filter((recipient) => {
    const search = searchTerm.toLowerCase();
    return (
      recipient.company_name.toLowerCase().includes(search) ||
      recipient.contact_person.toLowerCase().includes(search) ||
      recipient.email.toLowerCase().includes(search)
    );
  });

  const filteredPluuugClients = pluuugClients.filter((client) => {
    const search = searchTerm.toLowerCase();
    return (
      (client.companyName || '').toLowerCase().includes(search) ||
      (client.inCharge || '').toLowerCase().includes(search) ||
      (client.email || '').toLowerCase().includes(search)
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
                  title="저장된 담당자 / Pluuug 고객 검색"
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

      {/* 저장된 담당자 / Pluuug 고객 검색 Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>수신 담당자 검색</DialogTitle>
            <DialogDescription>
              저장된 담당자 또는 Pluuug에 등록된 고객을 선택하여 정보를 자동으로 채울 수 있습니다.
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

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'local' | 'pluuug')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="local" className="flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  저장된 담당자 ({savedRecipients.length})
                </TabsTrigger>
                <TabsTrigger value="pluuug" className="flex items-center gap-2">
                  <Cloud className="w-4 h-4" />
                  Pluuug 고객 ({pluuugClients.length})
                </TabsTrigger>
              </TabsList>

              {/* 저장된 담당자 탭 */}
              <TabsContent value="local">
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
                          <TableHead>Pluuug</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRecipients.map((recipient, index) => {
                          const synced = isAlreadySynced(recipient);
                          const key = `${recipient.company_name}-${recipient.contact_person}`;
                          return (
                            <TableRow key={recipient.id || index}>
                              <TableCell className="font-medium">{recipient.company_name}</TableCell>
                              <TableCell>{recipient.contact_person}</TableCell>
                              <TableCell>{recipient.phone}</TableCell>
                              <TableCell>{recipient.email}</TableCell>
                              <TableCell>
                                {synced ? (
                                  <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                    <Cloud className="w-3 h-3 mr-1" />
                                    연동됨
                                  </Badge>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleSyncToPluuug(recipient)}
                                    disabled={syncingToPluuug === key || pluuugLoading}
                                    className="text-xs"
                                  >
                                    {syncingToPluuug === key ? (
                                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                    ) : (
                                      <Upload className="w-3 h-3 mr-1" />
                                    )}
                                    Pluuug 등록
                                  </Button>
                                )}
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  onClick={() => handleSelectRecipient(recipient)}
                                >
                                  선택
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              {/* Pluuug 고객 탭 */}
              <TabsContent value="pluuug">
                {loadingPluuug ? (
                  <div className="text-center py-8 text-muted-foreground flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Pluuug 고객 불러오는 중...
                  </div>
                ) : filteredPluuugClients.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {searchTerm ? '검색 결과가 없습니다.' : 'Pluuug에 등록된 고객이 없습니다.'}
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>회사명</TableHead>
                          <TableHead>담당자</TableHead>
                          <TableHead>직책</TableHead>
                          <TableHead>연락처</TableHead>
                          <TableHead>이메일</TableHead>
                          <TableHead>상태</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPluuugClients.map((client) => (
                          <TableRow key={client.id}>
                            <TableCell className="font-medium">{client.companyName}</TableCell>
                            <TableCell>{client.inCharge}</TableCell>
                            <TableCell>{client.position || '-'}</TableCell>
                            <TableCell>{client.contact || '-'}</TableCell>
                            <TableCell>{client.email || '-'}</TableCell>
                            <TableCell>
                              {client.status && (
                                <Badge variant="outline" className="text-xs">
                                  {client.status.title}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                onClick={() => handleSelectPluuugClient(client)}
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
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RecipientInfoForm;