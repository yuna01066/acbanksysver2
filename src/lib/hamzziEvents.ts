export const HAMZZI_EVENT_NAME = 'acbank:hamzzi';

export type HamzziEventType =
  | 'quote_issued'
  | 'quote_streak_5'
  | 'attendance_check_in'
  | 'attendance_check_out'
  | 'lunch_time'
  | 'late_night'
  | 'hidden_click';

export type HamzziEventDetail = {
  type: HamzziEventType;
  message?: string;
  description?: string;
  durationMs?: number;
};

const QUOTE_COUNT_PREFIX = 'acbank:hamzzi:quote-count:';
const DAILY_FLAG_PREFIX = 'acbank:hamzzi:daily-flag:';
const HIDDEN_CLICK_KEY = 'acbank:hamzzi:hidden-clicks';

const canUseBrowserStorage = () => {
  if (typeof window === 'undefined') return false;
  try {
    return Boolean(window.localStorage);
  } catch {
    return false;
  }
};

const pad = (value: number) => String(value).padStart(2, '0');

const getDateKey = (date = new Date()) => (
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
);

const readNumber = (key: string) => {
  if (!canUseBrowserStorage()) return 0;
  try {
    const value = window.localStorage.getItem(key);
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
};

const writeNumber = (key: string, value: number) => {
  if (!canUseBrowserStorage()) return;
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Ignore storage failures in restricted browser modes.
  }
};

const markDailyFlag = (flag: string, date = new Date()) => {
  if (!canUseBrowserStorage()) return false;

  const key = `${DAILY_FLAG_PREFIX}${flag}:${getDateKey(date)}`;
  try {
    if (window.localStorage.getItem(key) === 'true') return false;
    window.localStorage.setItem(key, 'true');
    return true;
  } catch {
    return false;
  }
};

export const triggerHamzzi = (type: HamzziEventType, detail: Omit<HamzziEventDetail, 'type'> = {}) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<HamzziEventDetail>(HAMZZI_EVENT_NAME, {
    detail: { type, ...detail },
  }));
};

export const triggerQuoteIssuedHamzzi = (issuedCount = 1, confirmedTodayCount?: number) => {
  const dateKey = getDateKey();
  const countKey = `${QUOTE_COUNT_PREFIX}${dateKey}`;
  const localCount = readNumber(countKey);
  const nextCount = confirmedTodayCount ?? localCount + Math.max(issuedCount, 1);
  writeNumber(countKey, nextCount);

  if (nextCount >= 5 && markDailyFlag('quote-streak-5')) {
    triggerHamzzi('quote_streak_5', {
      message: '오늘 견적 페이스 좋습니다.',
      description: `오늘 ${nextCount}건째 발행했습니다.`,
    });
    return;
  }

  triggerHamzzi('quote_issued', {
    message: issuedCount > 1
      ? `${issuedCount}건의 견적서 발행 완료.`
      : '견적서 발행 완료. 오늘도 한 건 처리했습니다.',
    description: nextCount > 1 ? `오늘 ${nextCount}건째 발행했습니다.` : undefined,
  });
};

export const triggerTimedHamzziIfNeeded = (date = new Date()) => {
  const minutes = date.getHours() * 60 + date.getMinutes();

  if (minutes >= 11 * 60 + 30 && minutes < 13 * 60 + 30 && markDailyFlag('lunch-time', date)) {
    triggerHamzzi('lunch_time', {
      message: '점심시간입니다. 잠깐 쉬어가세요.',
      durationMs: 5200,
    });
    return;
  }

  if (minutes >= 18 * 60 + 30 && minutes < 23 * 60 + 30 && markDailyFlag('late-night', date)) {
    triggerHamzzi('late_night', {
      message: '늦은 시간입니다. 마무리할 업무만 확인하세요.',
      durationMs: 5600,
    });
  }
};

export const registerHamzziLauncherClick = () => {
  if (!canUseBrowserStorage()) return;

  const now = Date.now();
  const current = (() => {
    try {
      return JSON.parse(window.localStorage.getItem(HIDDEN_CLICK_KEY) || '{}') as {
        count?: number;
        startedAt?: number;
      };
    } catch {
      return {};
    }
  })();

  const startedAt = typeof current.startedAt === 'number' ? current.startedAt : now;
  const withinWindow = now - startedAt <= 8000;
  const nextCount = withinWindow ? (current.count || 0) + 1 : 1;

  if (nextCount >= 6) {
    try {
      window.localStorage.removeItem(HIDDEN_CLICK_KEY);
    } catch {
      // Ignore storage failures in restricted browser modes.
    }
    triggerHamzzi('hidden_click', {
      message: '숨겨진 햄찌 반응을 찾았습니다.',
      durationMs: 5200,
    });
    return;
  }

  try {
    window.localStorage.setItem(HIDDEN_CLICK_KEY, JSON.stringify({
      count: nextCount,
      startedAt: withinWindow ? startedAt : now,
    }));
  } catch {
    // Ignore storage failures in restricted browser modes.
  }
};
