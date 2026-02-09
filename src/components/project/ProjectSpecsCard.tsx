import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Palette, Layers, Square, Maximize, Ruler, CalendarClock, MapPin, Package } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface Props {
  linkedQuotes: any[];
}

const ProjectSpecsCard: React.FC<Props> = ({ linkedQuotes }) => {
  // Extract specs from linked quote items
  const allItems = linkedQuotes.flatMap((q: any) => {
    const items = Array.isArray(q.items) ? q.items : [];
    return items.map((item: any) => ({ ...item, quoteNumber: q.quote_number, desiredDeliveryDate: q.desired_delivery_date, recipientAddress: q.recipient_address }));
  });

  // Aggregate unique specs
  const colors = [...new Set(allItems.map((i: any) => i.selectedColor).filter(Boolean))];
  const colorHexMap: Record<string, string> = {};
  allItems.forEach((i: any) => {
    if (i.selectedColor && i.selectedColorHex) colorHexMap[i.selectedColor] = i.selectedColorHex;
  });
  const thicknesses = [...new Set(allItems.map((i: any) => i.thickness).filter(Boolean))];
  const surfaces = [...new Set(allItems.map((i: any) => i.surface).filter(Boolean))];
  const sizes = [...new Set(allItems.map((i: any) => i.size).filter(Boolean))];
  const quantities = allItems.reduce((sum: number, i: any) => sum + (i.quantity || 0), 0);
  const materials = [...new Set(allItems.map((i: any) => i.material).filter(Boolean))];
  const qualities = [...new Set(allItems.map((i: any) => i.quality).filter(Boolean))];

  // Production sizes from breakdown
  const productionSizes: string[] = [];
  allItems.forEach((i: any) => {
    if (i.breakdown && Array.isArray(i.breakdown)) {
      i.breakdown.forEach((b: any) => {
        if (b.label && b.label.includes('원장')) {
          productionSizes.push(b.label);
        }
      });
    }
  });

  // Delivery dates & addresses
  const deliveryDates = [...new Set(linkedQuotes.map((q: any) => q.desired_delivery_date).filter(Boolean))];
  const addresses = [...new Set(linkedQuotes.map((q: any) => q.recipient_address).filter(Boolean))];

  const SpecRow = ({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) => (
    <div className="flex items-start gap-3 py-3 border-b last:border-b-0">
      <div className="flex items-center gap-2 w-28 shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <div className="flex-1 text-sm">{children}</div>
    </div>
  );

  if (allItems.length === 0) {
    return (
      <Card className="shadow-none h-full">
        <CardContent className="p-6 flex items-center justify-center h-full">
          <div className="text-center">
            <Package className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">연결된 견적서의 제작 사양이 여기에 표시됩니다.</p>
            <p className="text-xs text-muted-foreground mt-1">먼저 견적서를 연결해주세요.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-none h-full">
      <CardContent className="p-5">
        <h3 className="text-sm font-bold mb-3">제작 사양</h3>

        {/* 재질/품질 */}
        {(materials.length > 0 || qualities.length > 0) && (
          <SpecRow icon={Layers} label="재질 / 품질">
            <div className="flex flex-wrap gap-1.5">
              {materials.map((m, i) => (
                <Badge key={`m-${i}`} variant="secondary" className="text-xs">{m}</Badge>
              ))}
              {qualities.map((q, i) => (
                <Badge key={`q-${i}`} variant="outline" className="text-xs">{q}</Badge>
              ))}
            </div>
          </SpecRow>
        )}

        {/* 컬러 */}
        <SpecRow icon={Palette} label="컬러">
          <div className="flex flex-wrap gap-1.5">
            {colors.length > 0 ? colors.map((c, i) => (
              <div key={i} className="flex items-center gap-1.5">
                {colorHexMap[c] && (
                  <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: colorHexMap[c] }} />
                )}
                <Badge variant="secondary" className="text-xs">{c}</Badge>
              </div>
            )) : <span className="text-xs text-muted-foreground">-</span>}
          </div>
        </SpecRow>

        {/* 두께 */}
        <SpecRow icon={Layers} label="두께">
          <div className="flex flex-wrap gap-1.5">
            {thicknesses.length > 0 ? thicknesses.map((t, i) => (
              <Badge key={i} variant="secondary" className="text-xs">{t}</Badge>
            )) : <span className="text-xs text-muted-foreground">-</span>}
          </div>
        </SpecRow>

        {/* 양단면 */}
        <SpecRow icon={Square} label="양단면">
          <div className="flex flex-wrap gap-1.5">
            {surfaces.length > 0 ? surfaces.map((s, i) => (
              <Badge key={i} variant="outline" className="text-xs">{s}</Badge>
            )) : <span className="text-xs text-muted-foreground">-</span>}
          </div>
        </SpecRow>

        {/* 원판사이즈 및 수량 */}
        <SpecRow icon={Maximize} label="원판사이즈">
          <div className="space-y-1">
            {sizes.length > 0 ? sizes.map((s, i) => (
              <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
            )) : <span className="text-xs text-muted-foreground">-</span>}
            <p className="text-xs text-muted-foreground">총 수량: {quantities}개</p>
          </div>
        </SpecRow>

        {/* 제작 사이즈 */}
        {productionSizes.length > 0 && (
          <SpecRow icon={Ruler} label="제작 사이즈">
            <div className="space-y-0.5">
              {productionSizes.map((s, i) => (
                <p key={i} className="text-xs">{s}</p>
              ))}
            </div>
          </SpecRow>
        )}

        {/* 납기 희망일 */}
        <SpecRow icon={CalendarClock} label="납기 희망일">
          {deliveryDates.length > 0 ? (
            <div className="space-y-0.5">
              {deliveryDates.map((d, i) => (
                <p key={i} className="text-sm font-medium">
                  {(() => { try { return format(new Date(d), 'yyyy년 M월 d일', { locale: ko }); } catch { return d; } })()}
                </p>
              ))}
            </div>
          ) : <span className="text-xs text-muted-foreground">미정</span>}
        </SpecRow>

        {/* 납품 배송지 */}
        <SpecRow icon={MapPin} label="납품 배송지">
          {addresses.length > 0 ? (
            <div className="space-y-0.5">
              {addresses.map((a, i) => (
                <p key={i} className="text-sm">{a}</p>
              ))}
            </div>
          ) : <span className="text-xs text-muted-foreground">미지정</span>}
        </SpecRow>
      </CardContent>
    </Card>
  );
};

export default ProjectSpecsCard;
