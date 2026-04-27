import { describe, it, expect } from "vitest";
import { findGaps } from "../src/lib/gap-finder/index.js";
import type { CalendarEvent } from "../src/lib/calendar/index.js";

const E = (
  id: string,
  start: string,
  end: string,
  extra: Partial<CalendarEvent> = {},
): CalendarEvent => ({
  id,
  title: id,
  start,
  end,
  all_day: false,
  ...extra,
});

describe("findGaps", () => {
  it("returns the whole work window when calendar is empty", () => {
    const gaps = findGaps({
      events: [],
      range: {
        start: "2026-04-27T00:00:00Z",
        end: "2026-04-28T00:00:00Z",
      },
      buffer_minutes: 0,
    });
    expect(gaps.length).toBe(1);
    expect(gaps[0]?.duration_minutes).toBe(14 * 60); // 08:00 to 22:00 = 14h
  });

  it("returns no gaps when the day is fully booked across work hours", () => {
    const gaps = findGaps({
      events: [E("blob", "2026-04-27T07:00:00Z", "2026-04-27T23:00:00Z")],
      range: {
        start: "2026-04-27T00:00:00Z",
        end: "2026-04-28T00:00:00Z",
      },
      buffer_minutes: 0,
    });
    expect(gaps).toEqual([]);
  });

  it("finds the gap between two events", () => {
    const gaps = findGaps({
      events: [
        E("class", "2026-04-27T10:00:00Z", "2026-04-27T11:00:00Z", {
          location: "SFU Burnaby",
        }),
        E("gym", "2026-04-27T18:00:00Z", "2026-04-27T19:00:00Z"),
      ],
      range: {
        start: "2026-04-27T00:00:00Z",
        end: "2026-04-28T00:00:00Z",
      },
      buffer_minutes: 0,
      min_duration_minutes: 30,
    });
    const between = gaps.find(
      (g) => g.start === "2026-04-27T11:00:00.000Z" && g.end === "2026-04-27T18:00:00.000Z",
    );
    expect(between).toBeDefined();
    expect(between?.duration_minutes).toBe(7 * 60);
    expect(between?.preceded_by?.title).toBe("class");
    expect(between?.followed_by?.title).toBe("gym");
    expect(between?.implied_starting_location).toBe("SFU Burnaby");
  });

  it("respects min_duration_minutes", () => {
    const gaps = findGaps({
      events: [
        E("a", "2026-04-27T10:00:00Z", "2026-04-27T10:50:00Z"),
        E("b", "2026-04-27T11:00:00Z", "2026-04-27T22:00:00Z"),
      ],
      range: {
        start: "2026-04-27T00:00:00Z",
        end: "2026-04-28T00:00:00Z",
      },
      buffer_minutes: 0,
      min_duration_minutes: 30,
    });
    expect(gaps.find((g) => g.duration_minutes === 10)).toBeUndefined();
  });

  it("merges overlapping events into one busy block", () => {
    const gaps = findGaps({
      events: [
        E("a", "2026-04-27T09:00:00Z", "2026-04-27T11:00:00Z"),
        E("b", "2026-04-27T10:30:00Z", "2026-04-27T12:00:00Z"),
      ],
      range: {
        start: "2026-04-27T00:00:00Z",
        end: "2026-04-28T00:00:00Z",
      },
      buffer_minutes: 0,
    });
    const morning = gaps.find((g) => g.end === "2026-04-27T09:00:00.000Z");
    const after = gaps.find((g) => g.start === "2026-04-27T12:00:00.000Z");
    expect(morning?.duration_minutes).toBe(60);
    expect(after?.duration_minutes).toBe(10 * 60);
  });

  it("treats all-day events as fully busy", () => {
    const gaps = findGaps({
      events: [
        E("trip", "2026-04-27T00:00:00Z", "2026-04-28T00:00:00Z", { all_day: true }),
      ],
      range: {
        start: "2026-04-27T00:00:00Z",
        end: "2026-04-28T00:00:00Z",
      },
      buffer_minutes: 0,
    });
    expect(gaps).toEqual([]);
  });

  it("applies buffer to shrink event boundaries", () => {
    const gaps = findGaps({
      events: [E("a", "2026-04-27T11:00:00Z", "2026-04-27T12:00:00Z")],
      range: {
        start: "2026-04-27T00:00:00Z",
        end: "2026-04-28T00:00:00Z",
      },
      buffer_minutes: 30, // shrinks by 15 each side
      min_duration_minutes: 5,
    });
    // After buffer: busy 11:15–11:45. Free chunks: 08:00–11:15 + 11:45–22:00.
    const morning = gaps.find((g) => g.end === "2026-04-27T11:15:00.000Z");
    const after = gaps.find((g) => g.start === "2026-04-27T11:45:00.000Z");
    expect(morning?.duration_minutes).toBe(195);
    expect(after?.duration_minutes).toBe(615);
  });

  it("caps gaps at max_gaps and orders by duration desc", () => {
    const gaps = findGaps({
      events: [],
      range: {
        start: "2026-04-27T00:00:00Z",
        end: "2026-04-30T00:00:00Z",
      },
      buffer_minutes: 0,
      max_gaps: 2,
    });
    expect(gaps.length).toBe(2);
    expect(gaps[0]?.duration_minutes).toBeGreaterThanOrEqual(
      gaps[1]?.duration_minutes ?? 0,
    );
  });
});
