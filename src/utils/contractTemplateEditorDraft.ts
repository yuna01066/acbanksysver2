const CONTRACT_TEMPLATE_DRAFT_STORAGE_PREFIX = 'acbank_contract_template_editor_draft_v1';
const CONTRACT_TEMPLATE_DRAFT_VERSION = 1;
const CONTRACT_TEMPLATE_DRAFT_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;
const CONTRACT_TEMPLATE_DRAFT_FUTURE_TOLERANCE_MS = 1000 * 60 * 5;

export interface ContractTemplateEditorState {
  name: string;
  description: string;
  templateType: string;
  payDay: number;
  isActive: boolean;
  contentSource: 'saved' | 'prebuilt_fallback' | 'empty';
  fallbackTemplateName: string;
  content: unknown;
}

export interface ContractTemplateRecoveryDraft {
  version: 1;
  identity: string;
  savedAt: string;
  state: ContractTemplateEditorState;
}

export const getContractTemplateDraftIdentity = (templateId?: string | null) => (
  templateId || 'new'
);

export const buildContractTemplateDraftStorageKey = (
  userId: string | null | undefined,
  templateId?: string | null,
) => (
  `${CONTRACT_TEMPLATE_DRAFT_STORAGE_PREFIX}:${encodeURIComponent(userId || 'anonymous')}:${encodeURIComponent(getContractTemplateDraftIdentity(templateId))}`
);

export const buildContractTemplateEditorSnapshot = (state: ContractTemplateEditorState) => JSON.stringify({
  name: state.name,
  description: state.description,
  templateType: state.templateType,
  payDay: state.payDay,
  isActive: state.isActive,
  contentSource: state.contentSource,
  fallbackTemplateName: state.fallbackTemplateName,
  content: state.content,
});

const isEditorState = (value: unknown): value is ContractTemplateEditorState => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const state = value as Record<string, unknown>;
  return typeof state.name === 'string'
    && typeof state.description === 'string'
    && typeof state.templateType === 'string'
    && typeof state.payDay === 'number'
    && Number.isFinite(state.payDay)
    && typeof state.isActive === 'boolean'
    && (state.contentSource === 'saved' || state.contentSource === 'prebuilt_fallback' || state.contentSource === 'empty')
    && typeof state.fallbackTemplateName === 'string'
    && 'content' in state;
};

export const parseContractTemplateRecoveryDraft = (
  raw: string | null,
  expectedIdentity: string,
  now = Date.now(),
): ContractTemplateRecoveryDraft | null => {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<ContractTemplateRecoveryDraft>;
    if (
      parsed.version !== CONTRACT_TEMPLATE_DRAFT_VERSION
      || parsed.identity !== expectedIdentity
      || !parsed.savedAt
      || !isEditorState(parsed.state)
    ) {
      return null;
    }

    const savedAt = new Date(parsed.savedAt).getTime();
    const age = now - savedAt;
    if (
      !Number.isFinite(savedAt)
      || age > CONTRACT_TEMPLATE_DRAFT_MAX_AGE_MS
      || age < -CONTRACT_TEMPLATE_DRAFT_FUTURE_TOLERANCE_MS
    ) {
      return null;
    }

    return parsed as ContractTemplateRecoveryDraft;
  } catch {
    return null;
  }
};
