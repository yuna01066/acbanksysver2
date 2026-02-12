import React from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface LocalItem {
  id: string;
  name: string;
  description: string;
  unit_price: number;
  quantity: number;
  unit: string;
}

interface LocalSection {
  id: string;
  section_type: string;
  title: string;
  config: Record<string, any>;
  items: LocalItem[];
}

interface Props {
  name: string;
  sections: LocalSection[];
  vatOption: string;
  discountRate: number;
  notes: string;
  onClose: () => void;
}

const QuoteTemplatePreview: React.FC<Props> = ({
  name, sections, vatOption, discountRate, notes, onClose,
}) => {
  const subtotal = sections
    .filter(s => s.section_type === 'items')
    .reduce((sum, s) => sum + s.items.reduce((is, i) => is + i.unit_price * i.quantity, 0), 0);
  const discountAmount = Math.round(subtotal * discountRate / 100);
  const supplyAmount = subtotal - discountAmount;
  const vat = vatOption === 'separate' ? Math.round(supplyAmount * 0.1) : 0;
  const total = vatOption === 'excluded' ? supplyAmount : supplyAmount + vat;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>실제 견적서 미리보기</DialogTitle>
          <DialogDescription>
            실제 견적서는 로고, 견적서 제목, 견적일자, 견적번호, 담당자, 공급자 정보, 수신자 정보가 포함돼요.
            위 정보들은 기본 설정과 연결 고객 정보, 그리고 생성 일시에 따라 자동 입력돼요.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted/30 rounded-lg p-6 space-y-4">
          {/* Header area */}
          <div className="flex items-start justify-between">
            <div>
              <div className="bg-primary/10 text-primary text-xs px-3 py-1.5 rounded inline-block mb-2">로고</div>
              <p className="text-xs text-muted-foreground">회사명</p>
            </div>
          </div>

          <h2 className="text-xl font-bold">{'{의뢰 제목}'} 견적서</h2>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>견적일자 0000년 0월 00일</span>
            <span>No. 000000-0</span>
            <span>담당자 +</span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs border-t pt-3">
            <div>
              <p className="font-medium mb-1">공급자</p>
              <p>주식회사 회사명</p>
              <p className="text-muted-foreground">사업자 123-45-67890</p>
            </div>
            <div>
              <p className="font-medium mb-1">수신자</p>
              <p>{'{고객 회사명}'}</p>
              <p className="text-muted-foreground">수신자 {'{고객 담당자}'}</p>
            </div>
          </div>

          {/* Sections */}
          {sections.map(section => {
            if (section.section_type === 'divider') {
              return <hr key={section.id} className="border-border" />;
            }
            if (section.section_type === 'image') {
              return (
                <div key={section.id} className="bg-muted/50 rounded p-4 text-center text-xs text-muted-foreground">
                  [이미지 영역]
                </div>
              );
            }
            if (section.section_type === 'info') {
              return (
                <div key={section.id} className="text-sm">
                  <p className="font-medium">{section.title}</p>
                  <p className="text-muted-foreground text-xs">{section.config.content || '내용 없음'}</p>
                </div>
              );
            }
            // items / formula
            const sectionTotal = section.items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
            return (
              <div key={section.id}>
                <p className="font-semibold text-sm mb-1">▎ {section.title}</p>
                <table className="w-full text-xs border">
                  <thead>
                    <tr className="bg-foreground text-background">
                      <th className="text-left p-1.5">항목</th>
                      <th className="text-left p-1.5">설명</th>
                      <th className="text-right p-1.5">단가</th>
                      <th className="text-center p-1.5">수량</th>
                      <th className="text-right p-1.5">금액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.items.map(item => (
                      <tr key={item.id} className="border-t">
                        <td className="p-1.5">{item.name || '항목 이름'}</td>
                        <td className="p-1.5 text-muted-foreground">{item.description || '설명 없음'}</td>
                        <td className="p-1.5 text-right">₩{item.unit_price.toLocaleString()}</td>
                        <td className="p-1.5 text-center">{item.quantity}</td>
                        <td className="p-1.5 text-right font-medium">₩{(item.unit_price * item.quantity).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}

          {/* Notes */}
          {notes && (
            <div className="text-xs">
              <p className="font-medium">참고사항</p>
              <p className="text-muted-foreground whitespace-pre-wrap">{notes}</p>
            </div>
          )}

          {/* Totals */}
          <div className="border-t pt-3 text-xs space-y-1">
            <div className="flex justify-between"><span>총 합계</span><span className="font-bold">₩{subtotal.toLocaleString()}</span></div>
            {discountRate > 0 && (
              <div className="flex justify-between"><span>할인 ({discountRate}%)</span><span className="text-destructive">-₩{discountAmount.toLocaleString()}</span></div>
            )}
            <div className="flex justify-between"><span>공급가액</span><span>₩{supplyAmount.toLocaleString()}</span></div>
            {vatOption === 'separate' && (
              <div className="flex justify-between"><span>VAT (10%)</span><span>₩{vat.toLocaleString()}</span></div>
            )}
            <div className="flex justify-between bg-foreground text-background p-2 rounded font-bold">
              <span>최종 견적</span><span>₩{total.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QuoteTemplatePreview;
