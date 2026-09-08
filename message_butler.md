# Message Monitor — Implementation Log

Project-level implementation log (frontend + full-stack tasks). Earlier
backend implementation history (the unified WhatsApp+Gmail pipeline
refactor, the Gmail Pub/Sub process-isolation fix) lives in
`backend/message_butler.md` — not duplicated here.

---

## 2026-09-08 — Frontend UI/UX Redesign: Operations Command Center Layout

### UI redesign completed

Redesigned the dashboard's **layout and information density**, not its
information architecture — the page structure built previously (Overview /
Inbox / Cases / Handoffs / Activity, unified conversation drawer,
channel-agnostic components) was already correct per the brief's own
"reuse components where appropriate, but redesign them if the current
structure prevents good UX" and was kept. What changed is how that
structure uses the viewport:

- **App shell now has a real scroll architecture.** Previously `.app` was
  `min-height: 100vh` with no height constraint on `.main`/`.content`, so
  the whole page grew taller than the viewport and the **browser window**
  scrolled — the sidebar and topbar scrolled away with everything else
  instead of staying in place. Now `.app`/`.sidebar`/`.main` are all
  height-constrained to the viewport (`height: 100vh` / `100%`), and
  `.content` is the one region that scrolls (`flex: 1; min-height: 0;
  overflow-y: auto`). Sidebar and topbar now stay fixed while content
  scrolls independently, exactly per the brief's
  `Viewport → App shell → Sidebar / Main → Header / Scrollable content`
  diagram.
- **Dense list pages (Inbox, Cases, Handoffs, Activity) get their own
  internal scroll region.** New `.page-panel` treatment: the page's single
  panel fills the remaining viewport height, its header/filter bar stays
  pinned, and only the list body (`.inbox-list` / `.record-list` /
  `.activity-feed`) scrolls — so a long conversation/case/activity list
  scrolls in place rather than pushing the whole page down.
- **Overview restructured into the brief's suggested 3-column main
  operational area**: Recent conversations | Open cases | System health,
  side by side, instead of System Health as its own full-width block above
  a 2-column Activity/Conversations row. Added a compact "Open cases"
  mini-list (new, using the existing `/api/dashboard/cases` data already
  in the page's props — no new endpoint) so an operator sees open cases
  without leaving Overview. Activity stays as its own full-width
  chronological section below the 3-column grid, both because it reads
  better top-to-bottom uninterrupted and because it's the natural spot for
  a future conversation-volume chart alongside it without touching the
  3-column grid above (no chart added — none of the current data
  justifies one yet, per "do not add meaningless charts").
- **Density pass**: KPI cards, panel padding, and list-row padding all
  tightened (e.g. KPI card padding 20px→12/16px, value font 26px→20px,
  panel padding 24px→16px, list-row padding correspondingly reduced). KPI
  grid changed from a fixed 4-column layout to `repeat(auto-fit,
  minmax(160px, 1fr))` so it naturally uses more columns on a wide desktop
  monitor instead of leaving the row half-empty or wrapping awkwardly.
  `.content`'s max-width raised from 1280px to 2000px so wide desktop
  screens are actually used, rather than leaving large empty side margins.

### Scrolling/layout improvements

- Root cause of "doesn't scroll well": no explicit height on `.app`
  (`min-height` only) meant no element ever established a bounded height
  for a child to size a scroll container against. Fixed at the source
  (`.app`/`.main` given real `height`), not patched with `overflow-y:auto`
  sprinkled onto whatever happened to overflow.
- Avoided `overflow: hidden` on any container that holds real content —
  it's only used on `.app`/`.main` (the outer shells, which have their own
  properly-scrolling children) and `.panel-flush` (a cosmetic corner-radius
  clip, unrelated to content overflow).
- Long message/email text: unchanged, already handled (`.bubble p` /
  `.inbox-row-message` already had `white-space: pre-wrap` /
  `text-overflow: ellipsis` + full text visible in the drawer) — verified
  still correct, not regressed by the layout changes.

### Dashboard visualization readiness

No charts added (none of the current data volume — 11 conversations, 3
cases — would make one more useful than the list it's next to; the brief
explicitly says not to add decorative ones). The layout is structured so
one can be added later without a redesign: the 3-column Overview grid and
the full-width Activity section are both independent panels in a CSS grid/
flex layout, so a new panel (e.g. a conversation-volume sparkline) is an
additional grid item, not a restructure.

### APIs currently integrated

All six existing endpoints, unchanged contracts, all still in active use:
`GET /api/dashboard/overview`, `/conversations`, `/conversations/:id`
(now correctly passing `?channel=` — see bug fix below), `/cases`,
`/handoffs`, `/activity?limit=`, `/health`. No new endpoints added, no
existing integration removed.

**Two small, targeted fixes made alongside the redesign** (both
"a frontend requirement exposes a genuine API problem", not unrelated
backend changes):

1. **`ConversationDrawer.tsx` bug**: it called
   `getDashboardConversation(conversationId)` without the `channel`
   parameter, even though `dashboard.service.ts` already supported passing
   it and the backend route already accepts `?channel=`. Since
   `conversationId` alone isn't guaranteed unique across WhatsApp and
   email, this was a real correctness gap for exactly the kind of
   cross-channel lookup the brief's own tested example
   (`1a07ee12a723b35a?channel=email`) calls out. Fixed: the drawer now
   passes `channel` through.
2. **Backend: local Postgres connection was broken.** `pg.Pool` had no
   `ssl` option; Render's managed Postgres resets non-SSL connections from
   outside its own network, so every DB-backed endpoint
   (`overview`/`conversations`/`cases`/`handoffs`) failed with
   `ECONNRESET` when run locally (deployed-on-Render-to-Render traffic
   was unaffected, which is why this wasn't caught before). Added
   `ssl: { rejectUnauthorized: false }` to the pool config in
   `backend/src/database/index.ts` — the standard fix for connecting to
   Render Postgres from outside Render's network. This is the only
   backend change in this task; no business logic touched.

### API test results (against the real, deployed dataset)

Tested against both the local backend (after the SSL fix, same
`DATABASE_URL` as production) and the deployed
`https://message-monitor.onrender.com` directly:

- `GET /api/dashboard/overview` → `{conversations: 11, messages: 40,
  cases: 3, openCases: 3, handoffs: 0, openHandoffs: 0}` — exact match to
  the brief's tested contract, on both local and deployed.
- `GET /api/dashboard/cases` → all 3 cases returned with matching
  fields, including `CASE-1788835090093` (Jirawat Janjobtam, email,
  equipment "Justice of Toren", status OPEN) — matches exactly.
- `GET /api/dashboard/conversations/1a07ee12a723b35a?channel=email` →
  full conversation + `analysis` object returned correctly (intent,
  action, equipment, problem, request, summary, customer_position,
  pending_action, conversation_status all present).
- `GET /api/dashboard/activity?limit=6` (deployed) → returned the exact
  `gmail_received → conversation_updated → ai_analysis_completed →
  business_action_generated → case_created` sequence for
  `1a07ee12a723b35a`, matching the brief. (On the freshly-started *local*
  process this returns `[]` — the activity log is an in-memory ring
  buffer per `activity.service.ts`, not persisted to Postgres, so a new
  local process has no history until it processes something itself. Not a
  bug introduced by this task; a pre-existing architectural property,
  noted here since it's directly relevant to reproducing the validation.)
- `GET /api/dashboard/health` (deployed) → `gmail`/`ai`/`pipeline`:
  `healthy` with real `lastEventAt` timestamps, `whatsapp`: `unknown` —
  matches the brief exactly. Confirmed the UI's `StatusBadge`/health-card
  rendering treats `unknown` as its own distinct neutral state, never as
  `healthy` (see `lib/status.ts`'s status map — `unknown` and `healthy`
  have always been separate entries; verified still true, not something
  this task needed to change).

### Build / test result

- `npx tsc -b`: 0 errors.
- `npm run build`: clean —
  `dist/assets/index-*.js 227.06 kB`, `index-*.css 18.65 kB`, built in
  ~150ms.
- `npm run lint`: **0 errors, 0 warnings.** (Found 4 pre-existing
  `react-hooks` errors from an upgraded `eslint-plugin-react-hooks`
  version enforcing newer purity/set-state-in-effect rules against code
  written before this task — fixed all four using React's recommended
  patterns: `ConversationDrawer.tsx`'s redundant synchronous
  `setLoading(true)`/`setError('')` removed, since remounting via `key`
  already resets those states; `SearchInput.tsx` and `InboxPage.tsx`'s
  prop-mirroring effects replaced with the "adjust state during render"
  pattern; `InboxPage.tsx`'s `Date.now()` read during render replaced with
  a ticking `now` value in state, which also fixes a latent bug where the
  "new message" indicator never re-evaluated after its first render.)
- Dev server (`npm run dev`) started successfully; verified every changed
  module (`App.tsx`, all 5 pages, `ConversationDrawer.tsx`,
  `SearchInput.tsx`) transforms through Vite with no errors (curl against
  each module path, all 200 OK). Verified `import.meta.env.VITE_API_URL`
  correctly resolves to `http://localhost:3001` by default and to a
  deployed override when set, confirming both the "local development"
  and "deployed" base URLs from the brief actually work.

### Limitation: no interactive browser available this session

No browser automation tool is available in this environment (the
`claude-in-chrome` extension was not installed for this session) — the
redesign was **not** visually clicked through or screenshotted. Every
claim above is backed by: TypeScript's structural typing against the
exact real API response shapes (fetched live via curl and compared
field-by-field to the components consuming them), a clean production
build, a clean lint pass, and Vite successfully transforming every
changed module with no errors — not a rendered-pixel check. The CSS
scroll/height-chain logic (`.app` → `.sidebar`/`.main` → `.topbar`/
`.content` → `.page-panel` → list) was traced by hand for each page and is
standard, well-understood flexbox — but a real browser check at normal
desktop resolution and at a narrower width, as the brief's own validation
steps 10–11 ask for, is still outstanding and should be spot-checked
before considering this final.

### Remaining / next

- Visual QA in an actual browser (see limitation above) — normal desktop
  width, then a narrower desktop/tablet width, checking nothing clips and
  the internal scroll regions behave as designed.
- The Activity feed's per-process, non-persisted nature (noted above)
  means a locally-run backend instance always starts with an empty
  Activity view until it processes a message itself — worth persisting to
  Postgres in a future pass if local activity history ever needs to
  survive a restart, but out of scope for this UI task.
- No mutation endpoints exist yet for Handoffs (Assign/Take
  ownership/Resolve/Escalate) — per the brief's own instruction not to
  fake actions the backend doesn't support, none were added; the Handoffs
  page remains a clean read view ready for those actions once/if the
  backend gains them.
