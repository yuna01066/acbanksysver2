import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, FileText, Pencil, Trash2, Loader2, Star } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuoteTemplates, type QuoteTemplate } from '@/hooks/useQuoteTemplates';
import QuoteTemplateEditor from '@/components/quote-template/QuoteTemplateEditor';

const QuoteTemplateManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAdmin, isModerator } = useAuth();
  const { templates, loading, refresh } = useQuoteTemplates();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QuoteTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (!user || (!isAdmin && !isModerator)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">관리자 권한이 필요합니다.</p>
      </div>
    );
  }

  const openCreate = () => {
    setEditingId(null);
    setEditorOpen(true);
  };

  const openEdit = (id: string) => {
    setEditingId(id);
    setEditorOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('quote_templates')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;
      toast.success('양식이 삭제되었습니다.');
      setDeleteTarget(null);
      refresh();
    } catch (e: any) {
      toast.error('삭제 실패: ' + e.message);
    } finally {
      setDeleting(false);
    }
  };

  const handleSetDefault = async (t: QuoteTemplate) => {
    // Unset all defaults first
    await supabase.from('quote_templates').update({ is_default: false }).neq('id', '');
    await supabase.from('quote_templates').update({ is_default: true }).eq('id', t.id);
    toast.success('기본 양식으로 설정되었습니다.');
    refresh();
  };

  if (editorOpen) {
    return (
      <QuoteTemplateEditor
        templateId={editingId}
        onClose={() => {
          setEditorOpen(false);
          refresh();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin-settings')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">견적서 템플릿 관리</h1>
        </div>

        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-muted-foreground">견적서 양식을 생성하고 관리합니다. 기존 견적서와는 독립적으로 동작합니다.</p>
          <Button onClick={openCreate} className="gap-1.5">
            <Plus className="h-4 w-4" /> 새 양식 만들기
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : templates.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p className="text-sm font-medium">등록된 견적서 양식이 없습니다.</p>
              <p className="text-xs mt-1">새 양식을 만들어 견적서를 작성해보세요.</p>
              <Button onClick={openCreate} variant="outline" className="mt-4 gap-1.5">
                <Plus className="h-4 w-4" /> 새 양식 만들기
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map(t => (
              <Card key={t.id} className="transition-all hover:shadow-md">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{t.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[11px]">
                            VAT {t.vat_option === 'separate' ? '별도' : t.vat_option === 'included' ? '포함' : '제외'}
                          </Badge>
                          {t.is_default && (
                            <Badge variant="secondary" className="text-[11px]">
                              <Star className="h-3 w-3 mr-0.5" /> 기본
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {!t.is_default && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="기본 양식 설정" onClick={() => handleSetDefault(t)}>
                          <Star className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t.id)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(t)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(t.created_at).toLocaleDateString('ko-KR')} 생성
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>양식을 삭제하시겠습니까?</AlertDialogTitle>
              <AlertDialogDescription>
                "{deleteTarget?.name}" 양식이 영구적으로 삭제됩니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>취소</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                삭제
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default QuoteTemplateManagementPage;
