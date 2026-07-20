export type PublicBookingLinkType = 'customer_request' | 'partner_room';
export type PublicBookingRequestStatus = 'pending_review' | 'confirmed' | 'rejected' | 'canceled' | 'expired';

export type PublicBookingResource = {
  id: string;
  name: string;
  floor: string | null;
};

export type PublicBookingLinkRules = {
  allowedWeekdays: number[];
  startTime: string;
  endTime: string;
  slotMinutes: number;
  durationMinutes: number;
  bufferMinutes: number;
  minNoticeMinutes: number;
  maxDaysAhead: number;
};

export type PublicBookingLinkPublic = {
  slug: string;
  linkType: PublicBookingLinkType;
  title: string;
  description: string | null;
  isActive: boolean;
  requiresApproval: boolean;
  requiresAccessCode: boolean;
  rules: PublicBookingLinkRules;
  resources: PublicBookingResource[];
};

export type PublicBookingSlot = {
  resourceId: string;
  resourceName: string;
  startsAt: string;
  endsAt: string;
  time: string;
  label: string;
};

export type PublicBookingLinkRow = {
  id: string;
  slug: string;
  link_type: PublicBookingLinkType;
  title: string;
  description: string | null;
  is_active: boolean;
  allowed_resource_ids: string[];
  allowed_weekdays: number[];
  start_time: string;
  end_time: string;
  slot_minutes: number;
  duration_minutes: number;
  buffer_minutes: number;
  min_notice_minutes: number;
  max_days_ahead: number;
  requires_approval: boolean;
  access_code_hash: string | null;
  notify_user_ids: string[];
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PublicBookingRequestRow = {
  id: string;
  link_id: string;
  status: PublicBookingRequestStatus;
  starts_at: string;
  ends_at: string;
  resource_id: string;
  requester_name: string;
  company_name: string | null;
  phone: string | null;
  email: string | null;
  purpose: string;
  notes: string | null;
  calendar_event_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  public_booking_links?: Pick<PublicBookingLinkRow, 'id' | 'slug' | 'title' | 'link_type' | 'requires_approval'> | null;
  calendar_resources?: Pick<PublicBookingResource, 'id' | 'name' | 'floor'> | null;
};

export type PublicBookingLinkDraft = {
  id?: string;
  slug: string;
  link_type: PublicBookingLinkType;
  title: string;
  description?: string | null;
  is_active: boolean;
  allowed_resource_ids: string[];
  allowed_weekdays: number[];
  start_time: string;
  end_time: string;
  slot_minutes: number;
  duration_minutes: number;
  buffer_minutes: number;
  min_notice_minutes: number;
  max_days_ahead: number;
  requires_approval: boolean;
  access_code?: string;
  clear_access_code?: boolean;
  notify_user_ids: string[];
};
