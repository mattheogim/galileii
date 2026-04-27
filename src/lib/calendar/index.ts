export interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO-8601 with offset
  end: string;
  location?: string;
  description?: string;
  all_day: boolean;
  /** "opaque" (blocks time) or "transparent" (visible but not busy). Default opaque. */
  transparency?: "opaque" | "transparent";
  recurring?: boolean;
  html_link?: string;
}

export interface CreateEventInput {
  title: string;
  start: string;
  end: string;
  location?: string;
  description?: string;
  calendarId?: string;
  recurrence?: {
    freq?: "DAILY" | "WEEKLY" | "MONTHLY";
    by_day?: Array<"MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU">;
    until?: string;
    count?: number;
  };
}

export interface UpdateEventPatch {
  title?: string;
  start?: string;
  end?: string;
  location?: string;
  description?: string;
}

export interface TimeRange {
  start: string;
  end: string;
}

export interface CalendarBackend {
  listEvents(opts: { calendarId?: string; range: TimeRange }): Promise<CalendarEvent[]>;
  createEvent(input: CreateEventInput): Promise<CalendarEvent>;
  cancelEvent(id: string, opts?: { calendarId?: string }): Promise<void>;
  updateEvent(
    id: string,
    patch: UpdateEventPatch,
    opts?: { calendarId?: string },
  ): Promise<CalendarEvent>;
}

let backend: CalendarBackend | null = null;

export function setCalendarBackend(b: CalendarBackend): void {
  backend = b;
}

export function getCalendarBackend(): CalendarBackend {
  if (!backend) {
    throw new Error(
      "Calendar backend not configured. Run `galileii auth` to connect Google Calendar.",
    );
  }
  return backend;
}
