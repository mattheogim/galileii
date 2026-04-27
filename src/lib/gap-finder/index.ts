import type { CalendarEvent } from "../calendar/index.js";

export interface Gap {
  gap_id: string;
  start: string; // ISO-8601
  end: string;
  duration_minutes: number;
  preceded_by?: { title: string; ends_at: string; location?: string };
  followed_by?: { title: string; starts_at: string; location?: string };
  implied_starting_location?: string;
}

export interface GapFinderInput {
  events: CalendarEvent[];
  range: { start: string; end: string };
  min_duration_minutes?: number;
  max_gaps?: number;
  exclude_before?: string; // "HH:MM:SS"
  exclude_after?: string;
  buffer_minutes?: number;
  timezone_offset_minutes?: number; // default 0 (assume timestamps are correct)
}

const DEFAULT_MIN = 30;
const DEFAULT_MAX = 5;
const DEFAULT_BEFORE = "08:00:00";
const DEFAULT_AFTER = "22:00:00";
const DEFAULT_BUFFER = 15;

interface Interval {
  start: number;
  end: number;
  source?: CalendarEvent;
}

export function findGaps(input: GapFinderInput): Gap[] {
  const min = input.min_duration_minutes ?? DEFAULT_MIN;
  const max = input.max_gaps ?? DEFAULT_MAX;
  const before = input.exclude_before ?? DEFAULT_BEFORE;
  const after = input.exclude_after ?? DEFAULT_AFTER;
  const buffer = input.buffer_minutes ?? DEFAULT_BUFFER;

  const rangeStart = Date.parse(input.range.start);
  const rangeEnd = Date.parse(input.range.end);
  if (!(rangeEnd > rangeStart)) return [];

  const halfBufferMs = (buffer / 2) * 60_000;
  const minMs = min * 60_000;

  // 1. Convert events to busy intervals, shrunk by half-buffer on each side
  //    (so transition padding is excluded from "free time"). Skip all-day events
  //    that don't overlap the work window meaningfully — but mark them as busy if they
  //    explicitly indicate so. For V0, treat all-day events as full-day busy unless
  //    they are transparent (the backend should mark these via `all_day`).
  const busy: Interval[] = [];
  for (const e of input.events) {
    const s = Date.parse(e.start);
    const en = Date.parse(e.end);
    if (!(en > s)) continue;
    if (e.all_day) {
      busy.push({ start: s, end: en, source: e });
    } else {
      busy.push({
        start: s + halfBufferMs,
        end: en - halfBufferMs,
        source: e,
      });
    }
  }

  // 2. For each calendar day in the range, build the work-window interval.
  const workWindows: Interval[] = [];
  for (
    let dayStart = startOfDay(rangeStart);
    dayStart < rangeEnd;
    dayStart += 24 * 60 * 60 * 1000
  ) {
    const start = applyTime(dayStart, before);
    const end = applyTime(dayStart, after);
    const clamped = {
      start: Math.max(start, rangeStart),
      end: Math.min(end, rangeEnd),
    };
    if (clamped.end > clamped.start) workWindows.push(clamped);
  }

  // 3. For each work window, subtract busy intervals that overlap it.
  const free: Interval[] = [];
  for (const window of workWindows) {
    const overlapping = busy
      .filter((b) => b.end > window.start && b.start < window.end)
      .map((b) => ({
        start: Math.max(b.start, window.start),
        end: Math.min(b.end, window.end),
        source: b.source,
      }))
      .sort((a, b) => a.start - b.start);

    // Merge overlapping busy intervals
    const merged: Interval[] = [];
    for (const b of overlapping) {
      const last = merged[merged.length - 1];
      if (last && b.start <= last.end) {
        last.end = Math.max(last.end, b.end);
      } else {
        merged.push({ ...b });
      }
    }

    // Walk windows minus merged busy
    let cursor = window.start;
    for (const b of merged) {
      if (b.start > cursor) free.push({ start: cursor, end: b.start });
      cursor = Math.max(cursor, b.end);
    }
    if (cursor < window.end) free.push({ start: cursor, end: window.end });
  }

  // 4. Filter by min duration, annotate with surrounding context, cap at max_gaps.
  const sortedEvents = [...input.events].sort(
    (a, b) => Date.parse(a.start) - Date.parse(b.start),
  );
  const gaps: Gap[] = [];
  let i = 0;
  for (const f of free) {
    const dur = (f.end - f.start) / 60_000;
    if (dur < min) continue;
    const preceded = lastEventEndingAtOrBefore(sortedEvents, f.start);
    const followed = firstEventStartingAtOrAfter(sortedEvents, f.end);
    gaps.push({
      gap_id: `gap_${i++}_${Math.round(f.start / 60000)}`,
      start: new Date(f.start).toISOString(),
      end: new Date(f.end).toISOString(),
      duration_minutes: Math.round(dur),
      preceded_by: preceded
        ? { title: preceded.title, ends_at: preceded.end, location: preceded.location }
        : undefined,
      followed_by: followed
        ? {
            title: followed.title,
            starts_at: followed.start,
            location: followed.location,
          }
        : undefined,
      implied_starting_location: preceded?.location,
    });
  }

  // 5. Sort by duration descending and cap.
  gaps.sort((a, b) => b.duration_minutes - a.duration_minutes);
  return gaps.slice(0, max);
}

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

function applyTime(dayStartMs: number, time: string): number {
  const [hh = 0, mm = 0, ss = 0] = time.split(":").map(Number);
  return dayStartMs + (hh * 60 + mm) * 60_000 + ss * 1000;
}

function lastEventEndingAtOrBefore(
  events: CalendarEvent[],
  ts: number,
): CalendarEvent | undefined {
  let candidate: CalendarEvent | undefined;
  for (const e of events) {
    const en = Date.parse(e.end);
    if (en <= ts && (!candidate || en > Date.parse(candidate.end))) candidate = e;
  }
  return candidate;
}

function firstEventStartingAtOrAfter(
  events: CalendarEvent[],
  ts: number,
): CalendarEvent | undefined {
  for (const e of events) {
    if (Date.parse(e.start) >= ts) return e;
  }
  return undefined;
}
