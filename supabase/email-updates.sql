-- RESEARCH DASHBOARD 360: email updates to teachers
-- Run this in Supabase → SQL Editor AFTER schema.sql. It is safe to run again.
--
-- How it works:
--   * Only an administrator's decision sends an email. When an administrator moves a teacher's
--     research to a new status (and leaves "Email the teacher" ticked), the database puts one
--     email in public.email_outbox.
--   * Teachers, evaluators and visitors cannot add emails: the outbox has no policies for them.
--   * The "send-emails" Edge Function (supabase/functions/send-emails) sends what is waiting,
--     from the district Gmail account, and marks each one sent. It retries a failed email up to 5 times.

create table if not exists public.email_outbox (
  id bigint generated always as identity primary key,
  to_email text not null,
  project_id text,
  data jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  attempts int not null default 0,
  claimed_at timestamptz,
  sent_at timestamptz,
  error text
);
create index if not exists email_outbox_unsent_idx on public.email_outbox (created_at) where sent_at is null;
alter table public.email_outbox enable row level security;
revoke all on public.email_outbox from anon, authenticated;
-- administrators may look at what was sent (read only); nobody else sees it
grant select on public.email_outbox to authenticated;
drop policy if exists outbox_read on public.email_outbox;
create policy outbox_read on public.email_outbox for select to authenticated using (public.is_staff());

-- an administrator's status change queues one email to the researcher
create or replace function public.queue_progress_email() returns trigger
language plpgsql security definer set search_path = public as $$
declare o public.profiles%rowtype; fb text;
begin
  if new.status = old.status then return new; end if;
  if coalesce(public.my_role(), '') not in ('admin', 'superadmin') then return new; end if;
  if coalesce(new.data->>'email_teacher', 'true') = 'false' then return new; end if;
  select * into o from public.profiles where id = new.owner_id;
  if not found or coalesce(o.email, '') = '' or o.status <> 'active' then return new; end if;
  if jsonb_array_length(coalesce(new.data->'feedback', '[]'::jsonb)) > jsonb_array_length(coalesce(old.data->'feedback', '[]'::jsonb)) then
    fb := new.data->'feedback'->-1->>'text';
  end if;
  insert into public.email_outbox (to_email, project_id, data) values (o.email, new.id, jsonb_strip_nulls(jsonb_build_object(
    'kind', 'status',
    'name', o.data->>'name',
    'research_id', new.research_id,
    'title', new.data->>'title',
    'from', old.status,
    'to', new.status,
    'feedback', fb)));
  return new;
end $$;
drop trigger if exists projects_email on public.projects;
create trigger projects_email after update of status on public.projects for each row execute function public.queue_progress_email();

-- the sender takes a batch of waiting emails (only the server's own key may call this)
create or replace function public.claim_emails(n int default 20) returns setof public.email_outbox
language sql security definer set search_path = public as $$
  update public.email_outbox set attempts = attempts + 1, claimed_at = now()
  where id in (select id from public.email_outbox
               where sent_at is null and attempts < 5 and (claimed_at is null or claimed_at < now() - interval '10 minutes')
               order by created_at limit n for update skip locked)
  returning *
$$;
revoke all on function public.claim_emails(int) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.claim_emails(int) to service_role;
  end if;
end $$;

-- ring the sender as soon as an email is waiting (needs the pg_net extension, which Supabase includes)
do $$ begin
  create extension if not exists pg_net;
exception when others then raise notice 'pg_net is not available here; emails will wait for the next scheduled send.';
end $$;

create or replace function public.ring_email_sender() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_net') then
    begin
      execute 'select net.http_post(url := $1, body := ''{}''::jsonb, headers := $2)'
      using 'https://sczkinckkoneyfviiwso.supabase.co/functions/v1/send-emails',
            jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjemtpbmNra29uZXlmdmlpd3NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUyNTAwMzUsImV4cCI6MjExMDgyNjAzNX0.sckgCYzi-eAeaREI68EpmCbW5kOTP_Vm8AbKxetqPWQ');
    exception when others then null; -- never block an administrator's decision because of email
    end;
  end if;
  return null;
end $$;
drop trigger if exists email_outbox_ring on public.email_outbox;
create trigger email_outbox_ring after insert on public.email_outbox for each statement execute function public.ring_email_sender();
