import type {
  CalendarBackend,
  CalendarEvent,
  CreateEventInput,
  UpdateEventPatch,
} from "./index.js";
import { ulid } from "ulid";

export class MockCalendarBackend implements CalendarBackend {
  private readonly events = new Map<string, CalendarEvent>();

  constructor(seed: CalendarEvent[] = []) {
    for (const e of seed) this.events.set(e.id, e);
  }

  async listEvents({
    range,
  }: {
    calendarId?: string;
    range: { start: string; end: string };
  }): Promise<CalendarEvent[]> {
    const start = Date.parse(range.start);
    const end = Date.parse(range.end);
    return [...this.events.values()]
      .filter((e) => Date.parse(e.end) > start && Date.parse(e.start) < end)
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  }

  async createEvent(input: CreateEventInput): Promise<CalendarEvent> {
    const event: CalendarEvent = {
      id: `mock_${ulid().slice(-10).toLowerCase()}`,
      title: input.title,
      start: input.start,
      end: input.end,
      location: input.location,
      description: input.description,
      all_day: false,
      recurring: !!input.recurrence,
    };
    this.events.set(event.id, event);
    return event;
  }

  async cancelEvent(id: string): Promise<void> {
    this.events.delete(id);
  }

  async updateEvent(id: string, patch: UpdateEventPatch): Promise<CalendarEvent> {
    const existing = this.events.get(id);
    if (!existing) throw new Error(`Event not found: ${id}`);
    const next: CalendarEvent = { ...existing, ...patch };
    this.events.set(id, next);
    return next;
  }
}
