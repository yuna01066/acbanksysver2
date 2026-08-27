export declare function validateGetScheduleResponse(
  payload: unknown,
  expected?: { view?: string; date?: string },
): string[];

export declare function assertGetScheduleResponse(
  payload: unknown,
  expected?: { view?: string; date?: string },
): void;
