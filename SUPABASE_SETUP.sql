-- =====================================================================
-- Sawa — Supabase schema
-- Paste this whole file into Supabase Dashboard → SQL Editor → Run.
-- It is idempotent: safe to run multiple times.
-- =====================================================================

-- =====================================================================
-- 1. TABLES (create all tables first so policies can reference them)
-- =====================================================================

-- ---------- PROFILES ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text,
  name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- ---------- PLANS ----------
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  location text,
  starts_at timestamptz,
  cover_url text,
  privacy text not null default 'friends',
  created_at timestamptz not null default now()
);

-- Extra display columns (safe to re-run)
alter table public.plans add column if not exists time_label text;
alter table public.plans add column if not exists date_label text;
alter table public.plans add column if not exists max_people int;

-- ---------- PLAN MEMBERS ----------
create table if not exists public.plan_members (
  plan_id uuid not null references public.plans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'invited',
  created_at timestamptz not null default now(),
  primary key (plan_id, user_id)
);

-- ---------- MOMENTS ----------
create table if not exists public.moments (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid references public.plans(id) on delete set null,
  photo_url text not null,
  caption text,
  created_at timestamptz not null default now()
);

-- ---------- FRIENDSHIPS ----------
create table if not exists public.friendships (
  user_id uuid not null references auth.users(id) on delete cascade,
  friend_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',  -- pending | accepted | blocked
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

-- =====================================================================
-- 2. ROW LEVEL SECURITY
-- =====================================================================

alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.plan_members enable row level security;
alter table public.moments enable row level security;
alter table public.friendships enable row level security;

-- ---------- PROFILES POLICIES ----------
drop policy if exists "profiles: read all" on public.profiles;
create policy "profiles: read all"
  on public.profiles for select
  using (true);

drop policy if exists "profiles: insert own" on public.profiles;
create policy "profiles: insert own"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own"
  on public.profiles for update
  using (auth.uid() = id);

-- ---------- PLANS POLICIES ----------
drop policy if exists "plans: members read" on public.plans;
create policy "plans: members read"
  on public.plans for select
  using (
    owner_id = auth.uid()
    or exists (select 1 from public.plan_members m where m.plan_id = id and m.user_id = auth.uid())
  );

drop policy if exists "plans: owner write" on public.plans;
create policy "plans: owner write"
  on public.plans for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ---------- PLAN MEMBERS POLICIES ----------
drop policy if exists "plan_members: self or owner read" on public.plan_members;
create policy "plan_members: self or owner read"
  on public.plan_members for select
  using (
    user_id = auth.uid()
    or exists (select 1 from public.plans p where p.id = plan_id and p.owner_id = auth.uid())
  );

drop policy if exists "plan_members: owner write" on public.plan_members;
create policy "plan_members: owner write"
  on public.plan_members for all
  using (exists (select 1 from public.plans p where p.id = plan_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.plans p where p.id = plan_id and p.owner_id = auth.uid()));

drop policy if exists "plan_members: self update status" on public.plan_members;
create policy "plan_members: self update status"
  on public.plan_members for update
  using (user_id = auth.uid());

-- ---------- MOMENTS POLICIES ----------
drop policy if exists "moments: author or plan member read" on public.moments;
create policy "moments: author or plan member read"
  on public.moments for select
  using (
    author_id = auth.uid()
    or (
      plan_id is not null
      and exists (
        select 1 from public.plan_members m
        where m.plan_id = moments.plan_id and m.user_id = auth.uid()
      )
    )
    or (
      plan_id is not null
      and exists (
        select 1 from public.plans p
        where p.id = moments.plan_id and p.owner_id = auth.uid()
      )
    )
  );

drop policy if exists "moments: author write" on public.moments;
create policy "moments: author write"
  on public.moments for all
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

-- ---------- FRIENDSHIPS POLICIES ----------
drop policy if exists "friendships: read involved" on public.friendships;
create policy "friendships: read involved"
  on public.friendships for select
  using (user_id = auth.uid() or friend_id = auth.uid());

drop policy if exists "friendships: insert as requester" on public.friendships;
create policy "friendships: insert as requester"
  on public.friendships for insert
  with check (user_id = auth.uid());

drop policy if exists "friendships: update involved" on public.friendships;
create policy "friendships: update involved"
  on public.friendships for update
  using (user_id = auth.uid() or friend_id = auth.uid());

drop policy if exists "friendships: delete involved" on public.friendships;
create policy "friendships: delete involved"
  on public.friendships for delete
  using (user_id = auth.uid() or friend_id = auth.uid());

-- =====================================================================
-- 3. STORAGE BUCKET FOR PHOTOS
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

drop policy if exists "photos: anyone read" on storage.objects;
create policy "photos: anyone read"
  on storage.objects for select
  using (bucket_id = 'photos');

drop policy if exists "photos: auth users upload" on storage.objects;
create policy "photos: auth users upload"
  on storage.objects for insert
  with check (bucket_id = 'photos' and auth.role() = 'authenticated');

drop policy if exists "photos: owner update/delete" on storage.objects;
create policy "photos: owner update/delete"
  on storage.objects for update
  using (bucket_id = 'photos' and owner = auth.uid());

drop policy if exists "photos: owner delete" on storage.objects;
create policy "photos: owner delete"
  on storage.objects for delete
  using (bucket_id = 'photos' and owner = auth.uid());
