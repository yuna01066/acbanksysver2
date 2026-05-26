const MISSING_TABLE_MESSAGE = '미팅 예약 DB 테이블이 아직 적용되지 않았습니다. Lovable DB 스키마 적용 후 다시 시도해주세요.';

export const isMissingMeetingReservationsTableError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? '');

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
    : error instanceof Error
    ? error.message || fallback
    : fallback
);
