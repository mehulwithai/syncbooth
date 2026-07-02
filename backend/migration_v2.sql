-- Run this in Supabase SQL editor ONLY IF you already ran the old schema.sql before.
-- (If this is a brand new project, just run schema.sql instead — skip this file.)

alter table captures add column if not exists round int not null default 1;
alter table captures add constraint captures_round_check check (round between 1 and 4);

-- old strips table had slot1_url/slot2_url; new one stores all 4 rounds as jsonb
drop table if exists strips cascade;

create table strips (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms(id) on delete cascade,
  rounds jsonb not null, -- array of {round, slot1_url, slot2_url}
  created_at timestamptz default now()
);
