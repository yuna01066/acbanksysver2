import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  ArrowLeft, Plus, Trash2, Pencil, ChevronUp, ChevronDown,
  Loader2, Info, Minus, Type, Image, Sigma, Users, Eye
} from 'lucide-react';
import {
  fetchTemplateWithDetails,
  type QuoteTemplate,
  type QuoteTemplateSection,
  type QuoteTemplateItem,
} from '@/hooks/useQuoteTemplates';
import QuoteTemplateSectionCard from './QuoteTemplateSectionCard';
import QuoteTemplatePreview from './QuoteTemplatePreview';

interface Props {
  templateId: string | null;
  onClose: () => void;
}

interface LocalSection {
  id: string;
  section_type: string;
  title: string;
  display_order: number;
  config: Record<string, any>;
  items: LocalItem[];
  isNew?: boolean;
}

interface LocalItem {
  id: string;
  name: string;
  description: string;
  unit_price: number;
  quantity: number;
  unit: string;
  display_order: number;
  isNew?: boolean;
}

const QuoteTemplateEditor: React.FC<Props> = ({ templateId, onClose }) => {
  const { user } = useAuth();
  const [name, setName] = useState('견적서 양식');
  const [vatOption, setVatOption] = useState('separate');
  const [discountRate, setDiscountRate] = useState(0);
  const [notes, setNotes] = useState('');
  const [sections, setSections] = useState<LocalSection[]>([]);
  const [loading, setLoading] = useState(!!templateId);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (templateId) {
      loadTemplate(templateId);
    } else {
      // Default: one items section
      setSections([{
        id: crypto.randomUUID(),
        section_type: 'items',
        title: '견적항목',
        display_order: 0,
        config: {},
        items: [{
          id: crypto.randomUUID(),
          name: '',
          description: '',
          unit_price: 0,
          quantity: 1,
          unit: '일',
          display_order: 0,
          isNew: true,
        }],
        isNew: true,
      }]);
    }
  }, [templateId]);

  const loadTemplate = async (id: string) => {
    setLoading(true);
    const t = await fetchTemplateWithDetails(id);
    if (t) {
      setName(t.name);
      setVatOption(t.vat_option);
      setDiscountRate(t.discount_rate);
      setNotes(t.notes || '');
      setSections(
        (t.sections || []).map(s => ({
          ...s,
          config: s.config || {},
          items: (s.items || []).map(i => ({
            ...i,
            description: i.description || '',
          })),
        }))
      );
    }
    setLoading(false);
  };

  const addSection = (type: string) => {
    const titles: Record<string, string> = {
      items: '일반 구분',
      formula: '수식 구분',
      image: '이미지',
      divider: '구분선',
      info: '정보 구분',
    };
    setSections(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        section_type: type,
        title: titles[type] || '새 구분',
        display_order: prev.length,
        config: {},
        items: type === 'items' ? [{
          id: crypto.randomUUID(),
          name: '',
          description: '',
          unit_price: 0,
          quantity: 1,
          unit: '일',
          display_order: 0,
          isNew: true,
        }] : [],
        isNew: true,
      },
    ]);
  };

  const moveSection = (index: number, direction: 'up' | 'down') => {
    const newSections = [...sections];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newSections.length) return;
    [newSections[index], newSections[targetIndex]] = [newSections[targetIndex], newSections[index]];
    newSections.forEach((s, i) => (s.display_order = i));
    setSections(newSections);
  };

  const removeSection = (index: number) => {
    setSections(prev => prev.filter((_, i) => i !== index));
  };

  const updateSection = (index: number, updates: Partial<LocalSection>) => {
    setSections(prev => prev.map((s, i) => (i === index ? { ...s, ...updates } : s)));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('양식 제목을 입력해주세요.');
      return;
    }
    setSaving(true);
    try {
      let tplId = templateId;

      if (tplId) {
        // Update template
        await supabase.from('quote_templates').update({
          name, vat_option: vatOption, discount_rate: discountRate, notes: notes || null,
        }).eq('id', tplId);

        // Delete existing sections (cascade deletes items)
        await supabase.from('quote_template_sections').delete().eq('template_id', tplId);
      } else {
        // Create template
        const { data, error } = await supabase.from('quote_templates').insert({
          name, vat_option: vatOption, discount_rate: discountRate, notes: notes || null,
          created_by: user?.id,
        }).select('id').single();
        if (error) throw error;
        tplId = data.id;
      }

      // Insert sections
      for (const section of sections) {
        const { data: secData, error: secErr } = await supabase
          .from('quote_template_sections')
          .insert({
            template_id: tplId,
            section_type: section.section_type,
            title: section.title,
            display_order: section.display_order,
            config: section.config,
          })
          .select('id')
          .single();
        if (secErr) throw secErr;

        // Insert items
        if (section.items.length > 0) {
          const itemsToInsert = section.items.map((item, idx) => ({
            section_id: secData.id,
            name: item.name,
            description: item.description || null,
            unit_price: item.unit_price,
            quantity: item.quantity,
            unit: item.unit,
            display_order: idx,
          }));
          const { error: itemErr } = await supabase.from('quote_template_items').insert(itemsToInsert);
          if (itemErr) throw itemErr;
        }
      }

      toast.success(templateId ? '양식이 수정되었습니다.' : '양식이 생성되었습니다.');
      onClose();
    } catch (e: any) {
      toast.error('저장 실패: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  // Calculate totals
  const subtotal = sections
    .filter(s => s.section_type === 'items')
    .reduce((sum, s) => sum + s.items.reduce((is, i) => is + i.unit_price * i.quantity, 0), 0);
  const discountAmount = Math.round(subtotal * discountRate / 100);
  const supplyAmount = subtotal - discountAmount;
  const vat = vatOption === 'separate' ? Math.round(supplyAmount * 0.1) : 0;
  const total = vatOption === 'excluded' ? supplyAmount : supplyAmount + vat;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">양식 제목</span>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-64 font-medium"
              placeholder="견적서 양식"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)} className="gap-1.5">
              <Eye className="h-4 w-4" /> 미리보기
            </Button>
            <Button variant="outline" size="sm" onClick={onClose}>닫기</Button>
          </div>
        </div>

        {/* Info banner */}
        <Card className="mb-6 border-muted">
          <CardContent className="py-4 px-5">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">양식 내용 위에 기본 정보들이 나타나요.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  실제 견적서는 로고, 견적서 제목, 견적일자, 견적번호, 담당자, 공급자 정보, 수신자 정보가 포함돼요.
                </p>
                <p className="text-xs text-muted-foreground">
                  위 정보들은 기본 설정과 연결 고객 정보, 그리고 생성 일시에 따라 자동 입력돼요.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sections */}
        <div className="space-y-4 mb-6">
          {sections.map((section, index) => (
            <QuoteTemplateSectionCard
              key={section.id}
              section={section}
              index={index}
              totalSections={sections.length}
              onUpdate={updates => updateSection(index, updates)}
              onRemove={() => removeSection(index)}
              onMoveUp={() => moveSection(index, 'up')}
              onMoveDown={() => moveSection(index, 'down')}
            />
          ))}
        </div>

        {/* Add section buttons */}
        <div className="flex items-center gap-2 flex-wrap mb-8">
          <span className="text-sm text-muted-foreground mr-1">구분 추가하기</span>
          <Button variant="outline" size="sm" onClick={() => addSection('items')} className="gap-1.5">
            <Minus className="h-3.5 w-3.5" /> 구분선
          </Button>
          <Button variant="outline" size="sm" onClick={() => addSection('info')} className="gap-1.5">
            <Type className="h-3.5 w-3.5" /> T 정보
          </Button>
          <Button variant="outline" size="sm" onClick={() => addSection('image')} className="gap-1.5">
            <Image className="h-3.5 w-3.5" /> 사진
          </Button>
          <Button variant="outline" size="sm" onClick={() => addSection('formula')} className="gap-1.5">
            <Sigma className="h-3.5 w-3.5" /> 수식
          </Button>
          <Button variant="outline" size="sm" onClick={() => addSection('items')} className="gap-1.5">
            <Users className="h-3.5 w-3.5" /> 구분
          </Button>
        </div>

        {/* Notes + Pricing Summary */}
        <div className="flex flex-col md:flex-row gap-6 mb-8">
          {/* Notes */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-sm">참고사항</h3>
              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="내용 없음"
              className="min-h-[80px] text-sm"
            />
          </div>

          {/* Pricing */}
          <div className="w-full md:w-80">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>총 합계</span>
                <span className="font-bold">₩{subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>할인율</span>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    value={discountRate}
                    onChange={e => setDiscountRate(Number(e.target.value))}
                    className="w-16 h-7 text-right text-sm"
                    min={0}
                    max={100}
                  />
                  <span>%</span>
                  <span className="text-destructive ml-2">-₩{discountAmount.toLocaleString()}</span>
                </div>
              </div>
              <div className="flex justify-between">
                <span>공급가액</span>
                <span className="font-medium">₩{supplyAmount.toLocaleString()}</span>
              </div>
              {vatOption === 'separate' && (
                <div className="flex justify-between">
                  <span>VAT (10%)</span>
                  <span>₩{vat.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between bg-foreground text-background p-2 rounded font-bold">
                <span>최종 견적</span>
                <span>₩{total.toLocaleString()}</span>
              </div>
            </div>

            {/* VAT options */}
            <div className="flex items-center gap-2 mt-3 justify-end">
              <span className="text-xs text-muted-foreground">VAT 옵션</span>
              {(['separate', 'included', 'excluded'] as const).map(opt => (
                <Button
                  key={opt}
                  variant={vatOption === opt ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs h-7 px-3"
                  onClick={() => setVatOption(opt)}
                >
                  {opt === 'separate' ? '별도' : opt === 'included' ? '포함' : '제외'}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Save bar */}
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {templateId ? '수정 저장' : '양식 저장'}
          </Button>
        </div>
      </div>

      {/* Preview Dialog */}
      {previewOpen && (
        <QuoteTemplatePreview
          name={name}
          sections={sections}
          vatOption={vatOption}
          discountRate={discountRate}
          notes={notes}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
};

export default QuoteTemplateEditor;
