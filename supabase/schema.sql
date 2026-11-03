-- ============================================================
-- SILID online — Supabase schema
-- Paste this whole file into: Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================

-- ------------------------------------------------------------
-- 1. PROFILES — one row per account, created automatically on signup
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique not null,
  created_at timestamptz not null default now()
);

-- auto-create a profile + default username when a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', 'batang_' || substr(new.id::text, 1, 8)))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger if not exists on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ------------------------------------------------------------
-- 2. CLOUD SAVES — one autosave slot per account
-- ------------------------------------------------------------
create table if not exists public.cloud_saves (
  user_id uuid primary key references auth.users on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 3. WHISPERS — anonymous messages players leave in each other's houses
--    (house_code shuffles weekly so the walls never run out of strangers)
-- ------------------------------------------------------------
create table if not exists public.whispers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete set null, -- set null = "a stranger, gone now"
  username text not null default 'ibon',                  -- author shown in-game
  house_code text not null,                               -- weekly house bucket
  body text not null check (char_length(body) between 1 and 120),
  hint text not null default 'sala',                      -- room the whisper is tied to
  upvotes int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists whispers_house_idx on public.whispers (house_code);
create index if not exists whispers_user_idx on public.whispers (user_id);

-- one whisper per player per house per room (they can overwrite by deleting first)
create unique index if not exists whispers_user_house_hint_idx
  on public.whispers (coalesce(user_id::text, id::text), house_code, hint);

-- ------------------------------------------------------------
-- 4. FRIENDS — two rows per friendship (a→b and b→a)
-- ------------------------------------------------------------
create table if not exists public.friends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  friend_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, friend_id)
);
create index if not exists friends_user_idx on public.friends (user_id);

-- ------------------------------------------------------------
-- 5. ENDINGS LEDGER — which endings each account has reached (per profile)
-- ------------------------------------------------------------
create table if not exists public.endings (
  user_id uuid not null references auth.users on delete cascade,
  ending text not null,                                   -- 'A' | 'B' | 'C' | 'D'
  reached_at timestamptz not null default now(),
  primary key (user_id, ending)
);

-- ------------------------------------------------------------
-- 6. CO-OP SESSIONS — Supabase Realtime channels broadcast presence;
--    the DB only stores a discoverable roster so friends can find the room
-- ------------------------------------------------------------
create table if not exists public.coop_sessions (
  code text primary key,                                  -- 5-letter room code, e.g. KGXQT
  host_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  last_active timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY — the only thing standing between players and each other
-- ============================================================
alter table public.profiles      enable row level security;
alter table public.cloud_saves   enable row level security;
alter table public.whispers      enable row level security;
alter table public.friends       enable row level security;
alter table public.endings       enable row level security;
alter table public.coop_sessions enable row level security;

-- profiles: read anyone (friend search), change only your own
create policy "profiles are readable" on public.profiles
  for select using (true);
create policy "own profile update" on public.profiles
  for update using (auth.uid() = id);

-- cloud saves: strictly private per user
create policy "own save read" on public.cloud_saves
  for select using (auth.uid() = user_id);
create policy "own save write" on public.cloud_saves
  for insert with check (auth.uid() = user_id);
create policy "own save update" on public.cloud_saves
  for update using (auth.uid() = user_id);

-- whispers: signed-in players read and write; authors may delete their own
create policy "whispers readable" on public.whispers
  for select using (auth.role() = 'authenticated');
create policy "whispers insertable" on public.whispers
  for insert with check (auth.uid() = user_id);
create policy "own whisper delete" on public.whispers
  for delete using (auth.uid() = user_id);

-- friends: you may read rows that involve you, and create/delete rows where you are the owner side
create policy "friend rows visible" on public.friends
  for select using (auth.uid() = user_id or auth.uid() = friend_id);
create policy "friend rows insertable" on public.friends
  for insert with check (auth.uid() = user_id);
create policy "friend rows deletable" on public.friends
  for delete using (auth.uid() = user_id);

-- endings: write your own, read everyone's (for the friends view)
create policy "endings readable" on public.endings
  for select using (true);
create policy "own endings write" on public.endings
  for insert with check (auth.uid() = user_id);
create policy "own endings update" on public.endings
  for update using (auth.uid() = user_id);

-- co-op sessions: anyone signed in may read (to find a friend's room);
-- only the host may create, refresh or delete their session row
create policy "sessions readable" on public.coop_sessions
  for select using (auth.role() = 'authenticated');
create policy "own session write" on public.coop_sessions
  for insert with check (auth.uid() = host_id);
create policy "own session update" on public.coop_sessions
  for update using (auth.uid() = host_id);
create policy "own session delete" on public.coop_sessions
  for delete using (auth.uid() = host_id);

-- ============================================================
-- REALTIME — co-op position/presence is broadcast on channels, but the
-- postgres_changes stream for whispers must be switched on per table.
-- ============================================================
alter table public.whispers      replica identity full;
alter publication supabase_realtime add table public.whispers;
alter table public.coop_sessions replica identity full;
alter publication supabase_realtime add table public.coop_sessions;
