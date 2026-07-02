-- Run this in Supabase SQL editor

create table rooms (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  status text default 'waiting', -- waiting | active | done
  created_at timestamptz default now(),
  expires_at timestamptz default (now() + interval '2 hours')
);

create table captures (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  user_slot int not null check (user_slot in (1,2)),
  round int not null default 1 check (round between 1 and 4),
  image_url text not null,
  captured_at timestamptz default now()
);

create table strips (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  rounds jsonb not null, -- array of {round, slot1_url, slot2_url}
  created_at timestamptz default now()
);

-- Storage bucket (create via Supabase dashboard or SQL):
-- Storage > New bucket > name: "captures" > public: true

-- Optional: auto-cleanup old rooms via a cron/edge function later
