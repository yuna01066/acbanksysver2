export type PublicBookingLinkType = 'customer_request' | 'partner_room' | 'consultation_booking';
export type PublicBookingRequestStatus = 'pending_review' | 'confirmed' | 'rejected' | 'canceled' | 'expired';
export type PublicBookingMeetingMode = 'visit' | 'phone' | 'online';
export type PublicBookingContactPreference = 'phone' | 'email' | 'kakao' | 'any';

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
  meetingModes: PublicBookingMeetingMode[];
  rules: PublicBookingLinkRules;
  resources: PublicBookingResource[];
};

export type PublicBookingSlot = {
  resourceId: string | null;
  resourceName: string;
  meetingMode: PublicBookingMeetingMode;
  assignedTo?: string | null;
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
  assigned_user_ids: string[];
  meeting_modes: PublicBookingMeetingMode[];
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
  resource_id: string | null;
  consultation_lead_id: string | null;
  assigned_to: string | null;
  meeting_mode: PublicBookingMeetingMode;
  contact_preference: PublicBookingContactPreference | null;
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
  assigned_profile?: {
    id: string;
    full_name: string | null;
    department: string | null;
  } | null;
  client_consultation_leads?: {
    id: string;
    status: string;
    consultation_type: string;
  } | null;
};

export type PublicBookingLinkDraft = {
  id?: string;
  slug: string;
  link_type: PublicBookingLinkType;
  title: string;
  description?: string | null;
  is_active: boolean;
  allowed_resource_ids: string[];
  assigned_user_ids: string[];
  meeting_modes: PublicBookingMeetingMode[];
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
