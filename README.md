# SyncBooth — Photobooth for Long Distance Couples

## Setup

### 1. Supabase
1. Create a new Supabase project.
2. Go to SQL Editor:
   - **Fresh project?** Run `backend/schema.sql`.
   - **Already ran the old schema.sql before?** Run `backend/migration_v2.sql` instead — it upgrades your existing tables to support the 4-shot strip.
3. Go to Storage → New bucket → name it `captures` → make it **public**.
4. Copy your Project URL and `service_role` key (Settings → API).

### 2. Backend
```
cd backend
cp .env.example .env
# fill in SUPABASE_URL and SUPABASE_SERVICE_KEY in .env
npm install
npm run dev
```
Runs on http://localhost:8000

### 3. Frontend
```
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```
Runs on http://localhost:3000

## How it works
- One person clicks "Start a session" → gets a 6-char room code.
- Shares the code/link with their partner.
- Both join → each gets assigned slot 1 or 2.
- Either person clicks "Ready" → once BOTH are ready, the server kicks off
  **round 1 of 4**, broadcasting a `targetTime` (server clock timestamp
  3s in the future).
- Each client estimates its offset from server time (round-trip ping),
  then schedules a local `setTimeout` to fire the capture at the exact
  same real-world instant.
- After both photos for a round land, the server auto-advances to the
  next round (with a short breather) — no extra clicks needed — until
  all 4 rounds are done.
- The server then assembles all 4 pairs into a `strips` row and both
  clients render the final strip: a dark card with 4 rows of paired
  photos, a decorative doodle overlay, the date, and a wordmark —
  matching the Angie-style layout.
- The download button composites everything into one real PNG
  client-side via canvas (`lib/composeStrip.js`), so what downloads
  matches what's on screen.

## Deploy later (same pattern as ContractAI)
- Backend → Render (Node web service, needs to support WebSockets — Render does)
- Frontend → Vercel
- Update `FRONTEND_URL` in backend `.env` and `NEXT_PUBLIC_BACKEND_URL` in frontend `.env.local` to the deployed URLs.

## Known gaps / next steps
- No room expiry cleanup job yet (rooms table has `expires_at` column ready for it).
- No auth — anyone with the code can join (fine for MVP/personal use).
- iOS Safari camera permissions can be finicky — test on her phone specifically.
- If a participant disconnects mid-session (round 2/3/4), the flow doesn't
  currently resume gracefully — it'll wait for their capture indefinitely.
  Fine for a controlled "test with your gf" use case; worth hardening
  before wider release.
