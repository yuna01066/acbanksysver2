const MISSING_TABLE_MESSAGE = '미팅 예약 DB 테이블/컬럼 스키마가 아직 적용되지 않았습니다. Lovable DB 스키마 적용 후 다시 시도해주세요.';

type SupabaseLikeError = {
  code?: unknown;
  details?: unknown;
  hint?: unknown;
  message?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

const getErrorParts = (error: unknown) => {
  if (error instanceof Error) return [error.message];
  if (!isRecord(error)) return [String(error ?? '')];

  const supabaseError = error as SupabaseLikeError;
  return [supabaseError.message, supabaseError.details, supabaseError.hint, supabaseError.code]
    .filter((part): part is string => typeof part === 'string' && part.length > 0);
};

const getErrorMessage = (error: unknown) => getErrorParts(error).join(' ');

export const isMissingMeetingReservationsTableError = (error: unknown) => {
  const message = getErrorMessage(error);

  return (
    message.includes('meeting_reservations')
    && (
      message.includes('schema cache')
      || message.includes('Could not find the table')
      || message.includes('relation "public.meeting_reservations" does not exist')
      || message.includes('relation "meeting_reservations" does not exist')
    )
  );
};

export const getMeetingReservationErrorMessage = (error: unknown, fallback: string) => (
  isMissingMeetingReservationsTableError(error)
    ? MISSING_TABLE_MESSAGE
    : getErrorParts(error)[0]
    ? getErrorParts(error)[0]
    : fallback
);
