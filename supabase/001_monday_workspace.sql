-- Run once in the Monday Supabase project's SQL editor.
-- Uses dedicated names so existing tables are not replaced.
begin;
create table if not exists public.monday_admins (
 user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.monday_admins enable row level security;
drop policy if exists monday_admin_self on public.monday_admins;
create policy monday_admin_self on public.monday_admins for select to authenticated using (user_id = auth.uid());
grant select on public.monday_admins to authenticated;
create table if not exists public.monday_workspaces (
 id text primary key check (id = '2026-2027'),
 state jsonb not null,
 revision bigint not null default 1,
 updated_at timestamptz not null default now()
);
alter table public.monday_workspaces enable row level security;
drop policy if exists monday_read on public.monday_workspaces;
create policy monday_read on public.monday_workspaces for select to authenticated
 using (exists (select 1 from public.monday_admins where user_id = auth.uid()));
grant select on public.monday_workspaces to authenticated;
revoke insert,update,delete on public.monday_workspaces from anon,authenticated;
create or replace function public.save_monday_workspace(p_state jsonb,p_revision bigint)
returns bigint language plpgsql security definer set search_path = public as $$
declare current_revision bigint; new_revision bigint;
begin
 if auth.uid() is null or not exists (select 1 from public.monday_admins where user_id=auth.uid()) then
  raise exception 'This account needs Monday league administrator access.';
 end if;
 if p_state is null or (p_state->>'schemaVersion') is distinct from '1'
  or (p_state->>'league') is distinct from 'Carbondale Commercial'
  or (p_state->>'season') is distinct from '2026-2027'
  or jsonb_typeof(p_state->'teams') is distinct from 'array'
  or jsonb_typeof(p_state->'bowlers') is distinct from 'array'
  or jsonb_typeof(p_state->'results') is distinct from 'array'
 then raise exception 'Invalid Monday workspace.'; end if;
 perform pg_advisory_xact_lock(202627,301);
 select revision into current_revision from public.monday_workspaces where id='2026-2027' for update;
 if coalesce(current_revision,0) is distinct from p_revision then raise exception 'Another save changed the league. Load the saved league before retrying.'; end if;
 new_revision:=coalesce(current_revision,0)+1;
 insert into public.monday_workspaces(id,state,revision) values ('2026-2027',p_state,new_revision)
 on conflict(id) do update set state=excluded.state,revision=excluded.revision,updated_at=now();
 return new_revision;
end;
$$;
revoke all on function public.save_monday_workspace(jsonb,bigint) from public,anon;
grant execute on function public.save_monday_workspace(jsonb,bigint) to authenticated;
commit;
-- After creating your account in Supabase Authentication > Users, run:
-- insert into public.monday_admins(user_id)
-- select id from auth.users where email = 'YOUR_EMAIL'
-- on conflict do nothing;
