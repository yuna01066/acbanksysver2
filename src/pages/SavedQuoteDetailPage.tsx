import React, { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { List, Save, Edit, X, Download, Users, Building2, Calculator, FileText, Calendar as CalendarIcon, FolderOpen, ExternalLink } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import QuoteCard from "@/components/QuoteCard";
import CustomerQuoteCard from "@/components/CustomerQuoteCard";
import QuoteSummaryHeader from "@/components/QuoteSummaryHeader";
import PrintStyles from "@/components/PrintStyles";
import RecipientInfoForm from "@/components/RecipientInfoForm";
import { QuoteRecipient } from "@/contexts/QuoteContext";
import QuoteAttachments, { QuotePdfAttachment } from "@/components/QuoteAttachments";
import EditableQuoteItem from "@/components/EditableQuoteItem";
import { useAuth } from "@/contexts/AuthContext";
import QuoteMemoPanel from "@/components/QuoteMemoPanel";
import QuoteMaterialOrders from "@/components/QuoteMaterialOrders";
import QuoteSummarySection from "@/components/quote-detail/QuoteSummarySection";
import QuoteCompanyInfoSection from "@/components/quote-detail/QuoteCompanyInfoSection";
import QuoteTotalSection from "@/components/quote-detail/QuoteTotalSection";
import QuoteNotesSection from "@/components/quote-detail/QuoteNotesSection";
import QuoteContactSection from "@/components/quote-detail/QuoteContactSection";
import QuoteClientRequestSection from "@/components/quote-detail/QuoteClientRequestSection";
import QuoteDocumentsSection from "@/components/quote-detail/QuoteDocumentsSection";
import QuoteVersionHistory from "@/components/quote-detail/QuoteVersionHistory";
import QuoteActivityTimeline from "@/components/quote-detail/QuoteActivityTimeline";
import QuoteWorkflowPanel from "@/components/quote-detail/QuoteWorkflowPanel";
import { useQuoteVersions } from "@/hooks/useQuoteVersions";
import QuoteStyleBanner from "@/components/quote-detail/QuoteStyleBanner";
import { detectQuoteStyleFromItems, getQuoteStyleProfile } from "@/utils/quoteStyle";
import {
  deleteStoredFile,
  getAttachmentTarget,
  removeDocumentFileRecord,
} from "@/services/documentFiles";
import { formatPricingVersionDisplayName } from "@/utils/pricingVersionDisplay";
import { formatQuoteProjectTitle } from "@/utils/quoteNaming";
import { convertQuoteToProject } from "@/services/quoteProjectConversion";
import { logQuoteActivity } from "@/services/quoteActivity";
import { refreshQuoteDashboardState } from "@/services/quoteDashboardSync";
import { isQuoteExpired, isReissueProtectedProjectStage, normalizeProjectStage, projectStageToLegacyQuoteStatus } from "@/utils/quoteWorkflow";
import { reissueSavedQuote } from "@/services/quoteReissue";
import { duplicateSavedQuote } from "@/services/quoteDuplicate";
import type { QuoteAssigneeOption } from "@/components/QuoteAssigneeSelect";
import { normalizeQuoteItems } from "@/utils/quoteItemIdentity";

interface SavedQuote {
  id: string;
  quote_number: string;
  quote_date: string;
  project_name: string | null;
  quote_date_display: string | null;
  valid_until: string | null;
  delivery_period: string | null;
  payment_condition: string | null;
  project_id?: string | null;
  project_followup_status?: string | null;
  project_followup_note?: string | null;
  project_followup_updated_at?: string | null;
  project_followup_updated_by?: string | null;
  project_stage?: string | null;
  quote_status?: string | null;
  assigned_to?: string | null;
  assigned_to_name?: string | null;
  status_updated_at?: string | null;
  auto_cancelled_at?: string | null;
  auto_cancel_reason?: string | null;
  reissued_from_quote_id?: string | null;
  reissued_quote_id?: string | null;
  reissued_at?: string | null;
  user_id: string;
  issuer_id?: string | null;
  recipient_name: string | null;
  recipient_company: string | null;
  recipient_phone: string | null;
  recipient_email: string | null;
  recipient_id?: string | null;
  recipient_address: string | null;
  recipient_memo: string | null;
  quote_notes?: string | null;
  desired_delivery_date: string | null;
  issuer_name: string | null;
  issuer_email: string | null;
  issuer_phone: string | null;
  issuer_department: string | null;
  issuer_position: string | null;
  attachments: any;
  items: any;
  pricing_version_id?: string | null;
  calculation_snapshot?: any;
  subtotal: number;
  tax: number;
  total: number;
}

type QuoteViewMode = 'internal' | 'customer';

type ManualTotalOverride = {
  subtotal: number;
  tax: number;
  total: number;
};

type ManualTotalAdjustmentSnapshot = {
  mode: 'vat_included_total_override';
  adjustedAt: string;
  previousSubtotal: number;
  previousTax: number;
  previousTotal: number;
  adjustedSubtotal: number;
  adjustedTax: number;
  adjustedTotal: number;
  difference: number;
};

const SavedQuoteDetailPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [quote, setQuote] = useState<SavedQuote | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [manualTotalOverride, setManualTotalOverride] = useState<ManualTotalOverride | null>(null);
  const [recipientData, setRecipientData] = useState<QuoteRecipient>({
    projectName: '',
    quoteNumber: '',
    quoteDate: new Date(),
    validUntil: '',
    deliveryPeriod: '',
    paymentCondition: '',
    companyName: '',
    contactPerson: '',
    phoneNumber: '',
    email: '',
    desiredDeliveryDate: null,
    deliveryAddress: '',
    clientMemo: ''
  });
  const [touchedRecipientFields, setTouchedRecipientFields] = useState<Set<keyof QuoteRecipient>>(new Set());
  const [viewMode, setViewMode] = useState<QuoteViewMode>('internal');
  const [printModeOverride, setPrintModeOverride] = useState<QuoteViewMode | null>(null);
  const [loading, setLoading] = useState(true);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [editedItems, setEditedItems] = useState<any[]>([]);
  const [editedItemsTouched, setEditedItemsTouched] = useState(false);
  const [editedQuoteNotes, setEditedQuoteNotes] = useState('');
  const [quotePdf, setQuotePdf] = useState<QuotePdfAttachment | null>(null);
  const [linkedProject, setLinkedProject] = useState<{ id: string; name: string; payment_status: string | null } | null>(null);
  const [assigneeUsers, setAssigneeUsers] = useState<QuoteAssigneeOption[]>([]);
  const [convertingProject, setConvertingProject] = useState(false);
  const [projectFollowupUpdating, setProjectFollowupUpdating] = useState(false);
  const [reissuingQuote, setReissuingQuote] = useState(false);
  const [duplicatingQuote, setDuplicatingQuote] = useState(false);
  const [quoteDefaults, setQuoteDefaults] = useState({
    quote_bank_info: '신한은행 140-014-544315 (주)아크뱅크',
    quote_notes: '- 견적서의 유효기간은 발행일로부터 14일 입니다.\n- 운송비 및 부가세는 별도 입니다.',
    quote_consultation: '안녕하세요\n견적 문의해 주셔서 감사합니다.\n상세한 제작 요구사항이 있으시면 담당자에게 연락 부탁드립니다.',
    quote_contact_phone: '070-7537-3680',
    quote_contact_email: 'acbank@acbank.co.kr',
    quote_contact_message: '견적 관련 문의사항이나 주문을 원하시면 아래 연락처로 문의해주세요.',
  });
  const [companyInfo, setCompanyInfo] = useState({
    company_name: '(주)아크뱅크',
    business_number: '299-87-02991',
    website: 'acbank.co.kr',
    address: '경기도 포천시 소흘읍 호국로 287번길 15, 나동 1층 101호',
    detail_address: '',
    business_type: '제조업 / 도매 및 소매업',
    industry: '아크릴 가공 외',
    phone: '070-7666-9828',
    email: 'acbank@acbank.co.kr',
  });
  const printContainerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { user, profile, isAdmin, isModerator } = useAuth();
  const { saveVersion } = useQuoteVersions(id);

  useEffect(() => {
    if (id) {
      fetchQuote();
      fetchLinkedProject();
    }
    fetchQuoteDefaults();
    fetchAssigneeUsers();
  }, [id]);

  useEffect(() => {
    const resetPrintMode = () => setPrintModeOverride(null);

    window.addEventListener('afterprint', resetPrintMode);
    return () => window.removeEventListener('afterprint', resetPrintMode);
  }, []);

  const fetchQuoteDefaults = async () => {
    const { data } = await supabase
      .from('company_quote_defaults' as any)
      .select('*')
      .limit(1)
      .maybeSingle();
    if (data) {
      const d = data as any;
      setQuoteDefaults(prev => ({
        quote_bank_info: d.quote_bank_info || prev.quote_bank_info,
        quote_notes: d.quote_notes || prev.quote_notes,
        quote_consultation: d.quote_consultation || prev.quote_consultation,
        quote_contact_phone: d.quote_contact_phone || prev.quote_contact_phone,
        quote_contact_email: d.quote_contact_email || prev.quote_contact_email,
        quote_contact_message: d.quote_contact_message || prev.quote_contact_message,
      }));
      setCompanyInfo(prev => ({
        company_name: d.company_name || prev.company_name,
        business_number: d.business_number || prev.business_number,
        website: d.website || prev.website,
        address: d.address || prev.address,
        detail_address: d.detail_address || '',
        business_type: d.business_type || prev.business_type,
        industry: d.industry || prev.industry,
        phone: d.phone || prev.phone,
        email: d.email || prev.email,
      }));
    }
  };

  const fetchAssigneeUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .order('full_name', { ascending: true });

      if (error) throw error;
      setAssigneeUsers(data || []);
    } catch (error) {
      console.error('Error fetching quote assignees:', error);
      setAssigneeUsers([]);
    }
  };

  const fetchLinkedProject = async () => {
    if (!id) return;
    try {
      const { data: quoteData } = await supabase
        .from('saved_quotes')
        .select('project_id')
        .eq('id', id)
        .single();

      if (quoteData?.project_id) {
        const { data: project } = await supabase
          .from('projects')
          .select('id, name, payment_status')
          .eq('id', quoteData.project_id)
          .single();
        
        if (project) setLinkedProject(project);
      } else {
        setLinkedProject(null);
      }
    } catch {
      setLinkedProject(null);
    }
  };

  const fetchQuote = async () => {
    try {
      const { data, error } = await supabase
        .from('saved_quotes')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      const normalizedItems = normalizeQuoteItems((Array.isArray(data.items) ? data.items : []) as Array<{ id?: string }>);
      const formattedData = {
        ...data,
        project_stage: normalizeProjectStage(data.project_stage, data.quote_status),
        items: normalizedItems,
      };
      
      // 현재 로그인한 사용자의 프로필 정보 가져오기
      const { data: { user } } = await supabase.auth.getUser();
      let profileData = null;
      
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email, phone, department, position')
          .eq('id', user.id)
          .single();
        
        profileData = profile;
      }
      
      setQuote(formattedData);
      const attachmentsArray = Array.isArray(formattedData.attachments) ? formattedData.attachments : [];
      setAttachments(attachmentsArray.filter((a: any) => a?.type !== 'quote_pdf'));
      setEditedItems(Array.isArray(formattedData.items) ? formattedData.items : []);
      setEditedItemsTouched(false);
      setEditedQuoteNotes(formattedData.quote_notes || '');
      
      // 견적서 PDF 정보 로드 (attachments 배열에서 quote_pdf 타입 찾기)
      const savedQuotePdf = attachmentsArray.find((a: any) => 
        typeof a === 'object' && a !== null && a.type === 'quote_pdf'
      ) as { name: string; path: string; size: number; url: string; uploadedAt?: string; type: string } | undefined;
      if (savedQuotePdf) {
        setQuotePdf({
          name: savedQuotePdf.name,
          path: savedQuotePdf.path,
          size: savedQuotePdf.size,
          url: savedQuotePdf.url || '',
          uploadedAt: savedQuotePdf.uploadedAt || '',
          type: 'quote_pdf',
          documentFileId: (savedQuotePdf as any).documentFileId || (savedQuotePdf as any).document_file_id || null,
          storageProvider: (savedQuotePdf as any).storageProvider || (savedQuotePdf as any).storage_provider || 'supabase_storage',
          storageBucket: (savedQuotePdf as any).storageBucket || (savedQuotePdf as any).storage_bucket || 'quote-pdfs',
          storagePath: (savedQuotePdf as any).storagePath || (savedQuotePdf as any).storage_path || savedQuotePdf.path,
          driveFileId: (savedQuotePdf as any).driveFileId || (savedQuotePdf as any).drive_file_id || null,
          driveFolderId: (savedQuotePdf as any).driveFolderId || (savedQuotePdf as any).drive_folder_id || null,
          syncStatus: (savedQuotePdf as any).syncStatus || (savedQuotePdf as any).sync_status || undefined,
        });
      } else {
        setQuotePdf(null);
      }
      
      // RecipientData 설정 - issuer 정보는 profiles에서 가져오거나 saved_quotes에 저장된 값 사용
      setRecipientData({
        projectName: formattedData.project_name || '',
        quoteNumber: formattedData.quote_number || '',
        quoteDate: formattedData.quote_date_display ? new Date(formattedData.quote_date_display) : new Date(),
        validUntil: formattedData.valid_until || '',
        deliveryPeriod: formattedData.delivery_period || '',
        paymentCondition: formattedData.payment_condition || '',
        companyName: formattedData.recipient_company || '',
        contactPerson: formattedData.recipient_name || '',
        phoneNumber: formattedData.recipient_phone || '',
        email: formattedData.recipient_email || '',
        desiredDeliveryDate: formattedData.desired_delivery_date ? new Date(formattedData.desired_delivery_date) : null,
        deliveryAddress: formattedData.recipient_address || '',
        clientMemo: formattedData.recipient_memo || '',
        issuerId: formattedData.issuer_id || undefined,
        issuerName: formattedData.issuer_name || profileData?.full_name || '',
        issuerEmail: formattedData.issuer_email || profileData?.email || '',
        issuerPhone: formattedData.issuer_phone || profileData?.phone || ''
      });
      setTouchedRecipientFields(new Set());
    } catch (error) {
      console.error('Error fetching quote:', error);
      toast.error('견적서를 불러오는데 실패했습니다.');
      navigate('/saved-quotes');
    } finally {
      setLoading(false);
    }
  };

  const handleRecipientChange = (field: keyof QuoteRecipient, value: any) => {
    setTouchedRecipientFields(prev => {
      const next = new Set(prev);
      next.add(field);
      if (field === 'quoteDate') next.add('validUntil');
      return next;
    });
    setRecipientData(prev => {
      const updated = { ...prev, [field]: value };
      // 견적일자 변경 시 유효기간 자동 재계산
      if (field === 'quoteDate' && value instanceof Date) {
        const validDate = new Date(value);
        validDate.setDate(validDate.getDate() + 14);
        updated.validUntil = `${value.toLocaleDateString('ko-KR')} ~ ${validDate.toLocaleDateString('ko-KR')}`;
      }
      return updated;
    });
  };

  const handleBulkRecipientChange = (updates: Partial<QuoteRecipient>) => {
    setTouchedRecipientFields(prev => {
      const next = new Set(prev);
      (Object.keys(updates) as Array<keyof QuoteRecipient>).forEach(field => next.add(field));
      return next;
    });
    setRecipientData(prev => ({ ...prev, ...updates }));
  };

  const stripRuntimeAttachmentState = (attachment: any) => {
    const { pendingDelete, ...persisted } = attachment;
    return persisted;
  };

  const cleanupPendingFiles = async (pendingFiles: any[]) => {
    for (const file of pendingFiles) {
      try {
        const fallbackBucket = file.type === 'quote_pdf' ? 'quote-pdfs' : 'quote-attachments';
        await deleteStoredFile(getAttachmentTarget(file, fallbackBucket));
        await removeDocumentFileRecord(file.documentFileId || file.document_file_id);
      } catch (cleanupError) {
        console.warn('Pending file cleanup failed:', cleanupError);
        toast.warning(`${file.name || '파일'} 삭제 정리에 실패했습니다. 관리자 화면에서 확인해주세요.`);
      }
    }
  };

  const getTextForSave = (field: keyof QuoteRecipient, fallback?: string | null) => {
    const value = recipientData[field];
    const text = typeof value === 'string' ? value.trim() : '';

    if (touchedRecipientFields.has(field)) {
      return typeof value === 'string' ? value : '';
    }

    return text || fallback || '';
  };

  const getDateForSave = (field: keyof QuoteRecipient, fallback?: string | null) => {
    const value = recipientData[field];

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString();
    }

    if (touchedRecipientFields.has(field)) {
      return null;
    }

    return fallback || null;
  };

  const handleSaveEdit = async () => {
    if (!id) return;

    try {
      const normalizedEditedItems = normalizeQuoteItems(editedItems);
      const itemCalculatedSubtotal = Math.round(
        normalizedEditedItems.reduce((sum, item) => sum + (item.totalPrice * item.quantity), 0) / 100
      ) * 100;
      const itemCalculatedTax = Math.round(itemCalculatedSubtotal * 0.1);
      const itemCalculatedTotal = itemCalculatedSubtotal + itemCalculatedTax;

      // 품목을 건드리지 않은 재수정에서는 저장된 금액을 기준으로 유지한다.
      // 수동 조정 견적은 품목 합계와 저장 총액이 다를 수 있으므로 자동 재계산하면 최초 산식 금액으로 되돌아간다.
      const autoCalculatedSubtotal = editedItemsTouched ? itemCalculatedSubtotal : Math.round(quote.subtotal);
      const autoCalculatedTax = editedItemsTouched ? itemCalculatedTax : Math.round(quote.tax);
      const autoCalculatedTotal = editedItemsTouched ? itemCalculatedTotal : Math.round(quote.total);

      // 수동 오버라이드가 있으면 VAT 포함 최종금액 기준으로 역산한 값을 저장한다.
      let roundedSubtotal = autoCalculatedSubtotal;
      let newTax = autoCalculatedTax;
      let newTotal = autoCalculatedTotal;
      let manualTotalAdjustment: ManualTotalAdjustmentSnapshot | null = null;

      if (manualTotalOverride) {
        roundedSubtotal = manualTotalOverride.subtotal;
        newTax = manualTotalOverride.tax;
        newTotal = manualTotalOverride.total;

        manualTotalAdjustment = {
          mode: 'vat_included_total_override',
          adjustedAt: new Date().toISOString(),
          previousSubtotal: autoCalculatedSubtotal,
          previousTax: autoCalculatedTax,
          previousTotal: autoCalculatedTotal,
          adjustedSubtotal: roundedSubtotal,
          adjustedTax: newTax,
          adjustedTotal: newTotal,
          difference: newTotal - autoCalculatedTotal,
        };
      }

      // 첨부 파일 목록 구성 (PDF 정보 + 기존 첨부 파일)
      const pendingFiles = [
        ...attachments.filter((a: any) => a.pendingDelete),
        ...(quotePdf?.pendingDelete ? [quotePdf] : []),
      ];
      const activeAttachments = attachments
        .filter((a: any) => a.type !== 'quote_pdf' && !a.pendingDelete)
        .map(stripRuntimeAttachmentState);

      const allAttachments = [
        // 견적서 PDF (type: 'quote_pdf'로 구분)
        ...(quotePdf && !quotePdf.pendingDelete ? [{
          ...stripRuntimeAttachmentState(quotePdf),
          type: 'quote_pdf'
        }] : []),
        // 기존 첨부 파일 (quote_pdf가 아닌 것들만)
        ...activeAttachments
      ];
      const projectNameForSave = getTextForSave('projectName', quote.project_name);
      const companyNameForSave = getTextForSave('companyName', quote.recipient_company);

      const { error } = await supabase
        .from('saved_quotes')
        .update({
          project_name: formatQuoteProjectTitle({
            projectName: projectNameForSave,
            companyName: companyNameForSave,
          }),
          quote_date_display: getDateForSave('quoteDate', quote.quote_date_display),
          valid_until: getTextForSave('validUntil', quote.valid_until),
          delivery_period: getTextForSave('deliveryPeriod', quote.delivery_period),
          payment_condition: getTextForSave('paymentCondition', quote.payment_condition),
          recipient_name: getTextForSave('contactPerson', quote.recipient_name),
          recipient_company: companyNameForSave,
          recipient_phone: getTextForSave('phoneNumber', quote.recipient_phone),
          recipient_email: getTextForSave('email', quote.recipient_email),
          recipient_address: getTextForSave('deliveryAddress', quote.recipient_address),
          recipient_memo: getTextForSave('clientMemo', quote.recipient_memo),
          quote_notes: editedQuoteNotes.trim() || null,
          desired_delivery_date: getDateForSave('desiredDeliveryDate', quote.desired_delivery_date),
          issuer_id: getTextForSave('issuerId', null) || null,
          issuer_name: getTextForSave('issuerName', quote.issuer_name),
          issuer_email: getTextForSave('issuerEmail', quote.issuer_email),
          issuer_phone: getTextForSave('issuerPhone', quote.issuer_phone),
          attachments: allAttachments,
          items: normalizedEditedItems,
          calculation_snapshot: {
            ...(quote.calculation_snapshot && typeof quote.calculation_snapshot === 'object' ? quote.calculation_snapshot : {}),
            schemaVersion: Math.max(Number(quote.calculation_snapshot?.schemaVersion) || 1, 2),
            editedAt: new Date().toISOString(),
            subtotal: roundedSubtotal,
            tax: newTax,
            total: newTotal,
            autoCalculatedSubtotal,
            autoCalculatedTax,
            autoCalculatedTotal,
            manualTotalAdjustment: manualTotalAdjustment
              ?? (!editedItemsTouched ? (quote.calculation_snapshot?.manualTotalAdjustment || null) : null),
            items: normalizedEditedItems.map(item => ({
              id: item.id,
              totalPrice: item.totalPrice,
              quantity: item.quantity || 1,
              calculationSnapshot: item.calculationSnapshot || null,
            })),
            note: manualTotalAdjustment
              ? '견적 저장 당시 계산 근거입니다. VAT 포함 최종금액이 수동 조정되었습니다.'
              : '견적 저장 당시 계산 근거입니다. 수동 편집 시 품목 스냅샷은 기존 값을 유지합니다.',
          },
          subtotal: roundedSubtotal,
          tax: newTax,
          total: newTotal
        })
        .eq('id', id);

      if (error) throw error;
      await cleanupPendingFiles(pendingFiles);

      // Save version snapshot before edit
      if (quote) {
        const changes: string[] = [];
        if (recipientData.projectName !== (quote.project_name || '')) changes.push('프로젝트명');
        if (recipientData.companyName !== (quote.recipient_company || '')) changes.push('거래처');
        if (editedItems.length !== items.length) changes.push('품목 수');
        if ((editedQuoteNotes.trim() || '') !== (quote.quote_notes || '')) changes.push('안내사항');
        if (roundedSubtotal !== Math.round(quote.subtotal) || newTotal !== Math.round(quote.total)) changes.push('금액');
        if (manualTotalAdjustment) changes.push('VAT 포함 최종금액 수동 조정');
        const summary = changes.length > 0 ? `${changes.join(', ')} 변경` : '수정됨';
        
        saveVersion.mutate({
          snapshot: {
            project_name: quote.project_name,
            recipient_company: quote.recipient_company,
            recipient_name: quote.recipient_name,
            items: quote.items,
            subtotal: quote.subtotal,
            tax: quote.tax,
            total: quote.total,
            valid_until: quote.valid_until,
          },
          changeSummary: summary,
        });

        if (user) {
          await logQuoteActivity({
            quoteId: id,
            actionType: 'quote_updated',
            actorId: user.id,
            actorName: profile?.full_name || user.email || '알 수 없음',
            memo: summary,
            metadata: {
              quoteNumber: quote.quote_number,
              summary,
              subtotal: roundedSubtotal,
              tax: newTax,
              total: newTotal,
              manualTotalAdjustment,
            },
          });
        }
      }

      if (user && pendingFiles.length > 0) {
        await Promise.allSettled(pendingFiles.map((file) => logQuoteActivity({
          quoteId: id,
          actionType: 'file_deleted',
          actorId: user.id,
          actorName: profile?.full_name || user.email || '알 수 없음',
          metadata: {
            quoteNumber: quote.quote_number,
            fileName: file.name || file.path || '파일',
            documentFileId: file.documentFileId || file.document_file_id || null,
          },
        })));
      }

      toast.success('견적서가 수정되었습니다.');
      setIsEditing(false);
      setManualTotalOverride(null);
      setEditedItemsTouched(false);
      queryClient.invalidateQueries({ queryKey: ['quote-activity-history', id] });
      await refreshQuoteDashboardState(queryClient, id);
      fetchQuote();
    } catch (error) {
      console.error('Error updating quote:', error);
      toast.error('견적서 수정에 실패했습니다.');
    }
  };

  const handleItemUpdate = (itemId: string, updatedItem: any) => {
    setEditedItems(prev => normalizeQuoteItems(prev).map(item =>
      item.id === itemId ? { ...updatedItem, id: itemId } : item
    ));
    setEditedItemsTouched(true);
  };

  const handleItemRemove = (itemId: string) => {
    if (editedItems.length <= 1) {
      toast.error('최소 1개의 견적 항목이 필요합니다.');
      return;
    }

    setEditedItems(prev => normalizeQuoteItems(prev).filter(item => item.id !== itemId));
    setEditedItemsTouched(true);
  };

  const handleAttachmentsChange = (newAttachments: any[]) => {
    setAttachments(newAttachments);
  };

  const handleStageChanged = (newStage: string) => {
    setQuote(prev => prev ? {
      ...prev,
      project_stage: newStage,
      quote_status: projectStageToLegacyQuoteStatus(newStage),
      status_updated_at: new Date().toISOString(),
    } as SavedQuote : prev);
  };

  const handleAssigneeChanged = (assigneeId: string | null, assigneeName: string | null) => {
    setQuote(prev => prev ? { ...prev, assigned_to: assigneeId, assigned_to_name: assigneeName } as SavedQuote : prev);
  };

  const handleConvertProject = async () => {
    if (!quote || !user) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    if (quote.project_id) {
      navigate(`/project-management?id=${quote.project_id}`);
      return;
    }

    setConvertingProject(true);
    try {
      const project = await convertQuoteToProject({
        quote: {
          ...quote,
          project_stage: normalizeProjectStage(quote.project_stage, quote.quote_status),
        },
        actorId: user.id,
        actorName: profile?.full_name || user.email || '알 수 없음',
      });

      setLinkedProject(project);
      setQuote(prev => prev ? {
        ...prev,
        project_id: project.id,
        project_followup_status: 'converted',
        project_followup_note: null,
        project_followup_updated_at: new Date().toISOString(),
        project_followup_updated_by: user.id,
        project_stage: 'contracted',
        quote_status: projectStageToLegacyQuoteStatus('contracted'),
      } as SavedQuote : prev);
      queryClient.invalidateQueries({ queryKey: ['quote-activity-history', quote.id] });
      if (project.approvalRequestError) {
        toast.warning(`프로젝트 생성 완료, 품의 생성 실패: ${project.approvalRequestError}`);
      } else {
        toast.success('견적서 기준 프로젝트와 개시 품의가 생성되었습니다.');
      }
    } catch (error) {
      console.error('Error converting quote to project:', error);
      toast.error(error instanceof Error ? error.message : '프로젝트 전환에 실패했습니다.');
    } finally {
      setConvertingProject(false);
    }
  };

  const handleMarkProjectNotRequired = async (note: string) => {
    if (!quote || !user) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    const trimmedNote = note.trim();
    if (trimmedNote.length < 2) {
      toast.error('제외 사유를 입력해주세요.');
      return;
    }

    const nowIso = new Date().toISOString();
    setProjectFollowupUpdating(true);
    try {
      const { error } = await (supabase as any)
        .from('saved_quotes')
        .update({
          project_followup_status: 'not_required',
          project_followup_note: trimmedNote,
          project_followup_updated_at: nowIso,
          project_followup_updated_by: user.id,
        })
        .eq('id', quote.id);

      if (error) throw error;

      await logQuoteActivity({
        quoteId: quote.id,
        actionType: 'project_followup_not_required',
        actorId: user.id,
        actorName: profile?.full_name || user.email || '알 수 없음',
        oldValue: quote.project_followup_status || (quote.project_id ? 'converted' : 'pending'),
        newValue: 'not_required',
        memo: trimmedNote,
      });

      setQuote(prev => prev ? {
        ...prev,
        project_followup_status: 'not_required',
        project_followup_note: trimmedNote,
        project_followup_updated_at: nowIso,
        project_followup_updated_by: user.id,
      } as SavedQuote : prev);
      queryClient.invalidateQueries({ queryKey: ['quote-activity-history', quote.id] });
      queryClient.invalidateQueries({ queryKey: ['home-quote-follow-ups'] });
      toast.success('프로젝트 전환 불필요로 처리했습니다.');
    } catch (error) {
      console.error('Error marking project follow-up as not required:', error);
      toast.error('프로젝트 전환 불필요 처리에 실패했습니다.');
    } finally {
      setProjectFollowupUpdating(false);
    }
  };

  const handleReopenProjectFollowup = async () => {
    if (!quote || !user) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    const nextStatus = quote.project_id ? 'converted' : 'pending';
    const nowIso = new Date().toISOString();
    setProjectFollowupUpdating(true);
    try {
      const { error } = await (supabase as any)
        .from('saved_quotes')
        .update({
          project_followup_status: nextStatus,
          project_followup_note: null,
          project_followup_updated_at: nowIso,
          project_followup_updated_by: user.id,
        })
        .eq('id', quote.id);

      if (error) throw error;

      await logQuoteActivity({
        quoteId: quote.id,
        actionType: 'project_followup_reopened',
        actorId: user.id,
        actorName: profile?.full_name || user.email || '알 수 없음',
        oldValue: quote.project_followup_status || 'not_required',
        newValue: nextStatus,
      });

      setQuote(prev => prev ? {
        ...prev,
        project_followup_status: nextStatus,
        project_followup_note: null,
        project_followup_updated_at: nowIso,
        project_followup_updated_by: user.id,
      } as SavedQuote : prev);
      queryClient.invalidateQueries({ queryKey: ['quote-activity-history', quote.id] });
      queryClient.invalidateQueries({ queryKey: ['home-quote-follow-ups'] });
      toast.success('프로젝트 전환 후속관리 대상으로 되돌렸습니다.');
    } catch (error) {
      console.error('Error reopening project follow-up:', error);
      toast.error('프로젝트 전환 후속관리 복귀에 실패했습니다.');
    } finally {
      setProjectFollowupUpdating(false);
    }
  };

  const handleReissueQuote = async () => {
    if (!quote || !user) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    setReissuingQuote(true);
    try {
      const newQuote = await reissueSavedQuote({
        quoteId: quote.id,
        actorId: user.id,
        actorName: profile?.full_name || user.email || '알 수 없음',
      });

      toast.success(`견적서가 ${newQuote.quote_number}번으로 재발행되었습니다.`);
      queryClient.invalidateQueries({ queryKey: ['quote-activity-history', quote.id] });
      navigate(`/saved-quotes/${newQuote.id}`);
    } catch (error) {
      console.error('Error reissuing quote:', error);
      toast.error(error instanceof Error ? error.message : '견적서 재발행에 실패했습니다.');
    } finally {
      setReissuingQuote(false);
    }
  };

  const handleDuplicateQuote = async () => {
    if (!quote || !user) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    setDuplicatingQuote(true);
    try {
      const newQuote = await duplicateSavedQuote({
        quoteId: quote.id,
        actorId: user.id,
        actorName: profile?.full_name || user.email || '알 수 없음',
        actorEmail: user.email,
      });

      toast.success(`견적서가 ${newQuote.quote_number}번으로 복제되었습니다.`);
      navigate(`/saved-quotes/${newQuote.id}`);
    } catch (error) {
      console.error('Error duplicating quote:', error);
      toast.error(error instanceof Error ? error.message : '견적서 복제에 실패했습니다.');
    } finally {
      setDuplicatingQuote(false);
    }
  };

  const handlePrintPDF = (mode: QuoteViewMode = viewMode) => {
    setPrintModeOverride(mode);
    window.setTimeout(() => {
      window.print();
      window.setTimeout(() => setPrintModeOverride(null), 500);
    }, 80);
  };



  const toggleViewMode = () => {
    setViewMode(prev => prev === 'internal' ? 'customer' : 'internal');
  };

  if (loading || !quote) {
    return (
      <div className="min-h-screen bg-[hsl(220,10%,95%)] flex items-center justify-center">
        <p className="text-muted-foreground">로딩 중...</p>
      </div>
    );
  }

  const currentDate = new Date(quote.quote_date).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const items = Array.isArray(quote.items) ? quote.items : [];
  const displayItems = isEditing ? editedItems : items;
  const quoteStyle = detectQuoteStyleFromItems(displayItems);
  const quoteStyleProfile = getQuoteStyleProfile(quoteStyle);
  const activeMode = printModeOverride ?? viewMode;
  
  // 편집 모드에서도 품목을 실제로 수정하기 전까지는 저장된 금액을 유지한다.
  const itemAutoSubtotal = Math.round(
    editedItems.reduce((sum, item) => sum + (item.totalPrice * item.quantity), 0) / 100
  ) * 100;
  const itemAutoTax = Math.round(itemAutoSubtotal * 0.1);
  const itemAutoTotal = itemAutoSubtotal + itemAutoTax;
  const autoSubtotal = isEditing 
    ? (editedItemsTouched ? itemAutoSubtotal : Math.round(quote.subtotal))
    : Math.round(quote.subtotal);
  const autoTax = isEditing 
    ? (editedItemsTouched ? itemAutoTax : Math.round(quote.tax))
    : Math.round(quote.tax);
  const autoTotal = isEditing 
    ? (editedItemsTouched ? itemAutoTotal : Math.round(quote.total))
    : Math.round(quote.total);
  
  const subtotal = (isEditing && manualTotalOverride) ? manualTotalOverride.subtotal : autoSubtotal;
  const tax = (isEditing && manualTotalOverride) ? manualTotalOverride.tax : autoTax;
  const totalWithTax = (isEditing && manualTotalOverride) ? manualTotalOverride.total : autoTotal;
  const calculationSnapshot = quote.calculation_snapshot && typeof quote.calculation_snapshot === 'object'
    ? quote.calculation_snapshot
    : null;
  const savedManualTotalAdjustment = calculationSnapshot?.manualTotalAdjustment || null;
  const rawSnapshotVersionName = calculationSnapshot?.pricingVersionName
    || items.find((item: any) => item?.pricingVersionName)?.pricingVersionName
    || items.find((item: any) => item?.calculationSnapshot?.pricingVersion?.versionName)?.calculationSnapshot?.pricingVersion?.versionName;
  const snapshotCapturedAt = calculationSnapshot?.capturedAt
    || items.find((item: any) => item?.calculationSnapshot?.capturedAt)?.calculationSnapshot?.capturedAt;
  const snapshotVersionName = formatPricingVersionDisplayName({
    versionName: rawSnapshotVersionName,
    capturedAt: snapshotCapturedAt,
  });
  const snapshotItemsCount = items.filter((item: any) => item?.calculationSnapshot).length;
  const quoteExpired = isQuoteExpired(quote.valid_until);
  const canReissueQuote = quoteExpired
    && !quote.reissued_quote_id
    && !quote.project_id
    && !isReissueProtectedProjectStage(quote.project_stage, quote.quote_status);

  return (
    <>
      <PrintStyles quoteNumber={quote.quote_number} projectName={quote.project_name} companyName={quote.recipient_company} isInternal={activeMode === 'internal'} />
      <div className="min-h-screen bg-[hsl(220,10%,95%)] p-2 sm:p-4 print-layout-wrapper">
        <div className="w-full max-w-6xl mx-auto flex flex-col lg:flex-row gap-4 lg:gap-6 print-flex-container">
        <div className="flex-1 min-w-0 max-w-full lg:max-w-4xl print-container" id="saved-quote-print-container" ref={printContainerRef}>
          <QuoteSummaryHeader 
            onClearQuotes={() => {}}
            onPrintPDF={handlePrintPDF}
            currentDate={currentDate}
            quoteNumber={quote.quote_number}
            validUntil={quote.valid_until}
            isEditMode={isEditing}
            onEdit={() => {
              setEditedItemsTouched(false);
              setManualTotalOverride(null);
              setEditedQuoteNotes(quote.quote_notes || '');
              setIsEditing(true);
            }}
            onSaveEdit={handleSaveEdit}
            onCancelEdit={() => { setIsEditing(false); setManualTotalOverride(null); setEditedItemsTouched(false); setEditedQuoteNotes(quote.quote_notes || ''); fetchQuote(); }}
            onToggleViewMode={toggleViewMode}
            viewMode={activeMode}
            showSavedQuoteActions={true}
            quoteStyle={quoteStyle}
          />

          <Card className="shadow-lg border border-gray-300 rounded-xl bg-white quote-main-card [backdrop-filter:none] [-webkit-backdrop-filter:none] [background:white]" style={{ overflow: 'visible' }}>
            <CardContent className="p-6 print:p-4" style={{ overflow: 'visible' }}>
              {/* 견적 요약 정보 */}
              <QuoteSummarySection
                quoteNumber={quote.quote_number}
                currentDate={currentDate}
                itemCount={displayItems.length}
                subtotal={subtotal}
                tax={tax}
                totalWithTax={totalWithTax}
              />

              <QuoteStyleBanner styleType={quoteStyle} itemCount={displayItems.length} />

              {activeMode === 'internal' && !isEditing && (rawSnapshotVersionName || snapshotCapturedAt || snapshotItemsCount > 0) && (
                <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4 print:hidden">
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-950">단가 및 계산 근거</div>
                      <div className="mt-1 text-xs text-slate-600">
                        저장 당시 기준으로 금액이 고정되어 새 단가표가 들어와도 기존 견적 금액은 자동 변경되지 않습니다.
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-white">
                      기존 견적 보호
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div className="rounded-md border bg-white p-3">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <FileText className="h-3.5 w-3.5" />
                        단가표
                      </div>
                      <div className="mt-1 truncate text-sm font-semibold text-slate-900">
                        {snapshotVersionName}
                      </div>
                    </div>
                    <div className="rounded-md border bg-white p-3">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CalendarIcon className="h-3.5 w-3.5" />
                        저장 기준일
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">
                        {snapshotCapturedAt ? new Date(snapshotCapturedAt).toLocaleDateString('ko-KR') : '기록 없음'}
                      </div>
                    </div>
                    <div className="rounded-md border bg-white p-3">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calculator className="h-3.5 w-3.5" />
                        근거 품목
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">
                        {snapshotItemsCount.toLocaleString()} / {items.length.toLocaleString()}개
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Edit Form */}
              {isEditing && (
                <div className="mb-8">
                  <RecipientInfoForm
                    recipientData={recipientData}
                    onChange={handleRecipientChange}
                    onBulkChange={handleBulkRecipientChange}
                    showClientMemo={true}
                  />

                  <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-slate-950">안내사항</h3>
                        <p className="mt-1 text-xs text-slate-500">
                          고객용/내부용 견적서에 표시되는 안내 문구입니다.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditedQuoteNotes(quoteDefaults.quote_notes)}
                      >
                        기본 문구 적용
                      </Button>
                    </div>
                    <Textarea
                      value={editedQuoteNotes}
                      onChange={(event) => setEditedQuoteNotes(event.target.value)}
                      rows={4}
                      placeholder={quoteDefaults.quote_notes}
                      className="min-h-28 resize-y text-sm leading-6"
                    />
                  </div>
                  
                  {/* 첨부 파일 수정 */}
                  <div className="mt-6">
                    <QuoteAttachments
                      attachments={attachments}
                      onAttachmentsChange={handleAttachmentsChange}
                      readOnly={false}
                      quoteId={id}
                      projectId={quote.project_id}
                      quoteNumber={quote.quote_number}
                      recipientCompany={quote.recipient_company || recipientData.companyName}
                      projectName={quote.project_name || recipientData.projectName}
                      quotePdf={quotePdf}
                      onQuotePdfChange={setQuotePdf}
                      showQuotePdfSection={true}
                    />
                  </div>
                </div>
              )}

              {/* 회사 정보 섹션 */}
              <QuoteCompanyInfoSection
                quote={quote}
                currentDate={currentDate}
                recipientData={recipientData}
                companyInfo={companyInfo}
                bankInfo={quoteDefaults.quote_bank_info}
              />

              {/* 견적 목록 */}
              <div className="mb-6 quote-section">
                <h3 className="text-[17px] font-bold text-black mb-4 flex items-center gap-2">
                  <Calculator className="w-5 h-5" />
                  {(activeMode === 'customer' ? quoteStyleProfile.customerItemListTitle : quoteStyleProfile.itemListTitle)} ({displayItems.length}개) {isEditing ? '- 편집 모드' : activeMode === 'customer' ? '' : '- 내부 관리용'}
                </h3>
                <div className="space-y-4">
                  {isEditing ? (
                    <>
                      {editedItems.map((item: any, index: number) => (
                        <EditableQuoteItem
                          key={item.id}
                          item={item}
                          index={index}
                          onUpdate={handleItemUpdate}
                          onRemove={handleItemRemove}
                          quoteId={id}
                        />
                      ))}
                      <Button
                        variant="outline"
                        className="w-full border-dashed border-2 h-14 text-muted-foreground hover:text-primary hover:border-primary"
                        onClick={() => navigate(`/calculator?type=quote&addToQuote=${id}`)}
                      >
                        <Calculator className="w-4 h-4 mr-2" />
                        새 견적 항목 추가하기
                      </Button>
                    </>
                  ) : (
                    items.map((item: any, index: number) => (
                      activeMode === 'customer' ? (
                        <CustomerQuoteCard
                          key={item.id || index}
                          quote={item}
                          index={index}
                          onRemove={() => {}}
                          onUpdateQuantity={() => {}}
                          isCustomerView={true}
                          readOnly={true}
                        />
                      ) : (
                        <QuoteCard
                          key={item.id || index}
                          quote={item}
                          index={index}
                          onRemove={() => {}}
                          onUpdateQuantity={() => {}}
                          readOnly={true}
                        />
                      )
                    ))
                  )}
                </div>
              </div>

              {/* 견적 총 합계 */}
              <QuoteTotalSection
                subtotal={subtotal}
                tax={tax}
                totalWithTax={totalWithTax}
                autoTotalWithTax={autoTotal}
                isEditing={isEditing}
                manualAdjustment={activeMode === 'internal' ? savedManualTotalAdjustment : null}
                onTotalOverride={(s, t, total) => {
                  if (total === 0) {
                    setManualTotalOverride(null);
                  } else {
                    setManualTotalOverride({ subtotal: s, tax: t, total });
                  }
                }}
              />

              {/* 특이사항 및 상담내용 */}
              <QuoteNotesSection
                notes={(isEditing ? editedQuoteNotes : quote.quote_notes) || quoteDefaults.quote_notes}
                consultation={quoteDefaults.quote_consultation}
                viewMode={activeMode}
              />

              {/* 연락처 정보 */}
              <QuoteContactSection
                contactMessage={quoteDefaults.quote_contact_message}
                contactPhone={quoteDefaults.quote_contact_phone}
                contactEmail={quoteDefaults.quote_contact_email}
                recipientData={recipientData}
              />

              {/* 클라이언트 요청사항 */}
              <QuoteClientRequestSection
                recipientMemo={quote.recipient_memo}
                attachments={attachments}
                viewMode={activeMode}
                quoteId={id}
              />

              {/* 첨부 서류 */}
              <QuoteDocumentsSection />
            </CardContent>
          </Card>
        </div>
        {/* 우측 업무 패널 */}
        <div className="w-[300px] shrink-0 print:hidden sticky top-4 self-start hidden lg:block space-y-4 print-side-panel">
          <QuoteWorkflowPanel
            quoteId={quote.id}
            quoteNumber={quote.quote_number}
            projectStage={quote.project_stage}
            quoteUserId={quote.user_id}
            assignedTo={quote.assigned_to}
            assignedToName={quote.assigned_to_name || quote.issuer_name}
            users={assigneeUsers}
            linkedProject={linkedProject}
            projectFollowupStatus={quote.project_followup_status}
            projectFollowupNote={quote.project_followup_note}
            projectFollowupUpdatedAt={quote.project_followup_updated_at}
            convertingProject={convertingProject}
            projectFollowupUpdating={projectFollowupUpdating}
            isExpired={quoteExpired}
            canReissue={canReissueQuote}
            reissuingQuote={reissuingQuote}
            reissuedQuoteId={quote.reissued_quote_id}
            reissuedFromQuoteId={quote.reissued_from_quote_id}
            duplicatingQuote={duplicatingQuote}
            onStageChanged={handleStageChanged}
            onAssigneeChanged={handleAssigneeChanged}
            onConvertProject={handleConvertProject}
            onMarkProjectNotRequired={handleMarkProjectNotRequired}
            onReopenProjectFollowup={handleReopenProjectFollowup}
            onReissueQuote={handleReissueQuote}
            onDuplicateQuote={handleDuplicateQuote}
          />
          {/* 원판 발주 */}
          {id && <QuoteMaterialOrders quoteId={id} />}
          {id && <QuoteMemoPanel quoteId={id} />}
          {id && <QuoteVersionHistory quoteId={id} />}
          {id && <QuoteActivityTimeline quoteId={id} />}
        </div>
        </div>
      </div>
    </>
  );
};

export default SavedQuoteDetailPage;
