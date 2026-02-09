import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { Plus, FileText, Lock, Upload, MoreHorizontal, Pencil, Trash2, Loader2 } from 'lucide-react';
import { useDocumentBox, type DocumentCategory } from '@/hooks/useDocumentBox';

const DocumentBoxSettings: React.FC = () => {
  const { categories, loading, addCategory, updateCategory, deleteCategory } = useDocumentBox();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DocumentCategory | null>(null);
  const [form, setForm] = useState({ name: '', description: '', is_confidential: false, allow_multiple: false });
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', description: '', is_confidential: false, allow_multiple: false });
    setDialogOpen(true);
  };

  const openEdit = (cat: DocumentCategory) => {
    setEditing(cat);
    setForm({
      name: cat.name,
      description: cat.description || '',
      is_confidential: cat.is_confidential,
      allow_multiple: cat.allow_multiple,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('문서함 이름을 입력하세요.'); return; }
    setSaving(true);
    try {
      if (editing) {
        await updateCategory(editing.id, form);
        toast.success('문서함이 수정되었습니다.');
      } else {
        await addCategory(form.name, form);
        toast.success('문서함이 추가되었습니다.');
      }
      setDialogOpen(false);
    } catch (e: any) {
      toast.error('저장 실패: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cat: DocumentCategory) => {
    if (!confirm(`'${cat.name}' 문서함을 삭제하시겠습니까? 관련 문서도 삭제됩니다.`)) return;
    try {
      await deleteCategory(cat.id);
      toast.success('삭제되었습니다.');
    } catch (e: any) {
      toast.error('삭제 실패: ' + e.message);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">문서함 설정</h2>
        <p className="text-sm text-muted-foreground mt-1">
          문서함을 만들어 구성원에게 수집할 서류를 요청해보세요.<br />
          설정한 문서함은 구성원 프로필과 초대 템플릿에 노출되며, 파일을 업로드하고 관리할 수 있어요.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-semibold">구성원 문서함</h3>
        <Button variant="outline" size="sm" className="gap-1" onClick={openCreate}>
          <Plus className="h-4 w-4" /> 문서함 추가
        </Button>
      </div>

      {categories.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">등록된 문서함이 없습니다.</p>
          <p className="text-xs mt-1">문서함을 추가하여 구성원 서류를 관리하세요.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map(cat => (
            <Card key={cat.id} className="border">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{cat.name}</span>
                      {cat.is_confidential && (
                        <Badge variant="outline" className="text-xs gap-1 border-amber-300 text-amber-600">
                          <Lock className="h-3 w-3" /> 비밀문서
                        </Badge>
                      )}
                      {cat.allow_multiple && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Upload className="h-3 w-3" /> 여러개 업로드
                        </Badge>
                      )}
                    </div>
                    {cat.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{cat.description}</p>
                    )}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEdit(cat)} className="gap-2">
                      <Pencil className="h-3.5 w-3.5" /> 수정
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDelete(cat)} className="gap-2 text-destructive">
                      <Trash2 className="h-3.5 w-3.5" /> 삭제
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? '문서함 수정' : '문서함 추가'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-sm">문서함 이름</Label>
              <Input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="예: 주민등록등본"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm">설명 (선택)</Label>
              <Input
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="이 문서에 대한 설명"
                className="mt-1"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">비밀문서</p>
                <p className="text-xs text-muted-foreground">관리자만 열람 가능</p>
              </div>
              <Switch checked={form.is_confidential} onCheckedChange={v => setForm({ ...form, is_confidential: v })} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">여러개 업로드</p>
                <p className="text-xs text-muted-foreground">하나의 문서함에 여러 파일 업로드 허용</p>
              </div>
              <Switch checked={form.allow_multiple} onCheckedChange={v => setForm({ ...form, allow_multiple: v })} />
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editing ? '수정하기' : '추가하기'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DocumentBoxSettings;
