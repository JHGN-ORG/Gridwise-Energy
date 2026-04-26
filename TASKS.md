GridDaddy — Task Board

Drop your name in Owner when you grab one. Move between sections by editing this message.

---

BACKLOG

P0 — Kill the fake data 
- [ ] #8 Pick canonical brand name (GridWise vs GridDaddy) — touches title, AppShell, AuthPage, Onboarding, OG tags, README. Owner: —
- [ ] #3 Insights "Nuclear contribution" card is hardcoded (48% / 28% / 15% / 5%) — derive from live grid breakdown. Owner: —
- [ ] #4 Stop seeding 14 days of fake check-ins at onboarding (or hide behind explicit "Try with sample data" toggle). Owner: —
- [ ] #5 Optimal-time math uses static curve even when live grid is available — pass real intensity into buildCheckIn. Owner: —
- [ ] #2 /forecast recommendations are hardcoded strings — wire up the unused buildRecommendations() in intensity.ts. Owner: —
- [ ] #1 Replace static HOURLY_INTENSITY with real forecast from Electricity Maps /carbon-intensity/forecast. Owner: —

P1 — Branding / metadata cleanup (JMV)
- [ ] #6 Remove Lovable OG image + @Lovable Twitter handle from index.html. Owner: —
- [ ] #7 Rewrite README.md (currently the Lovable template stub). Owner: —
- [ ] #9 Replace default favicon, delete public/placeholder.svg. Owner: —
- [ ] #10 Add PWA manifest, apple-touch-icon, real OG image. Owner: —

P1 — Auth & API hardening
- [ ] #11 Move Auth0 domain + clientId to env vars (currently hardcoded in main.tsx). Owner: —
- [ ] #12 Build-time guard if VITE_AUTH0_AUDIENCE is missing (silent 401s today). Owner: —
- [ ] #13 Handle 401 in apiFetch — trigger re-auth instead of throwing. Owner: —
- [ ] #14 Decide on /forecast and / auth posture — make consistent with RequireAuth pattern. Owner: —
- [ ] #16 Lock down /api/grid-intensity — require auth + cache by zone (5–15 min). Owner: —
- [ ] #17 Cache geocoding — Nominatim has a 1 req/sec TOS; hardcode the 5 AZ cities or store lat/lon. Owner: —

🤖 AI/ML Track (hackathon hero features — Track 01: AI for Sustainability)
- [ ] AI-1 "Grid Coach" chat — Anthropic Claude over user profile + recent check-ins + 24h forecast (with prompt caching). New /api/coach route + chat UI on Dashboard. Owner: —
- [ ] AI-2 Real carbon-intensity forecast model — train on Electricity Maps history (60d hourly) for user's zone, predict next 48h. Replaces hardcoded HOURLY_INTENSITY (kills tasks #1, #5). Serve from /api/forecast, refresh nightly via Vercel cron. Report MAE on held-out set. Owner: —
- [ ] AI-3 Personalized shift recommender — combines AI-2 forecast with the user's own check-in history to suggest specific appliance shifts ("HVAC 17:00 → 14:00, save 2.4 lbs"). Persist suggestions, track lbs-saved per user. Owner: —
- [ ] AI-4 Anomaly detection on user check-ins — flag days where user's emissions spike vs their own rolling baseline (z-score). Inline insight card with likely cause from check-in usages. Owner: —
- [ ] AI-5 Aggregate demand-response simulator — landing/marketing page: "If N users shifted EV charging to nuclear hours, we'd displace X MWh of gas peakers, Y tons CO₂/yr." Uses EIA/Electricity Maps real numbers. Sells scalability story. Owner: —
- [ ] AI-6 Real Palo Verde / nuclear share — replace the hardcoded 48% in InsightsPage with actual zone breakdown. When a user's "saved lbs" land in nuclear-dominant hours, attribute them. Owner: —

P2 — Cleanup & quality
- [ ] #15 Drop unused _userId arg from all repo.ts functions and callers. Owner: —
- [ ] #18 Real migration story instead of ensureSchema() running DDL on every cold start. Owner: —
- [ ] #19 Tighten Postgres NUMERIC typing (currently strings deserialized via Number()). Owner: —
- [ ] #20–24 Delete dead code: Recommendations.tsx, buildRecommendations, NavLink.tsx, example.test.ts, supabase/ folder. Owner: —
- [ ] #25 Drop the radix Toaster — keep sonner only; remove use-toast.ts + ui/toaster.tsx. Owner: —
- [ ] #26 Unit tests for gridwise.ts math (lbsForRun, optimalWindow, buildCheckIn, streakCount). Owner: —
- [ ] #27 Convert ad-hoc useEffect fetches to react-query (already installed, never used). Owner: —
- [ ] #28 Remove as any casts in DashboardPage. Owner: —
- [ ] #29 Fix the eslint-disable in DashboardPage useEffect instead of suppressing. Owner: —

---

IN PROGRESS
(Move tasks here when you start. Add 🤖 if Claude is working on it.)

---

DONE
- [x] Auth0 + Vercel cutover
- [x] Postgres connected, schema auto-creates
- [x] /api/profile, /api/check-ins, /api/grid-intensity live

---

Conventions
- Branch name: claude/<task-id>-<slug> (e.g. claude/8-rename-griddaddy)
- One task = one PR. Don't bundle.
- Update this message when you grab/finish a task.
