-- Adds profiles.email, kept in sync with auth.users, so account lookups by
-- email (lib/auth-provisioning.ts — used when someone pays without an
-- existing account) are a fast indexed query through the normal admin
-- client, instead of paging through every auth user via the GoTrue admin
-- API (which has no server-side email filter).

alter table public.profiles add column if not exists email text;

create unique index if not exists profiles_email_idx
  on public.profiles (email)
  where email is not null;

-- Backfill any existing rows (direct auth.users read — fine here since
-- migrations run with full Postgres access, unlike the app's runtime
-- queries which go through PostgREST/GoTrue and can't reach auth.users).
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id
  and p.email is null;

-- Keep it populated for every future signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, company_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'company_name'
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;
