import React, { useState, useEffect, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Palette, Layers, Square, Maximize, Ruler, CalendarClock, MapPin, Package, Pencil, Check, X, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';

export interface ProjectSpecs {
  materials: string[];
  qualities: string[];
  colors: { name: string; hex?: string }[];
  thicknesses: string[];
  surfaces: string[];
  sizes: string[];
  quantity: number;
  productionSizes: string[];
  deliveryDates: string[];
  deliveryAddresses: string[];
}

/** Extract specs from linked quote items */
export function extractSpecsFromQuotes(linkedQuotes: any[]): ProjectSpecs {
  const allItems = linkedQuotes.flatMap((q: any) => {
    const items = Array.isArray(q.items) ? q.items : [];
    return items;
  });

  const colors: { name: string; hex?: string }[] = [];
  const seenColors = new Set<string>();
  allItems.forEach((i: any) => {
    if (i.selectedColor && !seenColors.has(i.selectedColor)) {
      seenColors.add(i.selectedColor);
      colors.push({ name: i.selectedColor, hex: i.selectedColorHex || undefined });
    }
  });

  const productionSizes: string[] = [];
  allItems.forEach((i: any) => {
    if (i.breakdown && Array.isArray(i.breakdown)) {
      i.breakdown.forEach((b: any) => {
        if (b.label && b.label.includes('원장')) productionSizes.push(b.label);
      });
    }
  });

  return {
    materials: [...new Set(allItems.map((i: any) => i.material).filter(Boolean))],
    qualities: [...new Set(allItems.map((i: any) => i.quality).filter(Boolean))],
    colors,
    thicknesses: [...new Set(allItems.map((i: any) => i.thickness).filter(Boolean))],
    surfaces: [...new Set(allItems.map((i: any) => i.surface).filter(Boolean))],
    sizes: [...new Set(allItems.map((i: any) => i.size).filter(Boolean))],
    quantity: allItems.reduce((sum: number, i: any) => sum + (i.quantity || 0), 0),
    productionSizes,
    deliveryDates: [...new Set(linkedQuotes.map((q: any) => q.desired_delivery_date).filter(Boolean))],
    deliveryAddresses: [...new Set(linkedQuotes.map((q: any) => q.recipient_address).filter(Boolean))],
  };
}

interface Props {
  projectId: string;
  specs: ProjectSpecs | null;
  linkedQuotes: any[];
}

const SpecRow = ({ icon: Icon, label, children, editMode, editContent }: {
  icon: any; label: string; children: React.ReactNode;
  editMode?: boolean; editContent?: React.ReactNode;
}) => (
  <div className="flex items-start gap-3 py-3 border-b last:border-b-0">
    <div className="flex items-center gap-2 w-28 shrink-0">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
    <div className="flex-1 text-sm">{editMode ? editContent : children}</div>
  </div>
);

const EditableTagList = ({ values, onChange, placeholder }: { values: string[]; onChange: (v: string[]) => void; placeholder: string }) => {
  const [inputVal, setInputVal] = useState('');
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1">
        {values.map((v, i) => (
          <Badge key={i} variant="secondary" className="text-xs gap-1 pr-1">
            {v}
            <button onClick={() => onChange(values.filter((_, idx) => idx !== i))} className="ml-0.5 hover:bg-muted rounded-full p-0.5">
              <X className="h-2.5 w-2.5" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-1">
        <Input
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          placeholder={placeholder}
          className="h-7 text-xs flex-1"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && inputVal.trim()) {
              e.preventDefault();
              onChange([...values, inputVal.trim()]);
              setInputVal('');
            }
          }}
        />
      </div>
    </div>
  );
};

const ProjectSpecsCard: React.FC<Props> = ({ projectId, specs: savedSpecs, linkedQuotes }) => {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editSpecs, setEditSpecs] = useState<ProjectSpecs | null>(null);

  const quoteSpecs = extractSpecsFromQuotes(linkedQuotes);
  const displaySpecs = savedSpecs || quoteSpecs;

  const startEdit = useCallback(() => {
    setEditSpecs({ ...displaySpecs, colors: [...displaySpecs.colors] });
    setEditing(true);
  }, [displaySpecs]);

  const cancelEdit = () => {
    setEditing(false);
    setEditSpecs(null);
  };

  const saveSpecs = useMutation({
    mutationFn: async (newSpecs: ProjectSpecs) => {
      const { error } = await supabase
        .from('projects')
        .update({ specs: newSpecs as any })
        .eq('id', projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-detail', projectId] });
      setEditing(false);
      setEditSpecs(null);
      toast.success('제작 사양이 저장되었습니다.');
    },
    onError: () => toast.error('저장에 실패했습니다.'),
  });

  const resetToQuoteSpecs = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('projects')
        .update({ specs: null })
        .eq('id', projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-detail', projectId] });
      setEditing(false);
      setEditSpecs(null);
      toast.success('견적서 기준으로 초기화되었습니다.');
    },
  });

  const updateField = <K extends keyof ProjectSpecs>(key: K, value: ProjectSpecs[K]) => {
    if (!editSpecs) return;
    setEditSpecs({ ...editSpecs, [key]: value });
  };

  const hasQuoteItems = linkedQuotes.some((q: any) => Array.isArray(q.items) && q.items.length > 0);

  if (!hasQuoteItems && !savedSpecs) {
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

  const specs = editing && editSpecs ? editSpecs : displaySpecs;

  return (
    <Card className="shadow-none h-full">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold">제작 사양</h3>
          <div className="flex items-center gap-1">
            {editing ? (
              <>
                {savedSpecs && (
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 px-1.5 text-muted-foreground" onClick={() => resetToQuoteSpecs.mutate()}>
                    <RefreshCw className="h-2.5 w-2.5" /> 견적서 기준 초기화
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 px-1.5" onClick={cancelEdit}>
                  <X className="h-2.5 w-2.5" /> 취소
                </Button>
                <Button size="sm" className="h-6 text-[10px] gap-1 px-2" onClick={() => editSpecs && saveSpecs.mutate(editSpecs)} disabled={saveSpecs.isPending}>
                  <Check className="h-2.5 w-2.5" /> 저장
                </Button>
              </>
            ) : (
              <>
                {savedSpecs && (
                  <Badge variant="outline" className="text-[9px] mr-1">수정됨</Badge>
                )}
                <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 px-1.5" onClick={startEdit}>
                  <Pencil className="h-2.5 w-2.5" /> 수정
                </Button>
              </>
            )}
          </div>
        </div>

        {/* 재질/품질 */}
        <SpecRow icon={Layers} label="재질 / 품질" editMode={editing}
          editContent={
            <div className="space-y-2">
              <EditableTagList values={editSpecs?.materials || []} onChange={(v) => updateField('materials', v)} placeholder="재질 추가..." />
              <EditableTagList values={editSpecs?.qualities || []} onChange={(v) => updateField('qualities', v)} placeholder="품질 추가..." />
            </div>
          }
        >
          <div className="flex flex-wrap gap-1.5">
            {specs.materials.map((m, i) => <Badge key={`m-${i}`} variant="secondary" className="text-xs">{m}</Badge>)}
            {specs.qualities.map((q, i) => <Badge key={`q-${i}`} variant="outline" className="text-xs">{q}</Badge>)}
            {specs.materials.length === 0 && specs.qualities.length === 0 && <span className="text-xs text-muted-foreground">-</span>}
          </div>
        </SpecRow>

        {/* 컬러 */}
        <SpecRow icon={Palette} label="컬러" editMode={editing}
          editContent={
            <EditableTagList
              values={editSpecs?.colors.map(c => c.name) || []}
              onChange={(v) => updateField('colors', v.map(name => ({ name })))}
              placeholder="컬러 추가..."
            />
          }
        >
          <div className="flex flex-wrap gap-1.5">
            {specs.colors.length > 0 ? specs.colors.map((c, i) => (
              <div key={i} className="flex items-center gap-1.5">
                {c.hex && <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: c.hex }} />}
                <Badge variant="secondary" className="text-xs">{c.name}</Badge>
              </div>
            )) : <span className="text-xs text-muted-foreground">-</span>}
          </div>
        </SpecRow>

        {/* 두께 */}
        <SpecRow icon={Layers} label="두께" editMode={editing}
          editContent={<EditableTagList values={editSpecs?.thicknesses || []} onChange={(v) => updateField('thicknesses', v)} placeholder="두께 추가..." />}
        >
          <div className="flex flex-wrap gap-1.5">
            {specs.thicknesses.length > 0 ? specs.thicknesses.map((t, i) => <Badge key={i} variant="secondary" className="text-xs">{t}</Badge>) : <span className="text-xs text-muted-foreground">-</span>}
          </div>
        </SpecRow>

        {/* 양단면 */}
        <SpecRow icon={Square} label="양단면" editMode={editing}
          editContent={<EditableTagList values={editSpecs?.surfaces || []} onChange={(v) => updateField('surfaces', v)} placeholder="면수 추가..." />}
        >
          <div className="flex flex-wrap gap-1.5">
            {specs.surfaces.length > 0 ? specs.surfaces.map((s, i) => <Badge key={i} variant="outline" className="text-xs">{s}</Badge>) : <span className="text-xs text-muted-foreground">-</span>}
          </div>
        </SpecRow>

        {/* 원판사이즈 및 수량 */}
        <SpecRow icon={Maximize} label="원판사이즈" editMode={editing}
          editContent={
            <div className="space-y-2">
              <EditableTagList values={editSpecs?.sizes || []} onChange={(v) => updateField('sizes', v)} placeholder="사이즈 추가..." />
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">총 수량:</span>
                <Input type="number" className="h-7 text-xs w-20" value={editSpecs?.quantity || 0} onChange={(e) => updateField('quantity', parseInt(e.target.value) || 0)} />
                <span className="text-xs">개</span>
              </div>
            </div>
          }
        >
          <div className="space-y-1">
            {specs.sizes.length > 0 ? specs.sizes.map((s, i) => <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>) : <span className="text-xs text-muted-foreground">-</span>}
            <p className="text-xs text-muted-foreground">총 수량: {specs.quantity}개</p>
          </div>
        </SpecRow>

        {/* 제작 사이즈 */}
        <SpecRow icon={Ruler} label="제작 사이즈" editMode={editing}
          editContent={<EditableTagList values={editSpecs?.productionSizes || []} onChange={(v) => updateField('productionSizes', v)} placeholder="제작 사이즈 추가..." />}
        >
          {specs.productionSizes.length > 0 ? (
            <div className="space-y-0.5">{specs.productionSizes.map((s, i) => <p key={i} className="text-xs">{s}</p>)}</div>
          ) : <span className="text-xs text-muted-foreground">-</span>}
        </SpecRow>

        {/* 납기 희망일 */}
        <SpecRow icon={CalendarClock} label="납기 희망일" editMode={editing}
          editContent={<EditableTagList values={editSpecs?.deliveryDates || []} onChange={(v) => updateField('deliveryDates', v)} placeholder="날짜 추가 (yyyy-MM-dd)..." />}
        >
          {specs.deliveryDates.length > 0 ? (
            <div className="space-y-0.5">
              {specs.deliveryDates.map((d, i) => (
                <p key={i} className="text-sm font-medium">
                  {(() => { try { return format(new Date(d), 'yyyy년 M월 d일', { locale: ko }); } catch { return String(d); } })()}
                </p>
              ))}
            </div>
          ) : <span className="text-xs text-muted-foreground">미정</span>}
        </SpecRow>

        {/* 납품 배송지 */}
        <SpecRow icon={MapPin} label="납품 배송지" editMode={editing}
          editContent={<EditableTagList values={editSpecs?.deliveryAddresses || []} onChange={(v) => updateField('deliveryAddresses', v)} placeholder="배송지 추가..." />}
        >
          {specs.deliveryAddresses.length > 0 ? (
            <div className="space-y-0.5">{specs.deliveryAddresses.map((a, i) => <p key={i} className="text-sm">{a}</p>)}</div>
          ) : <span className="text-xs text-muted-foreground">미지정</span>}
        </SpecRow>
      </CardContent>
    </Card>
  );
};

export default ProjectSpecsCard;
