import React, { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Palette, Layers, Square, Maximize, Ruler, CalendarClock, MapPin, Package, Pencil, Check, X, RefreshCw, MessageSquareText, Plus, Trash2, Type } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';
import { AddCustomFieldDialog, CustomField } from './AddCustomFieldDialog';

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
  clientRequests: string;
  customFields?: CustomField[];
}

/** Multi-quote specs stored as { _perQuote: { [quoteId]: ProjectSpecs } } or legacy single ProjectSpecs */
export interface MultiQuoteSpecs {
  _perQuote?: Record<string, ProjectSpecs>;
}

/** Extract specs from a single quote's items */
export function extractSpecsFromQuote(quote: any): ProjectSpecs {
  const items = Array.isArray(quote.items) ? quote.items : [];

  const colors: { name: string; hex?: string }[] = [];
  const seenColors = new Set<string>();
  items.forEach((i: any) => {
    if (i.selectedColor && !seenColors.has(i.selectedColor)) {
      seenColors.add(i.selectedColor);
      colors.push({ name: i.selectedColor, hex: i.selectedColorHex || undefined });
    }
  });

  const productionSizes: string[] = [];
  items.forEach((i: any) => {
    if (i.breakdown && Array.isArray(i.breakdown)) {
      i.breakdown.forEach((b: any) => {
        if (b.label && b.label.includes('원장')) productionSizes.push(b.label);
      });
    }
  });

  return {
    materials: [...new Set(items.map((i: any) => i.material).filter(Boolean))] as string[],
    qualities: [...new Set(items.map((i: any) => i.quality).filter(Boolean))] as string[],
    colors,
    thicknesses: [...new Set(items.map((i: any) => i.thickness).filter(Boolean))] as string[],
    surfaces: [...new Set(items.map((i: any) => i.surface).filter(Boolean))] as string[],
    sizes: [...new Set(items.map((i: any) => i.size).filter(Boolean))] as string[],
    quantity: items.reduce((sum: number, i: any) => sum + (i.quantity || 0), 0),
    productionSizes,
    deliveryDates: quote.desired_delivery_date ? [quote.desired_delivery_date] : [],
    deliveryAddresses: quote.recipient_address ? [quote.recipient_address] : [],
    clientRequests: quote.recipient_memo || '',
    customFields: [],
  };
}

/** Extract specs from all linked quotes combined (legacy) */
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
    clientRequests: linkedQuotes.map((q: any) => q.recipient_memo).filter(Boolean).join('\n') || '',
    customFields: [],
  };
}

interface Props {
  projectId: string;
  specs: any; // ProjectSpecs | MultiQuoteSpecs | null
  linkedQuotes: any[];
}

const SpecRow = ({ icon: Icon, label, children, editMode, editContent, compact }: {
  icon: any; label: string; children: React.ReactNode;
  editMode?: boolean; editContent?: React.ReactNode; compact?: boolean;
}) => (
  <div className={cn("flex items-start gap-2 border-b last:border-b-0", compact ? "py-1.5" : "py-2")}>
    <div className="flex items-center gap-1.5 w-24 shrink-0">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
    <div className="flex-1 text-sm">{editMode ? editContent : children}</div>
  </div>
);

const EditableTagList = ({ values, onChange, placeholder }: { values: string[]; onChange: (v: string[]) => void; placeholder: string }) => {
  const [inputVal, setInputVal] = useState('');
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1">
        {values.map((v, i) => (
          <Badge key={i} variant="secondary" className="text-[10px] gap-0.5 pr-0.5 h-5">
            {v}
            <button onClick={() => onChange(values.filter((_, idx) => idx !== i))} className="ml-0.5 hover:bg-muted rounded-full p-0.5">
              <X className="h-2 w-2" />
            </button>
          </Badge>
        ))}
      </div>
      <Input
        value={inputVal}
        onChange={(e) => setInputVal(e.target.value)}
        placeholder={placeholder}
        className="h-6 text-xs"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && inputVal.trim()) {
            e.preventDefault();
            onChange([...values, inputVal.trim()]);
            setInputVal('');
          }
        }}
      />
    </div>
  );
};

const CustomFieldDisplay = ({ field, editing, onUpdate, onRemove }: {
  field: CustomField; editing: boolean;
  onUpdate: (value: any) => void; onRemove: () => void;
}) => {
  const renderValue = () => {
    if (field.type === 'boolean') return field.value ? '예' : '아니오';
    if (field.type === 'date' && field.value) {
      try { return format(new Date(field.value as string), 'yyyy년 M월 d일', { locale: ko }); } catch { return String(field.value); }
    }
    if (field.type === 'tags' && Array.isArray(field.value)) return (field.value as string[]).join(', ') || '-';
    if (field.type === 'single_select') return field.value ? String(field.value) : '-';
    if (field.type === 'multi_select' && Array.isArray(field.value)) return (field.value as string[]).join(', ') || '-';
    return field.value ? String(field.value) : '-';
  };

  const renderEditContent = () => {
    switch (field.type) {
      case 'text':
        return <Input className="h-6 text-xs" value={String(field.value || '')} onChange={(e) => onUpdate(e.target.value)} />;
      case 'number':
        return <Input type="number" className="h-6 text-xs w-28" value={String(field.value || '')} onChange={(e) => onUpdate(e.target.value)} />;
      case 'date':
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-6 text-xs">
                {field.value ? (() => { try { return format(new Date(field.value as string), 'yyyy-MM-dd'); } catch { return '날짜 선택'; } })() : '날짜 선택'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={field.value ? new Date(field.value as string) : undefined}
                onSelect={(d) => d && onUpdate(format(d, 'yyyy-MM-dd'))} locale={ko} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        );
      case 'boolean':
        return <Switch checked={!!field.value} onCheckedChange={onUpdate} />;
      case 'tags':
        return <EditableTagList values={Array.isArray(field.value) ? field.value as string[] : []} onChange={onUpdate} placeholder="값 추가..." />;
      case 'single_select':
        return (
          <Select value={String(field.value || '')} onValueChange={onUpdate}>
            <SelectTrigger className="h-6 text-xs"><SelectValue placeholder="선택..." /></SelectTrigger>
            <SelectContent>
              {(field.options || []).map(opt => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'multi_select': {
        const selected = Array.isArray(field.value) ? field.value as string[] : [];
        return (
          <div className="space-y-1">
            <div className="flex flex-wrap gap-1">
              {selected.map((v, i) => (
                <Badge key={i} variant="secondary" className="text-[10px] gap-0.5 pr-0.5 h-5">
                  {v}
                  <button onClick={() => onUpdate(selected.filter((_, idx) => idx !== i))} className="ml-0.5 hover:bg-muted rounded-full p-0.5">
                    <X className="h-2 w-2" />
                  </button>
                </Badge>
              ))}
            </div>
            <Select onValueChange={(v) => { if (!selected.includes(v)) onUpdate([...selected, v]); }}>
              <SelectTrigger className="h-6 text-xs"><SelectValue placeholder="항목 추가..." /></SelectTrigger>
              <SelectContent>
                {(field.options || []).filter(o => !selected.includes(o)).map(opt => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      }
      default:
        return <Input className="h-6 text-xs" value={String(field.value || '')} onChange={(e) => onUpdate(e.target.value)} />;
    }
  };

  return (
    <SpecRow icon={Type} label={field.label} editMode={editing} compact
      editContent={
        <div className="flex items-center gap-2">
          <div className="flex-1">{renderEditContent()}</div>
          <button onClick={onRemove} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
        </div>
      }
    >
      <span className="text-xs">{renderValue()}</span>
    </SpecRow>
  );
};

/** Single quote specs view (reusable for each tab) */
const SingleSpecsView = ({ projectId, quoteId, savedSpecs, quoteSpecs, allSavedSpecs }: {
  projectId: string;
  quoteId: string;
  savedSpecs: ProjectSpecs | null;
  quoteSpecs: ProjectSpecs;
  allSavedSpecs: any;
}) => {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editSpecs, setEditSpecs] = useState<ProjectSpecs | null>(null);
  const [showAddField, setShowAddField] = useState(false);

  const displaySpecs = savedSpecs || quoteSpecs;

  const startEdit = useCallback(() => {
    setEditSpecs({ ...displaySpecs, colors: [...displaySpecs.colors], customFields: [...(displaySpecs.customFields || [])] });
    setEditing(true);
  }, [displaySpecs]);

  const cancelEdit = () => { setEditing(false); setEditSpecs(null); };

  const saveSpecs = useMutation({
    mutationFn: async (newSpecs: ProjectSpecs) => {
      const perQuote = { ...(allSavedSpecs?._perQuote || {}) };
      perQuote[quoteId] = newSpecs;
      const { error } = await supabase.from('projects').update({ specs: { _perQuote: perQuote } as any }).eq('id', projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-detail', projectId] });
      setEditing(false); setEditSpecs(null);
      toast.success('제작 사양이 저장되었습니다.');
    },
    onError: () => toast.error('저장에 실패했습니다.'),
  });

  const resetToQuoteSpecs = useMutation({
    mutationFn: async () => {
      const perQuote = { ...(allSavedSpecs?._perQuote || {}) };
      delete perQuote[quoteId];
      const { error } = await supabase.from('projects').update({ specs: { _perQuote: perQuote } as any }).eq('id', projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-detail', projectId] });
      setEditing(false); setEditSpecs(null);
      toast.success('견적서 기준으로 초기화되었습니다.');
    },
  });

  const updateField = <K extends keyof ProjectSpecs>(key: K, value: ProjectSpecs[K]) => {
    if (!editSpecs) return;
    setEditSpecs({ ...editSpecs, [key]: value });
  };

  const handleAddCustomField = (field: CustomField) => {
    if (!editSpecs) return;
    const updated = [...(editSpecs.customFields || []), field];
    setEditSpecs({ ...editSpecs, customFields: updated });
  };

  const updateCustomFieldValue = (index: number, value: any) => {
    if (!editSpecs) return;
    const fields = [...(editSpecs.customFields || [])];
    fields[index] = { ...fields[index], value };
    setEditSpecs({ ...editSpecs, customFields: fields });
  };

  const removeCustomField = (index: number) => {
    if (!editSpecs) return;
    setEditSpecs({ ...editSpecs, customFields: (editSpecs.customFields || []).filter((_, i) => i !== index) });
  };

  const specs = editing && editSpecs ? editSpecs : displaySpecs;

  return (
    <div>
      <div className="flex items-center justify-end mb-2">
        <div className="flex items-center gap-1">
          {editing ? (
            <>
              {savedSpecs && (
                <Button variant="ghost" size="sm" className="h-5 text-[10px] gap-0.5 px-1.5 text-muted-foreground" onClick={() => resetToQuoteSpecs.mutate()}>
                  <RefreshCw className="h-2.5 w-2.5" /> 초기화
                </Button>
              )}
              <Button variant="ghost" size="sm" className="h-5 text-[10px] gap-0.5 px-1.5" onClick={cancelEdit}>
                <X className="h-2.5 w-2.5" /> 취소
              </Button>
              <Button size="sm" className="h-5 text-[10px] gap-0.5 px-1.5" onClick={() => editSpecs && saveSpecs.mutate(editSpecs)} disabled={saveSpecs.isPending}>
                <Check className="h-2.5 w-2.5" /> 저장
              </Button>
            </>
          ) : (
            <>
              {savedSpecs && <Badge variant="outline" className="text-[9px] mr-1">수정됨</Badge>}
              <Button variant="ghost" size="sm" className="h-5 text-[10px] gap-0.5 px-1.5" onClick={startEdit}>
                <Pencil className="h-2.5 w-2.5" /> 수정
              </Button>
            </>
          )}
        </div>
      </div>

      <SpecRow icon={Layers} label="재질/품질" editMode={editing} compact
        editContent={
          <div className="space-y-1.5">
            <EditableTagList values={editSpecs?.materials || []} onChange={(v) => updateField('materials', v)} placeholder="재질 추가..." />
            <EditableTagList values={editSpecs?.qualities || []} onChange={(v) => updateField('qualities', v)} placeholder="품질 추가..." />
          </div>
        }
      >
        <div className="flex flex-wrap gap-1">
          {specs.materials.map((m, i) => <Badge key={`m-${i}`} variant="secondary" className="text-[10px] h-5">{m}</Badge>)}
          {specs.qualities.map((q, i) => <Badge key={`q-${i}`} variant="outline" className="text-[10px] h-5">{q}</Badge>)}
          {specs.materials.length === 0 && specs.qualities.length === 0 && <span className="text-xs text-muted-foreground">-</span>}
        </div>
      </SpecRow>

      <SpecRow icon={Palette} label="컬러" editMode={editing} compact
        editContent={<EditableTagList values={editSpecs?.colors.map(c => c.name) || []} onChange={(v) => updateField('colors', v.map(name => ({ name })))} placeholder="컬러 추가..." />}
      >
        <div className="flex flex-wrap gap-1">
          {specs.colors.length > 0 ? specs.colors.map((c, i) => (
            <div key={i} className="flex items-center gap-1">
              {c.hex && <div className="w-3 h-3 rounded-full border" style={{ backgroundColor: c.hex }} />}
              <Badge variant="secondary" className="text-[10px] h-5">{c.name}</Badge>
            </div>
          )) : <span className="text-xs text-muted-foreground">-</span>}
        </div>
      </SpecRow>

      <SpecRow icon={Layers} label="두께" editMode={editing} compact
        editContent={<EditableTagList values={editSpecs?.thicknesses || []} onChange={(v) => updateField('thicknesses', v)} placeholder="두께 추가..." />}
      >
        <div className="flex flex-wrap gap-1">
          {specs.thicknesses.length > 0 ? specs.thicknesses.map((t, i) => <Badge key={i} variant="secondary" className="text-[10px] h-5">{t}</Badge>) : <span className="text-xs text-muted-foreground">-</span>}
        </div>
      </SpecRow>

      <SpecRow icon={Square} label="양단면" editMode={editing} compact
        editContent={<EditableTagList values={editSpecs?.surfaces || []} onChange={(v) => updateField('surfaces', v)} placeholder="면수 추가..." />}
      >
        <div className="flex flex-wrap gap-1">
          {specs.surfaces.length > 0 ? specs.surfaces.map((s, i) => <Badge key={i} variant="outline" className="text-[10px] h-5">{s}</Badge>) : <span className="text-xs text-muted-foreground">-</span>}
        </div>
      </SpecRow>

      <SpecRow icon={Maximize} label="원판사이즈" editMode={editing} compact
        editContent={
          <div className="space-y-1.5">
            <EditableTagList values={editSpecs?.sizes || []} onChange={(v) => updateField('sizes', v)} placeholder="사이즈 추가..." />
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground">총 수량:</span>
              <Input type="number" className="h-6 text-xs w-16" value={editSpecs?.quantity || 0} onChange={(e) => updateField('quantity', parseInt(e.target.value) || 0)} />
              <span className="text-[10px]">개</span>
            </div>
          </div>
        }
      >
        <div className="space-y-0.5">
          <div className="flex flex-wrap gap-1">
            {specs.sizes.length > 0 ? specs.sizes.map((s, i) => <Badge key={i} variant="secondary" className="text-[10px] h-5">{s}</Badge>) : <span className="text-xs text-muted-foreground">-</span>}
          </div>
          {specs.quantity > 0 && <p className="text-[10px] text-muted-foreground">총 수량: {specs.quantity}개</p>}
        </div>
      </SpecRow>

      <SpecRow icon={Ruler} label="제작 사이즈" editMode={editing} compact
        editContent={<EditableTagList values={editSpecs?.productionSizes || []} onChange={(v) => updateField('productionSizes', v)} placeholder="제작 사이즈 추가..." />}
      >
        {specs.productionSizes.length > 0 ? (
          <div className="space-y-0.5">{specs.productionSizes.map((s, i) => <p key={i} className="text-xs">{s}</p>)}</div>
        ) : <span className="text-xs text-muted-foreground">-</span>}
      </SpecRow>

      <SpecRow icon={CalendarClock} label="납기 희망일" editMode={editing} compact
        editContent={
          <div className="space-y-1">
            <div className="flex flex-wrap gap-1">
              {(editSpecs?.deliveryDates || []).map((d, i) => (
                <Badge key={i} variant="secondary" className="text-[10px] gap-0.5 pr-0.5 h-5">
                  {(() => { try { return format(new Date(d), 'yyyy.M.d', { locale: ko }); } catch { return String(d); } })()}
                  <button onClick={() => updateField('deliveryDates', (editSpecs?.deliveryDates || []).filter((_, idx) => idx !== i))} className="ml-0.5 hover:bg-muted rounded-full p-0.5">
                    <X className="h-2 w-2" />
                  </button>
                </Badge>
              ))}
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-6 text-[10px] gap-0.5"><Plus className="h-2.5 w-2.5" /> 날짜 추가</Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" onSelect={(date) => {
                  if (date) {
                    const dateStr = format(date, 'yyyy-MM-dd');
                    if (!(editSpecs?.deliveryDates || []).includes(dateStr)) updateField('deliveryDates', [...(editSpecs?.deliveryDates || []), dateStr]);
                  }
                }} locale={ko} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
        }
      >
        {specs.deliveryDates.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {specs.deliveryDates.map((d, i) => (
              <span key={i} className="text-xs font-medium">
                {(() => { try { return format(new Date(d), 'yyyy.M.d', { locale: ko }); } catch { return String(d); } })()}
              </span>
            ))}
          </div>
        ) : <span className="text-xs text-muted-foreground">미정</span>}
      </SpecRow>

      <SpecRow icon={MapPin} label="납품 배송지" editMode={editing} compact
        editContent={<EditableTagList values={editSpecs?.deliveryAddresses || []} onChange={(v) => updateField('deliveryAddresses', v)} placeholder="배송지 추가..." />}
      >
        {specs.deliveryAddresses.length > 0 ? (
          <div className="space-y-0.5">{specs.deliveryAddresses.map((a, i) => <p key={i} className="text-xs">{a}</p>)}</div>
        ) : <span className="text-xs text-muted-foreground">미지정</span>}
      </SpecRow>

      <SpecRow icon={MessageSquareText} label="요청 사항" editMode={editing} compact
        editContent={
          <Textarea value={editSpecs?.clientRequests || ''} onChange={(e) => updateField('clientRequests', e.target.value)}
            placeholder="클라이언트 요청 사항..." className="text-xs min-h-[40px]" />
        }
      >
        {specs.clientRequests ? <p className="text-xs whitespace-pre-wrap">{specs.clientRequests}</p> : <span className="text-xs text-muted-foreground">없음</span>}
      </SpecRow>

      {/* Custom Fields */}
      {(specs.customFields || []).map((field, i) => (
        <CustomFieldDisplay key={`cf-${i}`} field={field} editing={editing}
          onUpdate={(val) => updateCustomFieldValue(i, val)}
          onRemove={() => removeCustomField(i)} />
      ))}

      {/* Add Custom Field Button */}
      {editing && (
        <div className="pt-2 border-t mt-1">
          <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1 w-full text-muted-foreground" onClick={() => setShowAddField(true)}>
            <Plus className="h-3 w-3" /> 필드 추가하기
          </Button>
        </div>
      )}

      <AddCustomFieldDialog open={showAddField} onOpenChange={setShowAddField} onAdd={handleAddCustomField} />
    </div>
  );
};

const ProjectSpecsCard: React.FC<Props> = ({ projectId, specs: rawSpecs, linkedQuotes }) => {
  const [activeTab, setActiveTab] = useState<string | null>(null);

  const hasQuoteItems = linkedQuotes.some((q: any) => Array.isArray(q.items) && q.items.length > 0);

  // Determine if we have per-quote specs or legacy single specs
  const isMultiQuoteFormat = rawSpecs && rawSpecs._perQuote;
  const perQuoteSpecs: Record<string, ProjectSpecs> = isMultiQuoteFormat ? rawSpecs._perQuote : {};

  // For legacy single-spec format with one quote, migrate
  const isLegacySingle = rawSpecs && !rawSpecs._perQuote && rawSpecs.materials;

  if (!hasQuoteItems && !rawSpecs) {
    return (
      <Card className="shadow-none">
        <CardContent className="p-4 flex items-center justify-center h-full">
          <div className="text-center">
            <Package className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground">연결된 견적서의 제작 사양이 여기에 표시됩니다.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // If only one quote, show directly without tabs
  if (linkedQuotes.length <= 1) {
    const quote = linkedQuotes[0];
    const quoteId = quote?.id || 'single';
    const quoteSpecs = quote ? extractSpecsFromQuote(quote) : extractSpecsFromQuotes(linkedQuotes);
    const saved = isLegacySingle ? (rawSpecs as ProjectSpecs) : (perQuoteSpecs[quoteId] || null);

    return (
      <Card className="shadow-none">
        <CardContent className="p-4">
          <h3 className="text-sm font-bold mb-2">제작 사양</h3>
          <SingleSpecsView
            projectId={projectId}
            quoteId={quoteId}
            savedSpecs={saved}
            quoteSpecs={quoteSpecs}
            allSavedSpecs={rawSpecs}
          />
        </CardContent>
      </Card>
    );
  }

  // Multiple quotes: show tabs
  const currentQuoteId = activeTab || linkedQuotes[0]?.id;

  return (
    <Card className="shadow-none">
      <CardContent className="p-4">
        <h3 className="text-sm font-bold mb-2">제작 사양</h3>

        {/* Quote tabs */}
        <div className="flex gap-1 mb-3 overflow-x-auto pb-1">
          {linkedQuotes.map((q: any) => (
            <button
              key={q.id}
              onClick={() => setActiveTab(q.id)}
              className={cn(
                "px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-all border",
                currentQuoteId === q.id
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "bg-muted/30 text-muted-foreground border-transparent hover:bg-muted/60"
              )}
            >
              {(q.project_name || q.quote_number)?.length > 15 ? (q.project_name || q.quote_number).slice(0, 15) + '...' : (q.project_name || q.quote_number)}
              {perQuoteSpecs[q.id] && (
                <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-primary/60" />
              )}
            </button>
          ))}
        </div>

        {/* Active quote specs */}
        {linkedQuotes.map((q: any) => {
          if (q.id !== currentQuoteId) return null;
          const quoteSpecs = extractSpecsFromQuote(q);
          const saved = perQuoteSpecs[q.id] || (isLegacySingle && linkedQuotes[0]?.id === q.id ? (rawSpecs as ProjectSpecs) : null);
          return (
            <SingleSpecsView
              key={q.id}
              projectId={projectId}
              quoteId={q.id}
              savedSpecs={saved}
              quoteSpecs={quoteSpecs}
              allSavedSpecs={rawSpecs}
            />
          );
        })}
      </CardContent>
    </Card>
  );
};

export default ProjectSpecsCard;
