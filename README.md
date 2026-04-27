# Galileii

> Personal scheduling assistant — anti-friction, conversational, empty-time activator. **BYOL** (Bring Your Own LLM).

Galileii is an open-source MCP (Model Context Protocol) server. Plug it into your LLM client — Claude Desktop, Claude Code, Cursor, Claude Dispatch + iMessage — and chat naturally about your schedule.

It does two things calendar apps don't:

1. **Talks to you instead of acting on you.** Every event, every change is *proposed* in chat first, committed only after you say yes. No silent auto-creation.
2. **Finds your empty time and proposes how to use it.** Reverse-direction from Reclaim/Motion: instead of placing given events, it watches for gaps and pulls from a "wants" list you've built up by conversation.

## Status

V0 in active development. The MCP server boots, all 18 tools are wired, the gap-finder + proposer differentiator works end-to-end against a mock calendar backend. Google Calendar adapter (real backend) and OAuth wizard are next.

## Quick start (when V0 ships)

```bash
# 1. Install + initialize
npx galileii init        # scaffolds ~/.galileii/
npx galileii auth        # connects Google Calendar via OAuth (coming soon)
npx galileii doctor      # verifies setup

# 2. Add to your MCP client
#    Claude Desktop: ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "galileii": {
      "command": "npx",
      "args": ["-y", "galileii", "mcp"]
    }
  }
}

# 3. Restart your client. Open a chat:
#    "Hey Galileii — what should I do with my afternoon?"
```

## Bundle the assistant prompt

Galileii ships a recommended system prompt at `dist/prompts/system.md` (or `src/prompts/system.md` when developing). Paste it into your LLM client's "Custom Instructions" or save as a Claude Code skill at `~/.claude/skills/galileii/SKILL.md`. Without it, the LLM sees the tools but won't behave like an assistant.

## The 18 V0 tools

| Group | Tools |
|---|---|
| **Profile** | `read_profile`, `update_profile_proposal`, `commit_profile_update` |
| **Wants** | `read_wants`, `add_want_proposal`, `commit_add_want` |
| **Calendar (read)** | `list_events`, `find_empty_time` |
| **Empty-time activator** | `propose_activity_for_gap` |
| **Calendar (write)** | `propose_event`, `commit_event`, `propose_cancel`, `commit_cancel`, `propose_reschedule`, `commit_reschedule` |
| **Reflection** | `daily_briefing`, `evening_review` |
| **Audit** | `log_decision` |

Every state-changing action is a **propose-then-confirm** dance. Commit tools accept only a `proposal_id`; they cannot mutate the calendar from the LLM's free-text input.

## Storage

All user data is plain markdown with YAML frontmatter at `~/.galileii/`:

```
~/.galileii/
├── config.json
├── .env                  # OAuth refresh token (chmod 600)
├── profile.md            # who you are
├── wants.md              # things you want to do more of
├── routines.md           # weekly recurring blocks
├── places.md             # named locations + transit times
└── decisions.md          # append-only audit log
```

Open it in Obsidian, edit by hand, version-control with git — it's all standard markdown.

## Develop

```bash
git clone https://github.com/<github-handle>/galileii
cd galileii
npm install
npm test                  # runs vitest suite
npm run typecheck
npm run dev               # tsx-runs src/server.ts (talk to it via stdio JSON-RPC)
npm run build             # bundles to dist/ via tsup
```

### Smoke-test the empty-time activator

```bash
GALILEII_HOME=/tmp/galileii-smoke GALILEII_BACKEND=mock-seeded npm run dev
# Then send tools/list, tools/call etc. over stdio JSON-RPC.
# Or run the included flow script in /tmp/galileii-flow.mjs (see CONTRIBUTING).
```

## Architecture

- **Tech:** TypeScript, Node 18+, MCP SDK v1, googleapis, gray-matter, ulid, zod.
- **Build:** tsup (ESM, single file per entry).
- **Tests:** vitest. The gap-finder and ProposalStore have full unit coverage.
- **Distribution:** npm + `npx`. No SaaS infrastructure. Users bring their own LLM subscription.

See [docs/architecture.md](./docs/architecture.md) for the full design (coming soon — see the build plan at `~/.claude/plans/galileii-lucky-lemon.md` for now).

## Roadmap

- **V1**: Google Calendar via direct API + OAuth wizard, OS-scheduler push nudges (launchd/systemd), SFU goSFU portal scraping (read-only), Apple EventKit adapter, recurring-event helper, OS keychain for tokens.
- **V2**: CalDAV adapter (Fastmail/iCloud/etc.), financial deadlines (manual + Plaid), school registration deadlines, multi-calendar conflict resolution UX, community skill registry.

## License

[MIT](./LICENSE).
