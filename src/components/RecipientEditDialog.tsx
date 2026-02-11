import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Pencil } from 'lucide-react';
import { Recipient, RecipientInput } from '@/hooks/useRecipients';
import { toast } from 'sonner';

interface RecipientEditDialogProps {
  recipient: Recipient | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, updates: Partial<RecipientInput>) => Promise<Recipient | null>;
}

export function RecipientEditDialog({
  recipient,
  open,
  onOpenChange,
  onSave,
}: RecipientEditDialogProps) {
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [companyName, setCompanyName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [position, setPosition] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [detailAddress, setDetailAddress] = useState('');
  const [ceoName, setCeoName] = useState('');
  const [businessRegistrationNumber, setBusinessRegistrationNumber] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [businessClass, setBusinessClass] = useState('');
  const [branchNumber, setBranchNumber] = useState('');
  const [accountingContactPerson, setAccountingContactPerson] = useState('');
  const [accountingPosition, setAccountingPosition] = useState('');
  const [accountingPhone, setAccountingPhone] = useState('');
  const [accountingEmail, setAccountingEmail] = useState('');
  const [memo, setMemo] = useState('');

  // Reset form when recipient changes
  useEffect(() => {
    if (recipient) {
      setCompanyName(recipient.company_name || '');
      setBusinessName(recipient.business_name || '');
      setContactPerson(recipient.contact_person || '');
      setPosition(recipient.position || '');
      setPhone(recipient.phone || '');
      setEmail(recipient.email || '');
      setAddress(recipient.address || '');
      setDetailAddress(recipient.detail_address || '');
      setCeoName(recipient.ceo_name || '');
      setBusinessRegistrationNumber(recipient.business_registration_number || '');
      setBusinessType(recipient.business_type || '');
      setBusinessClass(recipient.business_class || '');
      setBranchNumber(recipient.branch_number || '');
      setAccountingContactPerson(recipient.accounting_contact_person || '');
      setAccountingPosition(recipient.accounting_position || '');
      setAccountingPhone(recipient.accounting_phone || '');
      setAccountingEmail(recipient.accounting_email || '');
      setMemo(recipient.memo || '');
    }
  }, [recipient]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!recipient) return;

    if (!companyName.trim()) {
      toast.error('회사명을 입력해주세요.');
      return;
    }
    if (!contactPerson.trim()) {
      toast.error('프로젝트 담당자명을 입력해주세요.');
      return;
    }
    if (!phone.trim()) {
      toast.error('연락처를 입력해주세요.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      toast.error('올바른 이메일을 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      const updates: Partial<RecipientInput> = {
        company_name: companyName.trim(),
        business_name: businessName.trim() || undefined,
        contact_person: contactPerson.trim(),
        position: position.trim() || '담당자',
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim() || undefined,
        detail_address: detailAddress.trim() || undefined,
        ceo_name: ceoName.trim() || contactPerson.trim(),
        business_registration_number: businessRegistrationNumber.trim() || '000-00-00000',
        business_type: businessType.trim() || '서비스업',
        business_class: businessClass.trim() || '기타',
        branch_number: branchNumber.trim() || '00',
        accounting_contact_person: accountingContactPerson.trim() || undefined,
        accounting_position: accountingPosition.trim() || undefined,
        accounting_phone: accountingPhone.trim() || undefined,
        accounting_email: accountingEmail.trim() || undefined,
        memo: memo.trim() || undefined,
      };

      const result = await onSave(recipient.id, updates);
      
      if (result) {
        toast.success('고객사 정보가 수정되었습니다.');
        onOpenChange(false);
      }
    } catch (err) {
      console.error('고객사 수정 에러:', err);
      toast.error('고객사 정보 수정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" />
            고객사 정보 수정
          </DialogTitle>
          <DialogDescription>
            고객사 상세 정보를 수정할 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 업체 정보 */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground border-b pb-2">
              업체 정보
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">회사명 *</Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="회사명을 입력하세요"
                  required
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="businessName">사업자명</Label>
                <Input
                  id="businessName"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="회사명과 다를 경우 입력"
                  maxLength={100}
                />
              </div>
            </div>
          </div>

          {/* 프로젝트 담당자 */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground border-b pb-2">
              프로젝트 담당자
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contactPerson">담당자명 *</Label>
                <Input
                  id="contactPerson"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="담당자명을 입력하세요"
                  required
                  maxLength={50}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="position">직책</Label>
                <Input
                  id="position"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  placeholder="예: 과장, 팀장"
                  maxLength={30}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">연락처 *</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="010-1234-5678"
                  required
                  maxLength={20}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">이메일 *</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@company.com"
                  required
                  maxLength={100}
                />
              </div>
            </div>
          </div>

          {/* 회계 담당자 */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground border-b pb-2">
              회계 담당자
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="accountingContactPerson">담당자명</Label>
                <Input
                  id="accountingContactPerson"
                  value={accountingContactPerson}
                  onChange={(e) => setAccountingContactPerson(e.target.value)}
                  placeholder="회계 담당자명"
                  maxLength={50}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountingPosition">직책</Label>
                <Input
                  id="accountingPosition"
                  value={accountingPosition}
                  onChange={(e) => setAccountingPosition(e.target.value)}
                  placeholder="예: 과장, 팀장"
                  maxLength={30}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountingPhone">연락처</Label>
                <Input
                  id="accountingPhone"
                  value={accountingPhone}
                  onChange={(e) => setAccountingPhone(e.target.value)}
                  placeholder="010-1234-5678"
                  maxLength={20}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountingEmail">이메일</Label>
                <Input
                  id="accountingEmail"
                  type="email"
                  value={accountingEmail}
                  onChange={(e) => setAccountingEmail(e.target.value)}
                  placeholder="accounting@company.com"
                  maxLength={100}
                />
              </div>
            </div>
          </div>

          {/* 사업자 정보 */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground border-b pb-2">
              사업자 정보 (Pluuug 연동용)
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ceoName">담당자명 (Pluuug)</Label>
                <Input
                  id="ceoName"
                  value={ceoName}
                  onChange={(e) => setCeoName(e.target.value)}
                  placeholder="대표자명"
                  maxLength={50}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="businessRegistrationNumber">사업자등록번호</Label>
                <Input
                  id="businessRegistrationNumber"
                  value={businessRegistrationNumber}
                  onChange={(e) => setBusinessRegistrationNumber(e.target.value)}
                  placeholder="000-00-00000"
                  maxLength={20}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="businessType">업태</Label>
                <Input
                  id="businessType"
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  placeholder="예: 서비스업, 제조업"
                  maxLength={50}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="businessClass">업종</Label>
                <Input
                  id="businessClass"
                  value={businessClass}
                  onChange={(e) => setBusinessClass(e.target.value)}
                  placeholder="예: 소프트웨어 개발"
                  maxLength={50}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="branchNumber">종사업장번호</Label>
                <Input
                  id="branchNumber"
                  value={branchNumber}
                  onChange={(e) => setBranchNumber(e.target.value)}
                  placeholder="00"
                  maxLength={10}
                />
              </div>
            </div>
          </div>

          {/* 주소 정보 */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground border-b pb-2">
              주소 정보
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="address">주소</Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="기본 주소"
                  maxLength={200}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="detailAddress">상세 주소</Label>
                <Input
                  id="detailAddress"
                  value={detailAddress}
                  onChange={(e) => setDetailAddress(e.target.value)}
                  placeholder="상세 주소"
                  maxLength={100}
                />
              </div>
            </div>
          </div>

          {/* 메모 */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground border-b pb-2">
              메모
            </h3>
            <div className="space-y-2">
              <Textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="고객사에 대한 메모를 입력하세요"
                rows={3}
                maxLength={500}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              취소
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  저장 중...
                </>
              ) : (
                '저장'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
