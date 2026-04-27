import { google, type calendar_v3 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import type {
  CalendarBackend,
  CalendarEvent,
  CreateEventInput,
  UpdateEventPatch,
} from "./index.js";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
];

export interface GoogleClientCreds {
  client_id: string;
  client_secret: string;
  redirect_uri?: string;
}

export class GoogleCalendarBackend implements CalendarBackend {
  private readonly oauth: OAuth2Client;
  private readonly cal: calendar_v3.Calendar;
  private readonly defaultCalendarId: string;

  constructor(opts: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    refreshToken: string;
    calendarId?: string;
  }) {
    this.oauth = new google.auth.OAuth2({
      clientId: opts.clientId,
      clientSecret: opts.clientSecret,
      redirectUri: opts.redirectUri,
    }) as unknown as OAuth2Client;
    this.oauth.setCredentials({ refresh_token: opts.refreshToken });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.cal = google.calendar({ version: "v3", auth: this.oauth as any });
    this.defaultCalendarId = opts.calendarId ?? "primary";
  }

  async listEvents({
    calendarId,
    range,
  }: {
    calendarId?: string;
    range: { start: string; end: string };
  }): Promise<CalendarEvent[]> {
    const res = await this.cal.events.list({
      calendarId: calendarId ?? this.defaultCalendarId,
      timeMin: range.start,
      timeMax: range.end,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 250,
    });
    return (res.data.items ?? []).map(toCalendarEvent);
  }

  async createEvent(input: CreateEventInput): Promise<CalendarEvent> {
    const body: calendar_v3.Schema$Event = {
      summary: input.title,
      description: input.description,
      location: input.location,
      start: { dateTime: input.start },
      end: { dateTime: input.end },
    };
    if (input.recurrence) {
      const rule = buildRrule(input.recurrence);
      if (rule) body.recurrence = [rule];
    }
    const res = await this.cal.events.insert({
      calendarId: input.calendarId ?? this.defaultCalendarId,
      requestBody: body,
    });
    return toCalendarEvent(res.data);
  }

  async cancelEvent(id: string, opts?: { calendarId?: string }): Promise<void> {
    await this.cal.events.delete({
      calendarId: opts?.calendarId ?? this.defaultCalendarId,
      eventId: id,
    });
  }

  async updateEvent(
    id: string,
    patch: UpdateEventPatch,
    opts?: { calendarId?: string },
  ): Promise<CalendarEvent> {
    const body: calendar_v3.Schema$Event = {};
    if (patch.title !== undefined) body.summary = patch.title;
    if (patch.description !== undefined) body.description = patch.description;
    if (patch.location !== undefined) body.location = patch.location;
    if (patch.start !== undefined) body.start = { dateTime: patch.start };
    if (patch.end !== undefined) body.end = { dateTime: patch.end };
    const res = await this.cal.events.patch({
      calendarId: opts?.calendarId ?? this.defaultCalendarId,
      eventId: id,
      requestBody: body,
    });
    return toCalendarEvent(res.data);
  }
}

function toCalendarEvent(e: calendar_v3.Schema$Event): CalendarEvent {
  const allDay = !!e.start?.date;
  const start = e.start?.dateTime ?? `${e.start?.date}T00:00:00Z`;
  const end = e.end?.dateTime ?? `${e.end?.date}T00:00:00Z`;
  return {
    id: e.id ?? "unknown",
    title: e.summary ?? "(no title)",
    start,
    end,
    location: e.location ?? undefined,
    description: e.description ?? undefined,
    all_day: allDay,
    transparency: e.transparency === "transparent" ? "transparent" : "opaque",
    recurring: !!e.recurringEventId || !!e.recurrence,
    html_link: e.htmlLink ?? undefined,
  };
}

function buildRrule(r: NonNullable<CreateEventInput["recurrence"]>): string | null {
  const parts: string[] = [];
  if (r.freq) parts.push(`FREQ=${r.freq}`);
  if (r.by_day?.length) parts.push(`BYDAY=${r.by_day.join(",")}`);
  if (r.until) parts.push(`UNTIL=${r.until.replace(/-/g, "")}`);
  if (r.count) parts.push(`COUNT=${r.count}`);
  return parts.length ? `RRULE:${parts.join(";")}` : null;
}

export async function getAuthUrl(opts: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<{ url: string; oauth: OAuth2Client }> {
  const oauth = new google.auth.OAuth2({
    clientId: opts.clientId,
    clientSecret: opts.clientSecret,
    redirectUri: opts.redirectUri,
  }) as unknown as OAuth2Client;
  const url = oauth.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });
  return { url, oauth };
}

export async function exchangeCode(
  oauth: OAuth2Client,
  code: string,
): Promise<{ refresh_token: string; access_token?: string }> {
  const { tokens } = await oauth.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error(
      "Google did not return a refresh_token. Revoke the app at https://myaccount.google.com/permissions and try again with prompt=consent.",
    );
  }
  return {
    refresh_token: tokens.refresh_token,
    access_token: tokens.access_token ?? undefined,
  };
}
