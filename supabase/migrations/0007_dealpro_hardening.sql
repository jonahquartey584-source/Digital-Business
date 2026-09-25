-- Deal Pro hardening. Run after 0006_dealpro.sql.
--
-- 1. The credit ledger becomes server-only. Users can still read their own
--    usage (RLS select policy from 0006), but only the service role can
--    write, through dealpro_spend_credits(), which checks the balance and
--    records the spend in one transaction under a per-user lock. This
--    closes the race where several AI requests fired at once could all
--    pass a balance check before any of them was recorded.
-- 2. pack.final (the paid "final pack" flag) and ai_researched_at can only
--    be changed by the service role, so they can't be set for free by
--    writing to the table directly with the public anon key.

drop policy if exists "Owner can record own credit usage" on public.dealpro_credit_usage;

create or replace function public.dealpro_spend_credits(
  p_user uuid,
  p_deal uuid,
  p_action text,
  p_credits integer,
  p_allowance integer -- null = unlimited (admin accounts)
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_used integer;
  v_id uuid;
begin
  -- Serialise spends per user for the rest of this transaction.
  perform pg_advisory_xact_lock(hashtext('dealpro_credits:' || p_user::text));

  if p_allowance is not null then
    select coalesce(sum(credits), 0) into v_used
      from public.dealpro_credit_usage
      where owner_id = p_user
        and created_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc';
    if v_used + p_credits > p_allowance then
      raise exception 'insufficient_credits' using errcode = 'P0001';
    end if;
  end if;

  insert into public.dealpro_credit_usage (owner_id, deal_id, action, credits)
    values (p_user, p_deal, p_action, p_credits)
    returning id into v_id;
  return v_id;
end;
$$;

-- Refund a reservation when the AI task it paid for failed.
create or replace function public.dealpro_refund_credits(p_id uuid)
returns void
language sql
security definer set search_path = public
as $$
  delete from public.dealpro_credit_usage where id = p_id;
$$;

revoke all on function public.dealpro_spend_credits(uuid, uuid, text, integer, integer) from public, anon, authenticated;
revoke all on function public.dealpro_refund_credits(uuid) from public, anon, authenticated;
grant execute on function public.dealpro_spend_credits(uuid, uuid, text, integer, integer) to service_role;
grant execute on function public.dealpro_refund_credits(uuid) to service_role;

-- ---------------------------------------------------------------------------
create or replace function public.dealpro_protect_paid_fields()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    new.ai_researched_at := old.ai_researched_at;
    new.pack := jsonb_set(
      coalesce(new.pack, '{}'::jsonb),
      '{final}',
      coalesce(old.pack -> 'final', 'false'::jsonb)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists dealpro_protect_paid_fields on public.dealpro_deals;
create trigger dealpro_protect_paid_fields before update on public.dealpro_deals
  for each row execute procedure public.dealpro_protect_paid_fields();
