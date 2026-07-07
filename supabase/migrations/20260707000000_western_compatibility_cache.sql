-- Western sign-pair compatibility cache
-- One-time seed target: 144 rows (12 x 12 ordered pairs), never grows beyond that.

create table if not exists western_compatibility_cache (
  sign_a text not null,
  sign_b text not null,
  compatibility_percentage numeric not null,       -- raw value from zodiac_compatibility, 0-100
  compatibility_score_45 numeric not null,          -- percentage scaled to your 45-point slot
  compatibility_report text,                        -- raw text report, optional, for future use
  created_at timestamptz not null default now(),
  primary key (sign_a, sign_b)
);

comment on table western_compatibility_cache is
  'One-time precomputed cache of all 144 Western zodiac sign-pair compatibility scores. Never call zodiac_compatibility at request time — read from this table only.';

-- Static lookup data with no user-specific column, same shape as the legacy
-- western_zodiac_compatibility table — mirroring its RLS treatment (enabled,
-- read-only for authenticated users) for consistency with every other table
-- in this schema.
alter table western_compatibility_cache enable row level security;

drop policy if exists "Authenticated users can read western compatibility cache" on western_compatibility_cache;
create policy "Authenticated users can read western compatibility cache"
  on western_compatibility_cache
  for select
  using (auth.role() = 'authenticated');
