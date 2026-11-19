-- Heritage: family circles, stories (one recording + transcript + translation each), private audio storage.

create extension if not exists pgcrypto;

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique default upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)),
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now()
);

create table public.family_members (
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  author_id uuid not null references auth.users (id) default auth.uid(),
  storyteller_name text not null,
  language text not null check (language in ('yo', 'ig', 'ha', 'pcm', 'en')),
  prompt text,
  title text,
  chapter text not null default 'Other stories',
  duration_ms integer not null default 0,
  audio_path text,
  status text not null default 'uploaded' check (status in ('uploaded', 'transcribing', 'transcribed', 'error')),
  transcript_text text,
  transcript_source text check (transcript_source in ('machine', 'human')),
  translation_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index stories_family_idx on public.stories (family_id, created_at desc);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger stories_touch before update on public.stories
  for each row execute function public.touch_updated_at();

-- Membership check used by every policy. SECURITY DEFINER avoids recursive RLS.
create or replace function public.is_family_member(fid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.family_members m where m.family_id = fid and m.user_id = auth.uid()
  );
$$;

create or replace function public.create_family(family_name text) returns public.families
language plpgsql security definer set search_path = public as $$
declare f public.families;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  insert into public.families (name, created_by) values (trim(family_name), auth.uid()) returning * into f;
  insert into public.family_members (family_id, user_id, role) values (f.id, auth.uid(), 'owner');
  return f;
end;
$$;

create or replace function public.join_family(code text) returns public.families
language plpgsql security definer set search_path = public as $$
declare f public.families;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into f from public.families where invite_code = upper(trim(code));
  if not found then raise exception 'That invite code was not found'; end if;
  insert into public.family_members (family_id, user_id) values (f.id, auth.uid()) on conflict do nothing;
  return f;
end;
$$;

alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.stories enable row level security;

create policy "members read their family" on public.families
  for select using (public.is_family_member(id));

create policy "members read membership" on public.family_members
  for select using (public.is_family_member(family_id));

create policy "members read stories" on public.stories
  for select using (public.is_family_member(family_id));
create policy "members add stories" on public.stories
  for insert with check (public.is_family_member(family_id) and author_id = auth.uid());
-- Any member may fix transcripts and translations: that is the point of the app.
create policy "members edit stories" on public.stories
  for update using (public.is_family_member(family_id)) with check (public.is_family_member(family_id));
create policy "authors delete own stories" on public.stories
  for delete using (author_id = auth.uid());

-- Private bucket; objects live under <family_id>/<file>.
insert into storage.buckets (id, name, public) values ('recordings', 'recordings', false)
  on conflict (id) do nothing;

create policy "members read recordings" on storage.objects
  for select using (
    bucket_id = 'recordings' and public.is_family_member(((storage.foldername(name))[1])::uuid)
  );
create policy "members upload recordings" on storage.objects
  for insert with check (
    bucket_id = 'recordings' and public.is_family_member(((storage.foldername(name))[1])::uuid)
  );
create policy "members replace recordings" on storage.objects
  for update using (
    bucket_id = 'recordings' and public.is_family_member(((storage.foldername(name))[1])::uuid)
  );
