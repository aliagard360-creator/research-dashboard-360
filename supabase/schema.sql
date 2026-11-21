-- =====================================================================================
-- RESEARCH DASHBOARD 360 — Supabase database (free tier)
-- Run this whole file once in Supabase → SQL Editor → New query → Run.
-- It is safe to run again: every statement checks before creating.
--
-- Security model
--   * Every table has row-level security (RLS). The website's public key can only do
--     what these policies allow, so rules can't be bypassed from the browser.
--   * aliagard360@gmail.com is the only account that becomes Super Administrator.
--   * Only the Super Administrator can invite administrators; administrators can invite
--     evaluators and teachers. Teachers register themselves and wait for approval.
--   * Workflow rules (who may move a project to which status) are enforced by triggers.
-- =====================================================================================

-- ---------- the one Super Administrator ----------
create or replace function public.superadmin_email() returns text
language sql immutable as $$ select 'aliagard360@gmail.com'::text $$;

-- ---------- tables ----------
create table if not exists public.settings (
  id text primary key default 'main',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique,
  role text not null default 'teacher' check (role in ('teacher', 'evaluator', 'admin', 'superadmin')),
  status text not null default 'pending' check (status in ('pending', 'active', 'rejected', 'suspended')),
  school_id text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.schools (
  id text primary key,
  active boolean not null default true,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create sequence if not exists public.research_seq;

create table if not exists public.projects (
  id text primary key,
  owner_id uuid not null references public.profiles (id) on delete restrict,
  school_id text,
  status text not null default 'Draft',
  category text,
  evaluator_id uuid references public.profiles (id) on delete set null,
  visibility text not null default 'district' check (visibility in ('restricted', 'district', 'public')),
  research_id text unique,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists projects_owner_idx on public.projects (owner_id);
create index if not exists projects_status_idx on public.projects (status);
create index if not exists projects_school_idx on public.projects (school_id);

create table if not exists public.notifications (
  id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  read boolean not null default false,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id);

create table if not exists public.audit (
  id text primary key,
  actor uuid default auth.uid(),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.cms (
  id text primary key check (id in ('public', 'admin')),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.school_requests (
  id text primary key,
  status text not null default 'pending' check (status in ('pending', 'added', 'declined')),
  created_by uuid default auth.uid(),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.sessions (
  id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.invitations (
  email text primary key,
  role text not null check (role in ('teacher', 'evaluator', 'admin')),
  school_id text,
  data jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

-- ---------- helper functions (run with owner rights, read-only) ----------
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and status = 'active'
$$;
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() in ('admin', 'superadmin'), false)
$$;
create or replace function public.is_super() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.my_role() = 'superadmin', false)
$$;
create or replace function public.is_active_user() returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_role() is not null
$$;
create or replace function public.owns_project(pid text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.projects where id = pid and owner_id = auth.uid())
$$;
create or replace function public.can_view_project(pid text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.projects p where p.id = pid and (
      p.owner_id = auth.uid()
      or (public.is_staff() and p.status <> 'Draft')
      or p.evaluator_id = auth.uid()
      or (p.status in ('Completed', 'Published', 'Archived') and p.visibility in ('district', 'public') and public.is_active_user())
    ))
$$;
create or replace function public.admin_transition_ok(from_s text, to_s text) returns boolean
language sql immutable as $$
  select (from_s, to_s) in (
    ('Submitted', 'Under Initial Screening'),
    ('Under Initial Screening', 'Under Technical Review'), ('Under Initial Screening', 'Returned for Revision'), ('Under Initial Screening', 'Rejected'),
    ('Under Technical Review', 'Pending Approval'), ('Under Technical Review', 'Pending Ethics Review'), ('Under Technical Review', 'Returned for Revision'),
    ('Revision Resubmitted', 'Under Technical Review'),
    ('Pending Ethics Review', 'Pending Approval'), ('Pending Ethics Review', 'Returned for Revision'),
    ('Pending Approval', 'Approved'), ('Pending Approval', 'Rejected'),
    ('Approved', 'Ongoing Implementation'),
    ('Ongoing Implementation', 'For Final Evaluation'),
    ('For Final Evaluation', 'Completed'), ('For Final Evaluation', 'For Dissemination'), ('For Final Evaluation', 'Returned for Revision'),
    ('For Dissemination', 'Published'),
    ('Published', 'Archived'), ('Completed', 'Archived'))
$$;

-- ---------- notices to administrators (sent by the database, so new users don't need to see admins) ----------
create or replace function public.notify_staff(msg text) returns void
language sql security definer set search_path = public as $$
  insert into public.notifications (id, user_id, data)
  select gen_random_uuid()::text, id, jsonb_build_object('message', msg, 'at', now())
  from public.profiles where role in ('admin', 'superadmin') and status = 'active'
$$;

-- ---------- new sign-ups become profiles ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  inv public.invitations%rowtype;
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  em text := lower(new.email);
begin
  if em = public.superadmin_email() then
    insert into public.profiles (id, email, role, status, data)
    values (new.id, em, 'superadmin', 'active', jsonb_build_object('name', coalesce(meta->>'name', 'Super Administrator'), 'position', 'Super Administrator'))
    on conflict (id) do nothing;
    update public.settings set data = data || '{"superadmin_ready": true}'::jsonb where id = 'main';
    return new;
  end if;
  select * into inv from public.invitations where email = em;
  if found then
    insert into public.profiles (id, email, role, status, school_id, data)
    values (new.id, em, inv.role, 'active', inv.school_id, inv.data || jsonb_strip_nulls(jsonb_build_object('name', meta->>'name')))
    on conflict (id) do nothing;
    delete from public.invitations where email = em;
  else
    insert into public.profiles (id, email, role, status, school_id, data)
    values (new.id, em, 'teacher', 'pending', nullif(meta->>'school_id', ''),
            jsonb_strip_nulls(jsonb_build_object('name', meta->>'name', 'position', meta->>'position', 'requested_school', meta->>'requested_school')))
    on conflict (id) do nothing;
    perform public.notify_staff('New teacher registration awaiting approval: ' || coalesce(meta->>'name', em));
    if nullif(meta->>'requested_school', '') is not null and nullif(meta->>'school_id', '') is null then
      insert into public.school_requests (id, created_by, data)
      values (gen_random_uuid()::text, new.id, jsonb_build_object('name', meta->>'requested_school', 'by', jsonb_build_array(new.id::text), 'at', now()));
    end if;
  end if;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.notify_on_events() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'school_requests' then
    perform public.notify_staff('School requested for the directory: "' || coalesce(new.data->>'name', '') || '"');
  elsif tg_table_name = 'profiles' and old.status = 'rejected' and new.status = 'pending' then
    perform public.notify_staff('Registration resubmitted: ' || coalesce(new.data->>'name', new.email));
  end if;
  return new;
end $$;
drop trigger if exists school_requests_notify on public.school_requests;
create trigger school_requests_notify after insert on public.school_requests for each row execute function public.notify_on_events();
drop trigger if exists profiles_notify on public.profiles;
create trigger profiles_notify after update on public.profiles for each row execute function public.notify_on_events();

-- ---------- profile guard: roles, approvals, protected fields ----------
create or replace function public.profiles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare actor_role text := public.my_role();
begin
  new.updated_at := now();
  if new.id <> old.id or coalesce(new.email, '') <> coalesce(old.email, '') then raise exception 'Account id and email cannot be changed here.'; end if;
  -- the last active Super Administrator stays a Super Administrator
  if old.role = 'superadmin' and old.status = 'active' and (new.role <> 'superadmin' or new.status <> 'active')
     and (select count(*) from public.profiles where role = 'superadmin' and status = 'active') <= 1 then
    raise exception 'The last active Super Administrator cannot be changed.';
  end if;
  if actor_role in ('admin', 'superadmin') then
    if new.role <> old.role then
      if actor_role <> 'superadmin' then raise exception 'Only the Super Administrator can change roles.'; end if;
      if new.id = auth.uid() then raise exception 'You cannot change your own role.'; end if;
    end if;
    if new.role in ('admin', 'superadmin') and old.role not in ('admin', 'superadmin') and actor_role <> 'superadmin' then
      raise exception 'Only the Super Administrator can make administrators.';
    end if;
    if new.id = auth.uid() and new.status <> old.status then raise exception 'You cannot change your own account status.'; end if;
    return new;
  end if;
  -- everyone else may only edit their own profile, within limits
  if old.id <> auth.uid() then raise exception 'Not allowed.'; end if;
  if new.role <> old.role then raise exception 'You cannot change your role.'; end if;
  if old.status in ('pending', 'rejected') then
    -- before approval: details can be corrected and the registration resubmitted
    if new.status <> 'pending' and new.status <> old.status then raise exception 'Only an administrator can approve accounts.'; end if;
    return new;
  end if;
  if new.status <> old.status then raise exception 'Only an administrator can change account status.'; end if;
  if coalesce(new.school_id, '') <> coalesce(old.school_id, '') then raise exception 'School changes need administrator approval.'; end if;
  if old.role in ('teacher', 'evaluator') and (
       new.data->'name' is distinct from old.data->'name'
    or new.data->'position' is distinct from old.data->'position'
    or new.data->'photo' is distinct from old.data->'photo') then
    raise exception 'Name, position and photo changes need administrator approval.';
  end if;
  return new;
end $$;
drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles for each row execute function public.profiles_guard();

-- ---------- project guard: workflow rules and Research IDs ----------
create or replace function public.projects_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare actor_role text := public.my_role(); rid text;
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    if new.owner_id <> auth.uid() then raise exception 'You can only create your own projects.'; end if;
    if new.status <> 'Draft' then raise exception 'New projects start as drafts.'; end if;
    new.research_id := null; new.evaluator_id := null; new.visibility := 'district';
    new.data := new.data - 'research_id';
    return new;
  end if;
  if new.owner_id <> old.owner_id then raise exception 'Project owner cannot change.'; end if;
  if actor_role in ('admin', 'superadmin') then
    if new.status <> old.status then
      if old.owner_id = auth.uid() then raise exception 'You cannot decide on your own research.'; end if;
      if not public.admin_transition_ok(old.status, new.status) then raise exception 'Cannot move from % to %.', old.status, new.status; end if;
    end if;
    if new.research_id is distinct from old.research_id then raise exception 'Research IDs cannot be changed.'; end if;
    return new;
  end if;
  if old.owner_id = auth.uid() then
    if new.evaluator_id is distinct from old.evaluator_id or new.visibility <> old.visibility then raise exception 'Only administrators can change that.'; end if;
    if new.status <> old.status then
      if not ((old.status = 'Draft' and new.status = 'Submitted')
           or (old.status = 'Returned for Revision' and new.status = 'Revision Resubmitted')
           or (new.status = 'Withdrawn' and old.status not in ('Draft', 'Withdrawn', 'Rejected', 'Archived', 'Completed', 'Published'))) then
        raise exception 'You cannot move your project to %.', new.status;
      end if;
    elsif old.status not in ('Draft', 'Returned for Revision') then
      raise exception 'This project can no longer be edited.';
    end if;
    -- the database, not the browser, issues Research IDs
    if old.status = 'Draft' and new.status = 'Submitted' then
      rid := 'RD360-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.research_seq')::text, 4, '0');
      new.research_id := rid;
      new.data := jsonb_set(new.data, '{research_id}', to_jsonb(rid));
    elsif new.research_id is distinct from old.research_id then
      raise exception 'Research IDs cannot be changed.';
    end if;
    return new;
  end if;
  if old.evaluator_id = auth.uid() then
    -- evaluators add feedback; they never change status or assignment
    if new.status <> old.status or new.evaluator_id is distinct from old.evaluator_id or new.visibility <> old.visibility
       or new.research_id is distinct from old.research_id or new.school_id is distinct from old.school_id then
      raise exception 'Evaluators can only add their evaluation.';
    end if;
    return new;
  end if;
  raise exception 'Not allowed.';
end $$;
drop trigger if exists projects_guard on public.projects;
create trigger projects_guard before insert or update on public.projects for each row execute function public.projects_guard();

-- ---------- publishing the home page follows the "admins can publish" setting ----------
create or replace function public.cms_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if new.id = 'public' and not (public.is_super() or (public.my_role() = 'admin' and coalesce((select (data->>'adminsCanPublish')::boolean from public.settings where id = 'main'), true))) then
    raise exception 'Your role cannot publish the home page.';
  end if;
  return new;
end $$;
drop trigger if exists cms_guard on public.cms;
create trigger cms_guard before insert or update on public.cms for each row execute function public.cms_guard();

-- ---------- row-level security ----------
alter table public.settings enable row level security;
alter table public.profiles enable row level security;
alter table public.schools enable row level security;
alter table public.projects enable row level security;
alter table public.notifications enable row level security;
alter table public.audit enable row level security;
alter table public.cms enable row level security;
alter table public.school_requests enable row level security;
alter table public.sessions enable row level security;
alter table public.invitations enable row level security;

do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public'
    and tablename in ('settings','profiles','schools','projects','notifications','audit','cms','school_requests','sessions','invitations') loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- settings: anyone may read (no secrets inside); only the Super Administrator edits
create policy settings_read on public.settings for select to anon, authenticated using (true);
create policy settings_write on public.settings for update to authenticated using (public.is_super()) with check (public.is_super());

-- profiles: you, administrators, and (for names on the site) other active members
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff() or (status = 'active' and public.is_active_user()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_staff()) with check (id = auth.uid() or public.is_staff());

-- schools: public directory; administrators maintain it
create policy schools_read on public.schools for select to anon, authenticated using (true);
create policy schools_insert on public.schools for insert to authenticated with check (public.is_staff());
create policy schools_update on public.schools for update to authenticated using (public.is_staff()) with check (public.is_staff());

-- projects
create policy projects_read_public on public.projects for select to anon
  using (status in ('Completed', 'Published', 'Archived') and visibility = 'public');
create policy projects_read on public.projects for select to authenticated
  using (owner_id = auth.uid()
      or (public.is_staff() and status <> 'Draft')
      or evaluator_id = auth.uid()
      or (status in ('Completed', 'Published', 'Archived') and visibility in ('district', 'public') and public.is_active_user()));
create policy projects_insert on public.projects for insert to authenticated
  with check (owner_id = auth.uid() and public.my_role() = 'teacher');
create policy projects_update on public.projects for update to authenticated
  using (owner_id = auth.uid() or public.is_staff() or evaluator_id = auth.uid())
  with check (owner_id = auth.uid() or public.is_staff() or evaluator_id = auth.uid());
create policy projects_delete on public.projects for delete to authenticated using (owner_id = auth.uid() and status = 'Draft');

-- notifications: read your own; signed-in members may notify others (e.g. "new submission")
create policy notif_read on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notif_insert on public.notifications for insert to authenticated with check (auth.uid() is not null);
create policy notif_update on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notif_delete on public.notifications for delete to authenticated using (user_id = auth.uid());

-- audit log: everyone writes their own entries; only administrators read; nobody edits or deletes
create policy audit_insert on public.audit for insert to authenticated with check (actor = auth.uid());
create policy audit_read on public.audit for select to authenticated using (public.is_staff());

-- home page content: the published copy is public; the draft is for administrators
create policy cms_read_public on public.cms for select to anon, authenticated using (id = 'public' or public.is_staff());
create policy cms_insert on public.cms for insert to authenticated with check (public.is_staff());
create policy cms_update on public.cms for update to authenticated using (public.is_staff()) with check (public.is_staff());

-- school requests
create policy sreq_insert on public.school_requests for insert to authenticated with check (created_by = auth.uid());
create policy sreq_read on public.school_requests for select to authenticated using (created_by = auth.uid() or public.is_staff());
create policy sreq_update on public.school_requests for update to authenticated using (public.is_staff()) with check (public.is_staff());

-- sessions (Settings → Where you're signed in)
create policy sess_read on public.sessions for select to authenticated using (user_id = auth.uid() or public.is_staff());
create policy sess_insert on public.sessions for insert to authenticated with check (user_id = auth.uid());
create policy sess_update on public.sessions for update to authenticated using (user_id = auth.uid() or public.is_staff()) with check (user_id = auth.uid() or public.is_staff());

-- invitations: administrators invite; only the Super Administrator invites administrators
create policy inv_read on public.invitations for select to authenticated using (public.is_staff());
create policy inv_insert on public.invitations for insert to authenticated
  with check (public.is_staff() and (role <> 'admin' or public.is_super()));
create policy inv_delete on public.invitations for delete to authenticated using (public.is_staff());

grant usage on schema public to anon, authenticated;
grant select on public.settings, public.schools, public.projects, public.cms to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on sequence public.research_seq to authenticated;

-- ---------- private file storage for proposals (10 MB, PDF / Word only) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proposals', 'proposals', false, 10485760,
        array['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "proposals: owner uploads" on storage.objects;
drop policy if exists "proposals: viewers download" on storage.objects;
create policy "proposals: owner uploads" on storage.objects for insert to authenticated
  with check (bucket_id = 'proposals' and public.owns_project((storage.foldername(name))[1]));
create policy "proposals: viewers download" on storage.objects for select to authenticated
  using (bucket_id = 'proposals' and public.can_view_project((storage.foldername(name))[1]));

-- ---------- live updates ----------
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.projects, public.notifications, public.profiles, public.cms, public.school_requests, public.sessions;
    exception when duplicate_object then null; end;
  end if;
end $$;

-- ---------- starting data ----------
insert into public.settings (id, data) values ('main', '{"requireApproval": true, "adminsCanPublish": true, "uploadMaxMB": 10, "idleMinutes": 30}')
on conflict (id) do nothing;
insert into public.cms (id, data) values ('admin', '{}'), ('public', '{}') on conflict (id) do nothing;

-- Official Aliaga school directory (DepEd SDO Nueva Ecija directories, read 2026-11-21).
insert into public.schools (id, data) values
  ('sch-105171', '{"name":"Aliaga Central School","code":"105171","type":"Elementary","location":"Medina St. Poblacion Centro, Aliaga, Nueva Ecija","email":"105171@deped.gov.ph","official":true}'),
  ('sch-105172', '{"name":"Betes Elementary School","code":"105172","type":"Elementary","location":"Zone 4, Brgy. Betes, Aliaga, Nueva Ecija","email":"105172@deped.gov.ph","official":true}'),
  ('sch-105173', '{"name":"Bibiclat Elementary School","code":"105173","type":"Elementary","location":"Zone 4, Bibiclat, Aliaga, Nueva Ecija","email":"105173@deped.gov.ph","official":true}'),
  ('sch-105174', '{"name":"Bucot Elementary School","code":"105174","type":"Elementary","location":"Purok 2, Bucot, Aliaga, Nueva Ecija","email":"105174@deped.gov.ph","official":true}'),
  ('sch-105179', '{"name":"Don Benigno Carriedo Elementary School","code":"105179","type":"Elementary","location":"Purok 3, Magsaysay, Aliaga, Nueva Ecija","email":"105179@deped.gov.ph","official":true}'),
  ('sch-105175', '{"name":"Don Emiliano Soriano Elementary School","code":"105175","type":"Elementary","location":"Purok 2, Macabucod, Aliaga, Nueva Ecija","email":"105175@deped.gov.ph","official":true}'),
  ('sch-105176', '{"name":"Doña Elena L. Soriano Elementary School","code":"105176","type":"Elementary","location":"Zone 7, Bibiclat, Aliaga, Nueva Ecija","email":"105176@deped.gov.ph","official":true}'),
  ('sch-105177', '{"name":"Gaudencio Medina Elementary School","code":"105177","type":"Elementary","location":"San Felipe Bata, Aliaga, Nueva Ecija","email":"105177@deped.gov.ph","official":true}'),
  ('sch-105180', '{"name":"Gaudencio Medina Pantoc Elementary School","code":"105180","type":"Elementary","location":"Purok 2, Pantoc, Aliaga, Nueva Ecija","email":"105180@deped.gov.ph","official":true}'),
  ('sch-105178', '{"name":"La Purisima Elementary School","code":"105178","type":"Elementary","location":"La Purisima, Aliaga, Nueva Ecija","email":"105178@deped.gov.ph","official":true}'),
  ('sch-105181', '{"name":"San Carlos Elementary School","code":"105181","type":"Elementary","location":"Purok 4, San Carlos, Aliaga, Nueva Ecija 3111","email":"105181@deped.gov.ph","official":true}'),
  ('sch-105182', '{"name":"San Emiliano Elementary School","code":"105182","type":"Elementary","location":"Purok 6, San Emiliano, Aliaga, Nueva Ecija","email":"105182@deped.gov.ph","official":true}'),
  ('sch-105183', '{"name":"San Eustacio Elementary School","code":"105183","type":"Elementary","location":"San Eustacio, Aliaga, Nueva Ecija","email":"105183@deped.gov.ph","official":true}'),
  ('sch-105184', '{"name":"San Felipe Elementary School","code":"105184","type":"Elementary","location":"Purok 3, San Felipe Matanda, Aliaga, Nueva Ecija","email":"105184@deped.gov.ph","official":true}'),
  ('sch-105186', '{"name":"San Pablo (B) Elementary School","code":"105186","type":"Elementary","location":"San Pablo Bata, Aliaga, Nueva Ecija","email":"105186@deped.gov.ph","official":true}'),
  ('sch-105187', '{"name":"San Pablo (M) Elementary School","code":"105187","type":"Elementary","location":"Hulo Street, San Pablo Matanda, Aliaga, Nueva Ecija","email":"105187@deped.gov.ph","official":true}'),
  ('sch-105188', '{"name":"Santiago Elementary School","code":"105188","type":"Elementary","location":"Purok 3, Santiago, Aliaga, Nueva Ecija","email":"105188@deped.gov.ph","official":true}'),
  ('sch-105189', '{"name":"Sta. Monica Elementary School","code":"105189","type":"Elementary","location":"Centro, Sta. Monica, Aliaga, Nueva Ecija","email":"105189@deped.gov.ph","official":true}'),
  ('sch-105190', '{"name":"Sto. Rosario Elementary School","code":"105190","type":"Elementary","location":"Centro-A, Sto. Rosario, Aliaga, Nueva Ecija","email":"105190@deped.gov.ph","official":true}'),
  ('sch-105191', '{"name":"Sto. Tomas Elementary School","code":"105191","type":"Elementary","location":"Liwanag Street, Sto. Tomas, Aliaga, Nueva Ecija","email":"105191@deped.gov.ph","official":true}'),
  ('sch-105192', '{"name":"Sunson Elementary School","code":"105192","type":"Elementary","location":"Zone 1, Brgy. Sunson, Aliaga, Nueva Ecija","email":"105192@deped.gov.ph","official":true}'),
  ('sch-105193', '{"name":"Umangan Elementary School","code":"105193","type":"Elementary","location":"Purok 3, Umangan, Aliaga, Nueva Ecija","email":"105193@deped.gov.ph","official":true}'),
  ('sch-501823', '{"name":"San Juan Integrated School","code":"501823","type":"Integrated","location":"Centro, San Juan, Aliaga, Nueva Ecija","email":"501823@deped.gov.ph","official":true}'),
  ('sch-300783', '{"name":"Aliaga National High School","code":"300783","type":"Secondary","location":"Poblacion East II, Aliaga, Nueva Ecija","email":"300783@deped.gov.ph","official":true}'),
  ('sch-300839', '{"name":"Restituto B. Peria High School","code":"300839","type":"Secondary","location":"Zone 4, Bibiclat, Aliaga, Nueva Ecija","email":"300839@deped.gov.ph","official":true}'),
  ('sch-306807', '{"name":"San Carlos High School","code":"306807","type":"Secondary","location":"Purok 4, Brgy. San Carlos, Aliaga, Nueva Ecija","email":"306807@deped.gov.ph","official":true}'),
  ('sch-306811', '{"name":"Umangan National High School","code":"306811","type":"Secondary","location":"Purok 3, Umangan, Aliaga, Nueva Ecija","email":"306811@deped.gov.ph","official":true}'),
  ('sch-300860', '{"name":"Vicente R. Bumanlag, Sr. National High School","code":"300860","type":"Secondary","location":"Liwanag St., Sto. Tomas, Aliaga, Nueva Ecija 3111","email":"300860@deped.gov.ph","official":true}'),
  ('sch-aliaga-shs', '{"name":"Aliaga Senior High School","code":"","type":"Secondary","location":"Aliaga, Nueva Ecija","email":"","official":true}')
on conflict (id) do nothing;
