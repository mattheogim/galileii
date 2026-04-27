import { ulid } from "ulid";

export type ProposalKind =
  | "create_event"
  | "cancel_event"
  | "reschedule_event"
  | "update_profile"
  | "add_want"
  | "activity_suggestion";

export interface Proposal<P = unknown> {
  id: string;
  kind: ProposalKind;
  summary: string;
  payload: P;
  createdAt: string;
  expiresAt: string;
  refs?: { wantId?: string; gapId?: string; eventId?: string };
}

export interface ConsumeError {
  ok: false;
  error: { code: "PROPOSAL_NOT_FOUND" | "PROPOSAL_EXPIRED"; message: string };
}

const TTL_MS = 10 * 60 * 1000;

export class ProposalStore {
  private readonly map = new Map<string, Proposal>();

  constructor(private readonly now: () => Date = () => new Date()) {}

  create<P>(input: {
    kind: ProposalKind;
    summary: string;
    payload: P;
    refs?: Proposal["refs"];
  }): Proposal<P> {
    this.reapExpired();
    const id = ulid();
    const createdAt = this.now();
    const expiresAt = new Date(createdAt.getTime() + TTL_MS);
    const proposal: Proposal<P> = {
      id,
      kind: input.kind,
      summary: input.summary,
      payload: input.payload,
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      refs: input.refs,
    };
    this.map.set(id, proposal as Proposal);
    return proposal;
  }

  consume<P = unknown>(id: string): Proposal<P> | ConsumeError {
    const proposal = this.map.get(id);
    if (!proposal) {
      return {
        ok: false,
        error: { code: "PROPOSAL_NOT_FOUND", message: `No proposal: ${id}` },
      };
    }
    this.map.delete(id);
    if (Date.parse(proposal.expiresAt) < this.now().getTime()) {
      this.reapExpired();
      return {
        ok: false,
        error: {
          code: "PROPOSAL_EXPIRED",
          message: `Proposal expired at ${proposal.expiresAt}`,
        },
      };
    }
    this.reapExpired();
    return proposal as Proposal<P>;
  }

  peek<P = unknown>(id: string): Proposal<P> | null {
    return (this.map.get(id) as Proposal<P>) ?? null;
  }

  size(): number {
    return this.map.size;
  }

  private reapExpired(): void {
    const cutoff = this.now().getTime();
    for (const [id, p] of this.map) {
      if (Date.parse(p.expiresAt) < cutoff) this.map.delete(id);
    }
  }
}

export const proposalStore = new ProposalStore();
