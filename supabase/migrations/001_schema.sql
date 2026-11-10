-- Splitly schema (already applied to the Supabase project). Kept here for reference and re-creation.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'Member' check (char_length(btrim(name)) between 1 and 60),
  created_at timestamptz not null default now()
);
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  emoji text not null default '👥' check (char_length(emoji) <= 16),
  join_code text not null unique check (join_code ~ '^[0-9]{6}$'),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  description text not null check (char_length(btrim(description)) between 1 and 120),
  amount_paise bigint not null check (amount_paise > 0),
  paid_by uuid not null references public.profiles(id),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create table public.expense_splits (
  expense_id uuid not null references public.expenses(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  share_paise bigint not null check (share_paise >= 0),
  primary key (expense_id, user_id)
);
create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  from_user uuid not null references public.profiles(id),
  to_user uuid not null references public.profiles(id),
  amount_paise bigint not null check (amount_paise > 0),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check (from_user <> to_user)
);
create table public.join_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index on public.group_members (user_id);
create index on public.expenses (group_id, created_at desc);
create index on public.expenses (paid_by);
create index on public.expense_splits (user_id);
create index on public.settlements (group_id, created_at desc);
create index on public.join_attempts (user_id, attempted_at);

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, name) values (
    new.id,
    left(coalesce(nullif(btrim(new.raw_user_meta_data->>'full_name'), ''), nullif(btrim(new.raw_user_meta_data->>'name'), ''), nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'Member'), 60)
  ) on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
insert into public.profiles (id, name)
  select id, left(coalesce(nullif(split_part(coalesce(email, ''), '@', 1), ''), 'Member'), 60) from auth.users
  on conflict (id) do nothing;

create function public.is_group_member(gid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.group_members where group_id = gid and user_id = (select auth.uid()))
$$;
create function public.shares_group_with(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.group_members a join public.group_members b on a.group_id = b.group_id
    where a.user_id = (select auth.uid()) and b.user_id = uid)
$$;

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_splits enable row level security;
alter table public.settlements enable row level security;
alter table public.join_attempts enable row level security;

create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.shares_group_with(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy groups_select on public.groups for select to authenticated using (public.is_group_member(id));
create policy groups_update on public.groups for update to authenticated
  using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));
create policy groups_delete on public.groups for delete to authenticated using (created_by = (select auth.uid()));
create policy members_select on public.group_members for select to authenticated using (public.is_group_member(group_id));
create policy expenses_select on public.expenses for select to authenticated using (public.is_group_member(group_id));
create policy expenses_delete on public.expenses for delete to authenticated
  using (created_by = (select auth.uid()) and public.is_group_member(group_id));
create policy splits_select on public.expense_splits for select to authenticated
  using (exists (select 1 from public.expenses e where e.id = expense_id and public.is_group_member(e.group_id)));
create policy settlements_select on public.settlements for select to authenticated using (public.is_group_member(group_id));
create policy settlements_delete on public.settlements for delete to authenticated
  using (created_by = (select auth.uid()) and public.is_group_member(group_id));

revoke all on all tables in schema public from anon;
revoke insert, delete on public.profiles from authenticated;
revoke update on public.profiles from authenticated;
grant update (name) on public.profiles to authenticated;
revoke insert on public.groups from authenticated;
revoke update on public.groups from authenticated;
grant update (name, emoji) on public.groups to authenticated;
revoke insert, update, delete on public.group_members from authenticated;
revoke insert, update on public.expenses from authenticated;
revoke insert, update, delete on public.expense_splits from authenticated;
revoke insert, update on public.settlements from authenticated;
revoke all on public.join_attempts from authenticated;

create view public.group_balances with (security_invoker = true) as
select m.group_id, m.user_id,
  (coalesce((select sum(e.amount_paise) from public.expenses e where e.group_id = m.group_id and e.paid_by = m.user_id), 0)
 - coalesce((select sum(s.share_paise) from public.expense_splits s join public.expenses e on e.id = s.expense_id where e.group_id = m.group_id and s.user_id = m.user_id), 0)
 + coalesce((select sum(t.amount_paise) from public.settlements t where t.group_id = m.group_id and t.from_user = m.user_id), 0)
 - coalesce((select sum(t.amount_paise) from public.settlements t where t.group_id = m.group_id and t.to_user = m.user_id), 0))::bigint as balance_paise
from public.group_members m;
grant select on public.group_balances to authenticated;

-- Functions: create_group, join_group (10 wrong codes per hour lock), reset_join_code, add_expense,
-- update_expense (creator only), add_settlement, leave_group, remove_member (both need a settled balance),
-- plus the internal _check_splits validator. See the applied migration "initial_schema" in the Supabase
-- dashboard (Database > Migrations) for their full bodies.
