# SILID Online — Supabase setup (10 minutes, free tier)

SILID's online features (accounts, cloud saves, ghost whispers, friends, co-op)
run on a [Supabase](https://supabase.com) project. Everything degrades
gracefully: with no keys configured, the game stays fully playable offline and
the online UI is simply hidden.

## 1. Create the project

1. Go to https://supabase.com → **Start your project** → sign up (GitHub is easiest).
2. **New project** → pick any name (e.g. `silid`), set a database password
   (you won't need it again), choose the region closest to your players.
3. Wait ~2 minutes for provisioning.

## 2. Run the schema

1. In the dashboard sidebar: **SQL Editor** → **New query**.
2. Open `supabase/schema.sql` from this repo, copy **the whole file**, paste,
   press **Run**. You should see `Success. No rows returned`.
3. That created 6 tables with Row Level Security, a signup trigger for
   profiles, and realtime for whispers + sessions.

## 3. Enable email sign-in

1. Sidebar: **Authentication → Providers → Email** → make sure it's enabled
   ("Confirm email" ON is recommended — it stops bot signups; turn it off for
   local testing so you can log in immediately).
2. While you're there: **Authentication → URL Configuration → Site URL** —
   set it to `http://localhost:5199` for dev (add your deployed URL later).
3. **Authentication → Rate Limits**: leave defaults; they're fine.

## 4. Get your keys

Sidebar: **Project Settings → API**. Copy:

- **Project URL** — e.g. `https://abcdabcd.supabase.co`
- **anon public key** — the long `eyJ...` string (this key is safe to ship to
  browsers; RLS is the real security boundary)

## 5. Put them in `.env`

Create a file named `.env` in the repo root (same folder as `package.json`):

```
VITE_SUPABASE_URL=https://abcdabcd.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...your-long-key...
```

Restart `npm run dev` after creating it (Vite only reads `.env` at startup).

## 6. Verify

Run the game. In the main menu you should now see:

- **ACCOUNT** — opens sign in / sign up
- **KAIBIGAN — FRIENDS** (visible when signed in)
- **KASAMA — CO-OP** — host a room, share the 5-letter code

Try: sign up → host a co-op room → open a second browser window → sign in →
join with the code. You should see each other move.

## Troubleshooting

| Symptom | Fix |
|---|---|
| No ACCOUNT button at all | `.env` missing or wrong — check the console for `SILID net: missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY` |
| "Invalid API key" in console | You copied the `service_role` key instead of the `anon` key — use **anon public** |
| Email confirmation loops | Auth → Providers → Email → turn "Confirm email" OFF while testing |
| Realtime errors about `supabase_realtime` | Re-run the last block of `schema.sql` (the `alter publication` lines) |
| Whispers never appear | They only spawn in other people's houses — and your own re-roll once per week. Visit a friend's co-op house. |

## Cost

Free tier covers this comfortably: 500 MB database, 50k monthly active users,
200k realtime messages/month, 5 GB egress. A horror game with async whispers
and 2-player co-op will not get close to the limits for a long while.
