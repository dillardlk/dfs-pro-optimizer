begin;

create table if not exists public.optimizer_presets (
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  profile jsonb not null check (
    jsonb_typeof(profile) = 'object'
    and profile @> '{"version":1}'::jsonb
    and profile ? 'name'
    and jsonb_typeof(profile->'name') = 'string'
    and profile->>'name' = name
    and octet_length(profile::text) <= 300000
  ),
  updated_at timestamptz not null default now(),
  primary key (user_id, name)
);

alter table public.optimizer_presets enable row level security;
revoke all on public.optimizer_presets from public;
revoke all on public.optimizer_presets from anon;
grant usage on schema public to authenticated;
revoke all on public.optimizer_presets from authenticated;
grant select, insert, update, delete on public.optimizer_presets to authenticated;

create policy "Read own optimizer presets" on public.optimizer_presets
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Insert own optimizer presets" on public.optimizer_presets
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own optimizer presets" on public.optimizer_presets
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Delete own optimizer presets" on public.optimizer_presets
  for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function public.check_optimizer_preset()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  -- Serialize saves per account so concurrent devices cannot bypass the limit.
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
  if tg_op = 'INSERT' and not exists (
    select 1 from public.optimizer_presets where user_id = new.user_id and name = new.name
  ) and (select count(*) from public.optimizer_presets where user_id = new.user_id) >= 20 then
    raise exception 'You can save up to 20 account presets. Delete one first.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.check_optimizer_preset() from public;
create trigger check_optimizer_preset before insert or update on public.optimizer_presets
  for each row execute function public.check_optimizer_preset();

commit;
