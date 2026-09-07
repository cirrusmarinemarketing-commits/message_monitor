# Frontend Redesign — Unified Communication Monitoring & Operations Console

Date: 2026-09-07 (in progress — reported "for now" per request)

Full rebuild of `whatsapp-ai/frontend` from a static WhatsApp-only dashboard
into a channel-agnostic operations console, per the task brief. Backend
pipeline itself was not touched beyond the two additive services below.

## 1. What was redesigned

Replaced the entire page/view layer and design language:

- **Overview** is now a real command center: critical-alerts strip, 8 KPI
  cards (each clickable, jumping into a pre-filtered Inbox), a System
  Health grid (WhatsApp ingestion / Gmail ingestion / AI processing /
  Pipeline processing + per-channel last-activity), a live Recent Activity
  feed, and Recent Conversations — replacing the old view's single intent
  breakdown chart + flat recent list.
- **Inbox** (new) replaces the old WhatsApp-only "Conversations" list: one
  unified queue for both channels with search (debounced), 9 filter chips
  (All / WhatsApp / Email / Needs attention / Waiting for Cirrus / Waiting
  for customer / Open case / Human handoff / Resolved), priority-based
  default sort (urgent conversations — open handoffs — first, not just
  newest), and per-row channel/intent/AI-action/status/case/handoff badges
  plus a "new" indicator for very recent, untouched messages.
- **Conversation Detail** is now a wide drawer "investigation workspace"
  with two columns: timeline on the left, and on the right — Customer info,
  AI Analysis (all fields, human-readable, not JSON), AI Decision (business
  action + pending action), Service Case, Human Handoff, and Channel info —
  each only rendered when data exists for that conversation.
- **Cases** and **Handoffs** got dedicated pages with status filter chips,
  search, and a computed priority badge (handoffs: OPEN=urgent; cases:
  OPEN=high), replacing the old flat "record list" with no filtering.
- **Activity Monitor** (new page) is a live event stream of the 9 pipeline
  stages (WhatsApp/Gmail received, conversation updated, AI analysis
  completed, business action generated, case/handoff created, response
  generated, processing error), filterable by channel or errors-only.

## 2. New information architecture

```
Overview  → command center (health, KPIs, alerts, recent activity)
Inbox     → unified conversation queue (both channels, filters, search)
Cases     → service case queue (status filters)
Handoffs  → human handoff queue (status filters)
Activity  → live pipeline event stream
```

Sidebar nav count badges show open cases / open handoffs; a red banner
appears above nav whenever any conversation has an open human handoff.
Clicking a KPI card or the alert banner on Overview navigates to Inbox
with the matching filter already applied (real cross-page action, not
decorative).

Every list/detail surface is keyed by `conversationId` + `channel`, never
`waId` alone. `ConversationDrawer` is the single component both Inbox,
Cases, and Handoffs open into — no separate WhatsApp/Gmail UI exists
anywhere.

## 3. Components created / removed

**Removed** (superseded, not preserved for their own sake):
`views/OverviewView.tsx`, `views/ConversationsView.tsx`,
`views/CasesView.tsx`, `views/HandoffsView.tsx`,
`components/ConversationDetail.tsx`, `components/Pill.tsx`,
`components/ObjectiveTag.tsx`, `lib/objective.ts` (the old "objective"
concept only worked for case/handoff-linked conversations; the backend now
returns `intent`/`summary`/`conversationStatus` directly on every
conversation, so the indirection was no longer needed).

**Created**:
- `pages/`: `OverviewPage`, `InboxPage`, `CasesPage`, `HandoffsPage`,
  `ActivityPage`
- `components/ConversationDrawer.tsx` (replaces `ConversationDetail`)
- `components/ui/`: `Badge`, `StatusBadge`, `ChannelBadge`, `PriorityBadge`,
  `KpiCard`, `EmptyState`, `ErrorState`, `Skeleton`, `FreshnessBar`,
  `SearchInput` (debounced), `FilterChips`, `Drawer` (generic shell)
- `lib/`: `status.ts` (single status→color/tone map used everywhere —
  case/handoff status, AI conversation status, and component health state
  all go through one function, so color semantics are actually consistent
  app-wide), `channel.ts`, `priority.ts`, `format.ts` (relative/absolute
  time); `lib/intent.ts` extended with `getActionLabel`
- `hooks/useDashboardData.ts`: single polling hook (15s interval, one
  `Promise.all` per tick, in-flight guard against overlapping fetches) that
  tracks loading / online / error / `lastUpdatedAt` / `stale` (data older
  than 3× the refresh interval) for every data-driven component to consume
  consistently.
- `components/Sidebar.tsx` rewritten for the new nav + urgent-alert banner.

Every page/list handles loading (`Skeleton`), empty (`EmptyState`), and
error (`ErrorState` with retry) states explicitly — nothing renders a bare
empty container.

## 4. API / backend changes

Kept genuinely minimal, per the instruction to reuse existing APIs and
only extend where data was truly missing (no business/AI/pipeline logic
touched):

- **New** `services/activity.service.ts` — in-memory ring buffer (200
  events) of pipeline events. `recordActivity()` called from
  `pipeline.service.ts`, `conversation.buffer.service.ts`,
  `routes/whatsapp.ts`, and `gmail/processor.ts` at the same points the
  code already logs to console — no new business logic, just recording
  what already happens.
- **New** `services/system-status.service.ts` — per-component health
  (`whatsapp` / `gmail` / `ai` / `pipeline`), each
  `{state, lastEventAt, lastError}`. Updated from the real success/error
  paths already present in `gmail/pubsub-listener.ts`,
  `routes/whatsapp.ts`, and `conversation.buffer.service.ts` — this is what
  makes "Gmail ingestion: healthy, last event 3m ago" an honest signal
  instead of the frontend guessing from data recency alone.
- **New endpoints**: `GET /api/dashboard/activity?limit=` and
  `GET /api/dashboard/health`, added to `router.service.ts` and
  `routes/dashboard.ts`.
- `getDashboardConversations()` now also returns `action` (the AI's
  business decision) per conversation — needed for the Inbox row's
  "required action" column; was already computed, just not returned.
- `getDashboardConversation()` now also returns the full `analysis` object
  (equipment, problem, location, request, customer/cirrus position,
  pending action) — the Conversation Detail workspace's "AI Analysis"
  section needs these and they weren't exposed before.
- `case.service.ts`'s `ServiceCase` gained an `intent` field, set from
  `analysis.intent` at creation — needed for the Cases page and was
  trivially available.
- Deliberately **not** added: case/handoff "assign" or "resolve"
  mutations, or outbound reply sending. See limitations below.

## 5. Build / test result

- Backend: `npx tsc --noEmit` (with the project's pre-existing
  `verbatimModuleSyntax`/`googleapis` noise filtered out, as established in
  the earlier refactor report) — zero new errors in any touched file.
- Frontend: `npx tsc -b` — clean. `npm run build` (`tsc -b && vite build`)
  — succeeds:
  ```
  dist/index.html                   0.45 kB
  dist/assets/index-*.css          16.89 kB
  dist/assets/index-*.js          225.93 kB
  ✓ built in 176ms
  ```
- Live verification: ran both dev servers, fetched every new page module
  through Vite's dev transform (all 200 OK, no transform errors), and sent
  a real WhatsApp test message through the running backend. Confirmed the
  actual API responses match the new frontend types field-for-field:
  `conversations[].action`, `cases[].intent`, `conversations/:id.analysis`,
  and `/activity` all returned exactly the shapes the new components
  expect (see raw responses earlier in this session).
- **Limitation**: no interactive browser tool is available in this
  environment, so the UI was not visually clicked through or
  screenshotted. Verification is build/typecheck + live API-shape
  compatibility, not a rendered-pixel check. This should be spot-checked
  in an actual browser before considering the visual design final.

## 6. Remaining limitations

- **No mutation APIs exist yet.** The backend has zero write/update
  endpoints (no assign, resolve, or reply). The task's "Action-oriented
  UX" examples (Assign, Resolve, Reply) are therefore only partially
  real: "Open Conversation" everywhere is a genuine action (opens the
  real drawer with real data); assign/resolve buttons were deliberately
  **not** added as fake, no-op controls, since that would violate the
  "no decorative UI with no operational value" instruction. Building real
  assign/resolve/reply would be a backend mutation-API project of its own.
- **"Resolved" filter on Inbox is a heuristic**, not a real backend
  concept — conversations don't carry a resolved flag, only cases/handoffs
  do. It currently approximates "no open case attached, not casual chat."
  Worth revisiting once/if the backend gains a real conversation-level
  resolution state.
- Outbound message delivery still doesn't exist (pre-existing, out of
  scope) — `response.service.ts` generates text but nothing sends it, so
  there is nothing for the UI to show as "sent."
- Charts were intentionally dropped from Overview (the task explicitly
  said not to overload the screen with charts unless they answer a real
  operational question) — Recharts remains a dependency but is currently
  unused; worth removing from `package.json` if no chart need re-emerges.
- Visual QA in an actual browser (see Build/test result above) is still
  needed.


## Addendum (2026-09-07, follow-up fix): Gmail conversations missing from dashboard

**Report**: real Gmail Pub/Sub test showed the case was created successfully
with `channel: "email"`, but `/api/dashboard/conversations` kept returning
only `channel: "whatsapp"`.

**Investigation**: re-checked the four things the follow-up task suspected —
`router.service.ts` (no `waId` filtering, reads `channel`/`messages` off the
already-fixed `ConversationRecord`), `conversation.service.ts`
(`ingestNormalizedMessage` calls `addConversationMessage` synchronously
before buffering), and Gmail conversation identity
(`gmail/normalizer.ts` already maps `conversationId: email.threadId`, not
`messageId` — this was already correct from the original refactor). All four
were already correct; none needed changes.

**Real root cause**: `package.json`'s `dev` script ran the Express server
and the Gmail Pub/Sub listener as **two separate OS processes**
(`concurrently "tsx watch src/server.ts" "tsx src/gmail/test-pubsub.ts"`),
and `start` didn't run the Gmail listener at all. Each Node process gets its
own copy of every module's in-memory state, so `conversation.service.ts`'s
`Map` in the Pub/Sub-listener process was a completely different object from
the one the Express server process reads for `/api/dashboard/*`. Gmail
messages really were normalized, stored, analyzed, and turned into cases —
just in memory the dashboard API could never see.

### Files changed

- **`src/gmail/pubsub-listener.ts`** (new) — the Pub/Sub subscription +
  processing-queue logic, extracted out of `test-pubsub.ts` into
  `startGmailPubSubListener()`, callable from any process. Wrapped in
  try/catch so a startup failure (e.g. missing GCP credentials) is logged
  and swallowed instead of crashing the caller.
- **`src/gmail/test-pubsub.ts`** (edited) — now just calls
  `startGmailPubSubListener()`. Still works standalone via
  `npm run gmail:pubsub` for manual debugging.
- **`src/server.ts`** (edited) — calls `startGmailPubSubListener()` from
  inside `app.listen()`'s callback, so Gmail ingestion now runs in the same
  process as the Express server and shares the same in-memory
  conversation/case/handoff stores that `/api/dashboard/*` reads from.
- **`package.json`** (edited) — `dev` script simplified to
  `tsx watch src/server.ts` (dropped the redundant second `concurrently`
  process, since `server.ts` now starts the listener itself). `start` is
  unchanged and now correctly includes Gmail ingestion too, which it never
  did before.

### Verification

Restarted the server fresh and confirmed in the logs that
`"A Final Odyssey running on port 3001"` and `"Starting Gmail Pub/Sub
processor..."` / `"Listening for Gmail notifications..."` all come from the
same process startup, with the Pub/Sub subscription connecting successfully
and the HTTP server still serving requests immediately after.

To prove the actual reported symptom is fixed without needing a live Gmail
inbox round-trip, added a temporary debug route in the running process that
called the same `normalizeGmailMessage` → `ingestNormalizedMessage` path
`gmail/processor.ts` uses, then removed it once confirmed. Result, in one
running process:

- `POST /webhook/whatsapp/test` (WhatsApp) → conversation `66900000002`,
  `channel: "whatsapp"`.
- Simulated Gmail message → conversation `debug-thread-001`,
  `channel: "email"`, case `CASE-...` with `channel: "email"`.
- `GET /api/dashboard/conversations` then returned **both** entries
  together, each with `channel`, `conversationId` (the email one keyed by
  Gmail's `threadId`), `customerName`, `messageCount`, `lastMessage`
  (including `channel`/`subject`/`text`), and `intent` — matching the shape
  requested in the task.
- `GET /api/dashboard/overview` showed `conversations: 2`, `cases: 1`.
- `GET /api/dashboard/cases` showed the email case with `channel: "email"`.
- Restarted once more with the debug route removed and confirmed a clean
  boot: server + Pub/Sub listener start together, and
  `/api/dashboard/conversations` / `/overview` return empty collections
  (`[]` / all-zero counts) rather than crashing, for a fresh process with no
  messages yet.

No changes were made to AI or business logic, per the task's instruction —
this was purely a process-topology/storage-visibility fix.

## Summary

Refactored the WhatsApp and Gmail integrations onto a single, channel-agnostic
pipeline. WhatsApp and Gmail now differ only at the ingestion/adapter layer
(webhook parsing and normalization); everything after normalization — storage,
buffering, AI analysis, business logic, action execution, case/handoff
creation, and dashboard data — runs through the exact same shared code for
both channels, identified by `conversationId` + `channel` instead of `waId`.

This also fixes the reported crash: `GET /api/dashboard/conversations` was
throwing `Cannot read properties of undefined (reading 'length')` because
`conversation.service.ts` stored each conversation as a bare
`ConversationMessage[]` array while `router.service.ts` already expected a
`{ channel, messages }` object. The two were never reconciled. Storage now
matches what the router expects, so the collection is never `undefined` and
`.messages` is always a real array.

## Files changed

### `src/services/conversation.service.ts` — rewritten
Root cause of the crash. Storage changed from
`Map<string, ConversationMessage[]>` to
`Map<string, ConversationRecord>`, where `ConversationRecord` carries
`conversationId`, `channel`, `customerName`, `messages[]`, `updatedAt`.
`addConversationMessage` now takes `(conversationId, channel, message,
customerName?)`, creates the record if missing (so a lookup can never return
`undefined`), and **returns `false` if a message with the same `id` already
exists** — this is the idempotency guarantee used by both channels. All other
functions (`getConversationHistory`, `setConversationAnalysis`,
`getConversationAnalysis`, `clearConversation`, `getAllConversations`) were
updated to the new shape; `getAllConversations()` now returns the
`{channel, messages}`-shaped records `router.service.ts` was already written
to expect.

### `src/services/conversation.buffer.service.ts` — rewritten
Was WhatsApp-only (`CustomerInfo` with `wa_id`). Now takes a channel-agnostic
`ConversationIdentity { conversationId, channel, customerName }`, keeps one
debounce buffer per `conversationId` (still 2000ms, same version-based
stale-result discarding as before), and — this is the important part — both
Gmail and WhatsApp now go through the **same buffering/grouping step**. Gmail
previously bypassed buffering entirely and processed every message
immediately with `conversationHistory: []` hardcoded (a "temporary" gap left
in the original code); it now gets real conversation history and message
grouping like WhatsApp. Also removed a duplicated `setConversationAnalysis`
call that existed in the original code.

### `src/services/action-executor.service.ts` — edited
Fixed a real bug: the `CREATE_CASE` branch hardcoded `channel: "whatsapp"`
when calling `createServiceCase`, regardless of the real source channel — so
any case created from Gmail (once wired up) would have been mislabeled as
WhatsApp. `customer` is now `{ conversationId, channel, name }` and both
`createServiceCase` and `createHumanHandoff` receive the real channel.

### `src/services/human-handoff.service.ts` — edited
Was WhatsApp-only (`waId` as the sole identity field), inconsistent with
`case.service.ts` which already had the correct pattern. `HumanHandoff` now
has `conversationId` + `channel` as canonical identity, with `waId` kept only
as a derived, nullable field (`channel === "whatsapp" ? conversationId :
null`) for backward compatibility. `createHumanHandoff` signature updated to
`(conversationId, channel, customerName, analysis)`.

### `src/services/case.service.ts` — unchanged
Already implemented the target `conversationId` + `channel` pattern
correctly; used as the template for the two files above.

### `src/services/business-logic.service.ts`, `src/services/response.service.ts` — unchanged
Already fully channel-agnostic (operate only on `AIAnalysis`); no changes
needed.

### `src/services/ai.service.ts` — unchanged
Already accepted `channel`/`subject` and prompted the model to support both
channels; no changes needed.

### `src/services/pipeline.service.ts` — new file
The single shared pipeline entry point requested by the task:
`ingestNormalizedMessage(normalized: NormalizedMessage, options)`. Given a
`NormalizedMessage` from either adapter, it stores the message (idempotently),
then hands off to the buffer service, which — once the debounce window
elapses — runs AI analysis, business logic, action execution, and
case/handoff/response creation. Both `routes/whatsapp.ts` and
`gmail/processor.ts` now call only this one function after normalizing.

### `src/whatsapp/normalizer.ts` — new file
WhatsApp-side adapter mirroring the existing `gmail/normalizer.ts`:
`normalizeWhatsAppMessage(input) -> NormalizedMessage`. WhatsApp previously
had no normalizer at all and built its `ConversationMessage` inline in the
route handler in three separate places.

### `src/routes/whatsapp.ts` — rewritten
Webhook verification (`GET /`) is untouched. `POST /` (real webhook) and
`POST /test` now: parse the WhatsApp-specific payload → call
`normalizeWhatsAppMessage` → call `ingestNormalizedMessage`. This removes the
inline, duplicated `ConversationMessage` construction and channel-tagging
that previously existed in three places in this file. `POST /test/clear`
is unchanged (still clears by `wa_id`, which is also the `conversationId`
for WhatsApp).

### `src/gmail/processor.ts` — edited
OAuth/token loading, incremental History API paging, `historyId`-based
idempotent state tracking (`gmail-state.json`), MIME body extraction
(`findBody`/`htmlToText`), and spam/newsletter filtering
(`shouldIgnoreEmail`) are all **unchanged** — these are the "working
integration" pieces the task said to preserve. What changed: after building
`normalizedMessage` (still via the existing `normalizeGmailMessage`), the
~110 lines that manually reimplemented conversation storage, AI analysis
(with hardcoded empty history), business logic, and case creation — while
never handling handoff or response — were replaced with a single call to
`ingestNormalizedMessage(normalizedMessage, { customerName: ... })`, the same
call the WhatsApp route makes. Gmail now gets full conversation history,
message buffering, and the complete action set (case creation, human
handoff, and response generation), none of which it had before.

Also fixed a latent, pre-existing bug in this file unrelated to the
architecture change: a local `const getHeader = (name) => ...` shadowed the
module-level `getHeader(headers, name)` function within the same block, and
was referenced (as the 2-argument form, resolving to the shadowing local
due to block scoping) before its own declaration — a `ReferenceError` at
runtime on the code path that logs an ignored/filtered email. Removed the
redundant local and pointed all call sites at the single module-level
`getHeader(headers, name)`.

### `src/services/router.service.ts` — edited
This file already assumed the target `{channel, messages}` per-conversation
shape (evidence the intended architecture was designed but never finished).
`getDashboardOverview()` was actually iterating the *old* flat-array shape
correctly, so it broke under the *new* record shape — fixed to read
`conversation.messages.length`. `getDashboardConversations()` and
`getDashboardConversation()` needed no shape changes (they already matched
the fixed storage), but both now also surface `customerName`, and the single-
conversation lookup also returns the latest AI analysis fields (intent,
summary, status) for parity with the list endpoint.

### `src/routes/dashboard.ts` — edited
Route param renamed `/conversations/:waId` → `/conversations/:conversationId`
(query works identically for both channels since the underlying map is keyed
by `conversationId`). Added a 404 response when the conversation doesn't
exist, instead of always returning HTTP 200 with `data: null`.

### `src/types/index.ts` — edited
This file's `ServiceCase`/`HumanHandoff`/`ConversationSummary` types were
stale, `waId`-only, and structurally incompatible with the real types now
used by `case.service.ts` and `human-handoff.service.ts` (confirmed unused
anywhere else in `src/` — dead but conflicting types). Updated them to the
same `conversationId` + `channel` (+ nullable derived `waId`) shape for
consistency.

### `src/types/communication.ts` — unchanged
Already correctly defined `Channel` and `NormalizedMessage`; this was the
target shape both adapters now produce.

### `src/server.ts`, `src/gmail/watch.ts`, `src/gmail/setup.ts`, `src/gmail/test-*.ts` — unchanged
`server.ts` only mounts the WhatsApp webhook and dashboard routes — it never
mounted an HTTP endpoint for Gmail. That's expected: Gmail push notifications
are consumed by the standalone `gmail/test-pubsub.ts` listener process (run
via `npm run gmail:pubsub`, and alongside the server via `npm run dev`,
which runs `tsx watch src/server.ts` and `tsx src/gmail/test-pubsub.ts`
concurrently). That listener calls `processGmailHistory()` in
`gmail/processor.ts` directly — the file that was rewired above. No changes
were needed here; this confirms the existing Gmail Pub/Sub integration is
preserved as-is.

## Verification performed

- `npx tsc --noEmit` — after excluding a pre-existing, project-wide
  `verbatimModuleSyntax`/`package.json "type"` mismatch (present in every
  file, including ones untouched by this refactor, e.g. `server.ts`,
  `gmail/watch.ts`) and a pre-existing `googleapis` type-overload mismatch on
  `gmail.users.history.list(...)` (also untouched by this refactor, and
  present identically in the unmodified `gmail/test-history.ts`), the files
  changed in this refactor introduce **zero new type errors**.
- Started the server (`tsx src/server.ts`) and sent a real WhatsApp test
  message through `POST /webhook/whatsapp/test` end-to-end (normalize →
  store → buffer → Groq AI analysis → business logic → action executor →
  case creation). Confirmed via `GET /api/dashboard/overview`,
  `/conversations`, `/cases`, `/handoffs`, and `/conversations/:conversationId`
  that all four dashboard endpoints return correct data with no crash and
  `channel: "whatsapp"` present throughout.
- Ran a second, in-process check driving a synthetic Gmail-shaped message
  through `normalizeGmailMessage` → `ingestNormalizedMessage` (the exact
  functions `gmail/processor.ts` now calls, without touching real Gmail
  OAuth/inbox state) and confirmed: the resulting case carries
  `channel: "email"` (not the previously hardcoded `"whatsapp"`), `waId:
  null`, and the same dashboard functions return it correctly alongside
  WhatsApp conversations.
- Verified idempotency: re-ingesting a message with the same `messageId`
  is rejected (`ingestNormalizedMessage` returns `null`, message count
  unchanged) rather than reprocessed or duplicated.
- Verified the `HANDOFF_TO_HUMAN` path for the email channel produces a
  `HumanHandoff` record with the correct `conversationId`/`channel`.

## What was intentionally left alone

- WhatsApp webhook verification handshake, and the raw payload shape Meta
  sends/expects.
- Gmail OAuth (`gmail/setup.ts`), the standalone Pub/Sub listener
  (`gmail/test-pubsub.ts`), and the Pub/Sub watch registration
  (`gmail/watch.ts`) — none of these needed changes, and the task said not to
  rewrite working integrations unnecessarily.
- `historyId`-based Gmail state/idempotency (`gmail-state.json`) — untouched.
- Outbound message delivery: neither channel actually sends anything back to
  the customer today (responses are generated by `response.service.ts` but
  only logged) — this was true before the refactor and is out of scope for
  it; no delivery mechanism was added or removed.
