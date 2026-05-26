import { format } from 'date-fns';

export type AnnouncementMeetingType = 'conference' | 'meeting';

type AnnouncementMeetingPayloadInput = {
  announcementId: string;
  announcementType: AnnouncementMeetingType;
  title: string;
  content: string;
  meetingDate: string;
  meetingTime?: string | null;
  meetingLocation?: string | null;
  authorId: string;
  authorName: string;
  recipientId?: string | null;
  recipientName?: string | null;
  assigneeIds?: string[] | null;
  assigneeNames?: string[] | null;
};

export const isAnnouncementMeetingType = (type: string): type is AnnouncementMeetingType =>
  type === 'conference' || type === 'meeting';

export const normalizeAnnouncementMeetingTime = (time?: string | null) => {
  if (time && /^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return time;
  return '10:00';
};

const addMinutesToTime = (time: string, minutes: number) => {
  const [hour, minute] = time.split(':').map(Number);
  const date = new Date(2000, 0, 1, hour || 0, minute || 0);
  date.setMinutes(date.getMinutes() + minutes);
  return format(date, 'HH:mm');
};

export const buildMeetingReservationFromAnnouncement = ({
  announcementId,
  announcementType,
  title,
  content,
  meetingDate,
  meetingTime,
  meetingLocation,
  authorId,
  authorName,
  recipientId,
  recipientName,
  assigneeIds,
  assigneeNames,
}: AnnouncementMeetingPayloadInput) => {
  const startTime = normalizeAnnouncementMeetingTime(meetingTime);
  const isConference = announcementType === 'conference';

  return {
    audience_type: isConference ? 'employee' : 'client',
    employee_meeting_type: isConference ? 'all_hands' : null,
    client_meeting_type: isConference ? null : 'other',
    title: title.trim(),
    description: content.trim() || null,
    meeting_date: meetingDate,
    start_time: startTime,
    end_time: addMinutesToTime(startTime, 60),
    location: meetingLocation?.trim() || null,
    status: 'scheduled',
    recipient_id: !isConference ? recipientId || null : null,
    client_name: !isConference ? recipientName?.trim() || null : null,
    client_contact: null,
    participant_ids: !isConference ? assigneeIds || [] : [],
    participant_names: !isConference ? assigneeNames || [] : [],
    created_by: authorId,
    created_by_name: authorName,
    source_announcement_id: announcementId,
  };
};
