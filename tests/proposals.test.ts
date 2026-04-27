import { describe, it, expect } from "vitest";
import { ProposalStore } from "../src/lib/proposals/ProposalStore.js";

describe("ProposalStore", () => {
  it("creates and consumes a proposal once", () => {
    const store = new ProposalStore();
    const p = store.create({
      kind: "create_event",
      summary: "test",
      payload: { x: 1 },
    });
    const c = store.consume(p.id);
    expect("ok" in c && c.ok === false).toBe(false);
    if (!("ok" in c)) {
      expect(c.payload).toEqual({ x: 1 });
    }
  });

  it("returns NOT_FOUND on second consume", () => {
    const store = new ProposalStore();
    const p = store.create({ kind: "add_want", summary: "s", payload: null });
    store.consume(p.id);
    const second = store.consume(p.id);
    expect("ok" in second && second.ok === false).toBe(true);
    if ("error" in second) expect(second.error.code).toBe("PROPOSAL_NOT_FOUND");
  });

  it("returns NOT_FOUND for unknown id", () => {
    const store = new ProposalStore();
    const r = store.consume("01HFAKE");
    expect("error" in r).toBe(true);
    if ("error" in r) expect(r.error.code).toBe("PROPOSAL_NOT_FOUND");
  });

  it("expires after TTL", () => {
    let now = new Date("2026-01-01T00:00:00Z");
    const store = new ProposalStore(() => now);
    const p = store.create({ kind: "note" as never, summary: "s", payload: null });
    now = new Date(now.getTime() + 11 * 60 * 1000);
    const r = store.consume(p.id);
    expect("error" in r).toBe(true);
    if ("error" in r) expect(r.error.code).toBe("PROPOSAL_EXPIRED");
  });
});
