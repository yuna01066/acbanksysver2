import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Building2, User, Phone, Mail, MapPin, FileText, Hash, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Props {
  recipientId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const RecipientDetailSheet: React.FC<Props> = ({ recipientId, open, onOpenChange }) => {
  const navigate = useNavigate();

  const { data: recipient, isLoading } = useQuery({
    queryKey: ['recipient-detail', recipientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recipients')
        .select('*')
        .eq('id', recipientId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!recipientId && open,
  });

  const InfoRow = ({ icon: Icon, label, value }: { icon: any; label: string; value: string | null | undefined }) => (
    <div className="flex items-start gap-3 py-2.5 border-b last:border-b-0">
      <div className="flex items-center gap-2 w-28 shrink-0">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <span className="text-sm flex-1">{value || '-'}</span>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            고객사 상세 정보
          </SheetTitle>
        </SheetHeader>

        {isLoading || !recipient ? (
          <div className="flex items-center justify-center h-40">
            <p className="text-sm text-muted-foreground">로딩 중...</p>
          </div>
        ) : (
          <div className="space-y-6 mt-4">
            {/* 업체 정보 */}
            <div>
              <h3 className="text-sm font-bold mb-2">업체 정보</h3>
              <div className="bg-muted/30 rounded-lg p-4">
                <InfoRow icon={Building2} label="회사명" value={recipient.company_name} />
                <InfoRow icon={Building2} label="사업자명" value={recipient.business_name} />
              </div>
            </div>

            {/* 프로젝트 담당자 */}
            <div>
              <h3 className="text-sm font-bold mb-2">프로젝트 담당자</h3>
              <div className="bg-muted/30 rounded-lg p-4">
                <InfoRow icon={User} label="담당자" value={recipient.contact_person} />
                <InfoRow icon={User} label="직위" value={recipient.position} />
                <InfoRow icon={Phone} label="연락처" value={recipient.phone} />
                <InfoRow icon={Mail} label="이메일" value={recipient.email} />
                <InfoRow icon={MapPin} label="주소" value={
                  [recipient.address, recipient.detail_address].filter(Boolean).join(' ') || null
                } />
              </div>
            </div>

            {/* 회계 담당자 */}
            <div>
              <h3 className="text-sm font-bold mb-2">회계 담당자</h3>
              <div className="bg-muted/30 rounded-lg p-4">
                <InfoRow icon={User} label="담당자" value={recipient.accounting_contact_person} />
                <InfoRow icon={User} label="직위" value={recipient.accounting_position} />
                <InfoRow icon={Phone} label="연락처" value={recipient.accounting_phone} />
                <InfoRow icon={Mail} label="이메일" value={recipient.accounting_email} />
              </div>
            </div>

            {/* 사업자 정보 */}
            <div>
              <h3 className="text-sm font-bold mb-2">사업자 정보</h3>
              <div className="bg-muted/30 rounded-lg p-4">
                <InfoRow icon={User} label="대표자" value={recipient.ceo_name} />
                <InfoRow icon={Hash} label="사업자번호" value={recipient.business_registration_number} />
                <InfoRow icon={FileText} label="업태" value={recipient.business_type} />
                <InfoRow icon={FileText} label="업종" value={recipient.business_class} />
                <InfoRow icon={Hash} label="종사업장번호" value={recipient.branch_number} />
              </div>
            </div>

            {/* 사업자등록증 */}
            <div>
              <h3 className="text-sm font-bold mb-2">사업자등록증</h3>
              {recipient.business_document_url ? (
                <div className="bg-muted/30 rounded-lg p-4">
                  <a
                    href={recipient.business_document_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <FileText className="h-4 w-4" />
                    사업자등록증 보기
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ) : (
                <div className="bg-muted/30 rounded-lg p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-2">등록된 사업자등록증이 없습니다.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      onOpenChange(false);
                      navigate('/recipient-management');
                    }}
                  >
                    고객사 관리에서 등록하기
                  </Button>
                </div>
              )}
            </div>

            {/* 메모 */}
            {recipient.memo && (
              <div>
                <h3 className="text-sm font-bold mb-2">메모</h3>
                <div className="bg-muted/30 rounded-lg p-4">
                  <p className="text-sm whitespace-pre-wrap">{recipient.memo}</p>
                </div>
              </div>
            )}

            {/* 관리 페이지 이동 */}
            <Button
              variant="outline"
              className="w-full text-sm gap-2"
              onClick={() => {
                onOpenChange(false);
                navigate('/recipient-management');
              }}
            >
              <Building2 className="h-4 w-4" />
              고객사 관리 페이지로 이동
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default RecipientDetailSheet;
