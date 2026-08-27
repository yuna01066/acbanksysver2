/**
 * Shared response-schema validator for the `public-meeting-booking`
 * `get-schedule` action. Used by:
 *   - scripts/test-get-schedule-integration.mjs (CI integration test)
 *   - tests/e2e/public-booking.spec.ts (Playwright E2E)
 *
 * Returns an array of human readable problems (empty array = valid).
 */

const VIEWS = new Set(["month", "week", "day"]);
const BLOCK_KINDS = new Set(["confirmed", "pending"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

function isIsoDateTime(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateGetScheduleResponse(payload, expected = {}) {
  const problems = [];
  const push = (message) => problems.push(message);

  if (!isObject(payload)) {
    return ["response body is not a JSON object"];
  }

  if (!VIEWS.has(payload.view)) push(`view must be month|week|day (got ${JSON.stringify(payload.view)})`);
  if (expected.view && payload.view !== expected.view) {
    push(`view mismatch: expected ${expected.view}, got ${JSON.stringify(payload.view)}`);
  }

  const range = payload.range;
  if (!isObject(range)) {
    push("range must be an object");
  } else {
    if (!DATE_RE.test(range.startDate ?? "")) push(`range.startDate must be YYYY-MM-DD (got ${JSON.stringify(range.startDate)})`);
    if (!DATE_RE.test(range.endDate ?? "")) push(`range.endDate must be YYYY-MM-DD (got ${JSON.stringify(range.endDate)})`);
    if (!isIsoDateTime(range.startsAt)) push(`range.startsAt must be an ISO timestamp (got ${JSON.stringify(range.startsAt)})`);
    if (!isIsoDateTime(range.endsAt)) push(`range.endsAt must be an ISO timestamp (got ${JSON.stringify(range.endsAt)})`);
    if (isIsoDateTime(range.startsAt) && isIsoDateTime(range.endsAt)
      && Date.parse(range.endsAt) <= Date.parse(range.startsAt)) {
      push("range.endsAt must be after range.startsAt");
    }
    if (payload.view === "day" && range.startDate !== range.endDate) {
      push(`day view range must cover a single date (got ${range.startDate}..${range.endDate})`);
    }
    if (payload.view === "week" && DATE_RE.test(range.startDate ?? "") && DATE_RE.test(range.endDate ?? "")) {
      const days = Math.round((Date.parse(`${range.endDate}T00:00:00Z`) - Date.parse(`${range.startDate}T00:00:00Z`)) / 86400000);
      if (days !== 6) push(`week view range must span 7 days (got ${days + 1})`);
    }
    if (expected.date && payload.view === "day" && range.startDate !== expected.date) {
      push(`day view range.startDate must equal requested date ${expected.date} (got ${range.startDate})`);
    }
  }

  if (!Array.isArray(payload.resources)) {
    push("resources must be an array");
  } else {
    payload.resources.forEach((resource, index) => {
      if (!isObject(resource)) return push(`resources[${index}] must be an object`);
      if (typeof resource.id !== "string" || !resource.id) push(`resources[${index}].id must be a non-empty string`);
      if (typeof resource.name !== "string" || !resource.name) push(`resources[${index}].name must be a non-empty string`);
      if (!(resource.floor === null || typeof resource.floor === "string")) {
        push(`resources[${index}].floor must be string or null`);
      }
    });
  }

  const rules = payload.rules;
  if (!isObject(rules)) {
    push("rules must be an object");
  } else {
    if (!Array.isArray(rules.allowedWeekdays) || rules.allowedWeekdays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
      push(`rules.allowedWeekdays must be integers 0-6 (got ${JSON.stringify(rules.allowedWeekdays)})`);
    }
    if (!TIME_RE.test(rules.startTime ?? "")) push(`rules.startTime must be HH:MM (got ${JSON.stringify(rules.startTime)})`);
    if (!TIME_RE.test(rules.endTime ?? "")) push(`rules.endTime must be HH:MM (got ${JSON.stringify(rules.endTime)})`);
    for (const key of ["slotMinutes", "durationMinutes"]) {
      if (!Number.isInteger(rules[key]) || rules[key] <= 0) push(`rules.${key} must be a positive integer (got ${JSON.stringify(rules[key])})`);
    }
  }

  if (!Array.isArray(payload.blocks)) {
    push("blocks must be an array");
  } else {
    const resourceIds = new Set(Array.isArray(payload.resources) ? payload.resources.map((r) => r?.id) : []);
    payload.blocks.forEach((block, index) => {
      if (!isObject(block)) return push(`blocks[${index}] must be an object`);
      const at = `blocks[${index}]`;
      if (typeof block.id !== "string" || !block.id) push(`${at}.id must be a non-empty string`);
      if (!BLOCK_KINDS.has(block.kind)) push(`${at}.kind must be confirmed|pending (got ${JSON.stringify(block.kind)})`);
      if (!(block.resourceId === null || typeof block.resourceId === "string")) push(`${at}.resourceId must be string or null`);
      if (typeof block.resourceId === "string" && resourceIds.size > 0 && !resourceIds.has(block.resourceId)) {
        push(`${at}.resourceId ${block.resourceId} is not part of the link resources`);
      }
      if (typeof block.resourceName !== "string" || !block.resourceName) push(`${at}.resourceName must be a non-empty string`);
      if (!DATE_RE.test(block.date ?? "")) push(`${at}.date must be YYYY-MM-DD (got ${JSON.stringify(block.date)})`);
      if (!isIsoDateTime(block.startsAt)) push(`${at}.startsAt must be an ISO timestamp`);
      if (!isIsoDateTime(block.endsAt)) push(`${at}.endsAt must be an ISO timestamp`);
      if (typeof block.allDay !== "boolean") push(`${at}.allDay must be a boolean`);
      if (!TIME_RE.test(block.time ?? "")) push(`${at}.time must be HH:MM (got ${JSON.stringify(block.time)})`);
      if (typeof block.label !== "string" || !block.label) push(`${at}.label must be a non-empty string`);
      if (!(block.sourceType === null || typeof block.sourceType === "string")) push(`${at}.sourceType must be string or null`);
      // Privacy: public schedule must never leak requester/customer details.
      for (const forbidden of ["title", "description", "requesterName", "phone", "email", "purpose", "notes", "companyName"]) {
        if (forbidden in block) push(`${at} must not expose private field "${forbidden}"`);
      }
      if (isObject(range) && isIsoDateTime(block.startsAt) && isIsoDateTime(range.endsAt)
        && Date.parse(block.startsAt) >= Date.parse(range.endsAt)) {
        push(`${at}.startsAt falls outside the requested range`);
      }
    });

    const sorted = [...payload.blocks].every((block, index, all) => (
      index === 0 || String(all[index - 1].startsAt) <= String(block.startsAt)
    ));
    if (!sorted) push("blocks must be sorted by startsAt ascending");
  }

  return problems;
}

export function assertGetScheduleResponse(payload, expected = {}) {
  const problems = validateGetScheduleResponse(payload, expected);
  if (problems.length > 0) {
    throw new Error(`get-schedule schema validation failed:\n- ${problems.join("\n- ")}`);
  }
}
