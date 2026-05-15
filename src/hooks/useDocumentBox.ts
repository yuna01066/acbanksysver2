import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getDownloadUrl } from '@/services/documentFiles';

export interface DocumentCategory {
  id: string;
  name: string;
  description: string | null;
  is_confidential: boolean;
  allow_multiple: boolean;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export interface EmployeeDocument {
  id: string;
  user_id: string;
  category_id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_at: string;
}

export const useDocumentBox = () => {
  const [categories, setCategories] = useState<DocumentCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCategories = useCallback(async () => {
    const { data } = await supabase
      .from('document_categories')
      .select('*')
      .eq('is_active', true)
      .order('display_order');
    if (data) setCategories(data as DocumentCategory[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const addCategory = async (name: string, opts?: { description?: string; is_confidential?: boolean; allow_multiple?: boolean }) => {
    const maxOrder = categories.length > 0 ? Math.max(...categories.map(c => c.display_order)) + 1 : 0;
    const { error } = await supabase.from('document_categories').insert({
      name,
      description: opts?.description || null,
      is_confidential: opts?.is_confidential || false,
      allow_multiple: opts?.allow_multiple || false,
      display_order: maxOrder,
    });
    if (error) throw error;
    await fetchCategories();
  };

  const updateCategory = async (id: string, updates: Partial<DocumentCategory>) => {
    const { error } = await supabase.from('document_categories').update(updates).eq('id', id);
    if (error) throw error;
    await fetchCategories();
  };

  const deleteCategory = async (id: string) => {
    const { error } = await supabase.from('document_categories').delete().eq('id', id);
    if (error) throw error;
    await fetchCategories();
  };

  return { categories, loading, addCategory, updateCategory, deleteCategory, refresh: fetchCategories };
};

export const useEmployeeDocuments = (userId?: string) => {
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDocuments = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    const { data } = await supabase
      .from('employee_documents')
      .select('*')
      .eq('user_id', userId)
      .order('uploaded_at', { ascending: false });
    if (data) setDocuments(data as EmployeeDocument[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  const uploadDocument = async (file: File, categoryId: string, uid: string) => {
    const ext = file.name.split('.').pop();
    const path = `${uid}/${categoryId}/${Date.now()}.${ext}`;
    
    const { error: uploadError } = await supabase.storage
      .from('employee-documents')
      .upload(path, file);
    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from('employee-documents')
      .getPublicUrl(path);

    const { error: insertError } = await supabase.from('employee_documents').insert({
      user_id: uid,
      category_id: categoryId,
      file_name: file.name,
      file_url: path,
      file_size: file.size,
      mime_type: file.type,
    });
    if (insertError) throw insertError;
    await fetchDocuments();
  };

  const deleteDocument = async (doc: EmployeeDocument) => {
    await supabase.storage.from('employee-documents').remove([doc.file_url]);
    await supabase.from('employee_documents').delete().eq('id', doc.id);
    await fetchDocuments();
  };

  const getSignedUrl = async (filePath: string) => {
    return getDownloadUrl({
      storageProvider: 'supabase_storage',
      storageBucket: 'employee-documents',
      storagePath: filePath,
    });
  };

  return { documents, loading, uploadDocument, deleteDocument, getSignedUrl, refresh: fetchDocuments };
};
