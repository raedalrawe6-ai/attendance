-- =====================================================================
-- حضور الرابعة – Supabase schema
-- Run once in: Supabase Dashboard → SQL Editor → New query → Run
-- Security model:
--   * Public sign-ups are DISABLED (Auth → Providers → Email → "Allow new users" off).
--   * Only emails listed in public.staff can read/write anything (RLS).
--   * Every change to attendance/students/schedule/subjects is written to audit_log by triggers.
-- =====================================================================

-- ---------- Staff (who is allowed in) ----------
create table if not exists public.staff (
  email      text primary key,
  full_name  text,
  role       text not null default 'doctor',      -- future: 'admin', 'assistant', ...
  created_at timestamptz not null default now()
);

-- Helper used by every RLS policy. SECURITY DEFINER so it can read staff under RLS.
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where lower(email) = lower(auth.jwt() ->> 'email'));
$$;

-- ---------- Core tables ----------
create table if not exists public.students (
  id        text primary key,                  -- e.g. B052 (printed in the QR as ATT|B052)
  name      text not null,
  section   text not null,                     -- A..E (theory group)
  subgroup  text not null,                     -- A1..E3 (practical group)
  active    boolean not null default true
);

create table if not exists public.subjects (
  name            text primary key,
  limit_theory    int  not null default 3,     -- absences allowed before deprivation
  limit_practical int  not null default 3,
  sort            int  not null default 0
);

create table if not exists public.schedule (
  id          bigint generated always as identity primary key,
  weekday     smallint not null check (weekday between 0 and 6),  -- 0 = Sunday (JS getDay)
  start_time  time not null,
  end_time    time not null,
  group_code  text not null,                   -- 'B' (theory) or 'B2' (practical)
  type        text not null check (type in ('نظري','عملي')),
  subject     text not null references public.subjects(name) on update cascade
);

create table if not exists public.attendance (
  id          bigint generated always as identity primary key,
  date        date not null,
  time        text not null,                   -- HH:MM local, as scanned
  student_id  text not null references public.students(id) on update cascade,
  subject     text not null references public.subjects(name) on update cascade,
  type        text not null check (type in ('نظري','عملي')),
  status      text not null check (status in ('حاضر','متأخر','عذر')),
  group_code  text not null,                   -- the session's group (guest scans keep host group)
  note        text not null default '',
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  unique (date, student_id, subject, type)     -- one record per student per session
);
create index if not exists attendance_group_idx on public.attendance (group_code, date);

-- ---------- Audit log (append-only) ----------
create table if not exists public.audit_log (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  actor      text default (auth.jwt() ->> 'email'),
  table_name text not null,
  action     text not null,
  old_row    jsonb,
  new_row    jsonb
);

create or replace function public.audit_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Plain on-time scans are not audited (too noisy); everything else is.
  if tg_table_name = 'attendance' and tg_op = 'INSERT' then
    if new.note = '' and new.status <> 'عذر' then return new; end if;
  end if;
  insert into public.audit_log (table_name, action, old_row, new_row)
  values (tg_table_name, tg_op,
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

do $$ declare t text; begin
  foreach t in array array['attendance','students','schedule','subjects'] loop
    execute format('drop trigger if exists audit_%1$s on public.%1$s', t);
    execute format('create trigger audit_%1$s after insert or update or delete on public.%1$s
                    for each row execute function public.audit_trigger()', t);
  end loop;
end $$;

-- ---------- Row Level Security ----------
alter table public.staff      enable row level security;
alter table public.students   enable row level security;
alter table public.subjects   enable row level security;
alter table public.schedule   enable row level security;
alter table public.attendance enable row level security;
alter table public.audit_log  enable row level security;

do $$ declare t text; begin
  foreach t in array array['students','subjects','schedule','attendance'] loop
    execute format('drop policy if exists staff_all on public.%I', t);
    execute format('create policy staff_all on public.%I for all to authenticated
                    using (public.is_staff()) with check (public.is_staff())', t);
  end loop;
end $$;
drop policy if exists staff_read_self on public.staff;
create policy staff_read_self on public.staff for select to authenticated using (public.is_staff());
drop policy if exists audit_read on public.audit_log;
create policy audit_read on public.audit_log for select to authenticated using (public.is_staff());
-- (no insert/update/delete policy on audit_log → only the trigger can write; nobody can edit it)

-- ---------- Realtime (live sync across devices) ----------
alter publication supabase_realtime add table public.attendance;

-- ---------- Seed: subjects + Dr. Rasha's timetable ----------
insert into public.subjects (name, sort) values
  ('الباطنية',1),('التخدير',2),('العناية',3),('التقنيات',4),('طب الألم',5),('أخلاقيات المهنة',6)
on conflict do nothing;

insert into public.schedule (weekday, start_time, end_time, group_code, type, subject)
select * from (values
  (1,'08:30'::time,'09:50'::time,'E1','عملي','الباطنية'),
  (1,'09:50','11:10','A3','عملي','الباطنية'),
  (1,'11:10','12:30','B1','عملي','الباطنية'),
  (1,'12:30','13:50','B2','عملي','الباطنية'),
  (1,'13:50','15:10','A1','عملي','الباطنية'),
  (2,'08:30','09:50','A','نظري','الباطنية'),
  (2,'09:50','11:10','B','نظري','الباطنية'),
  (2,'11:10','12:30','C','نظري','الباطنية'),
  (2,'12:30','13:50','D','نظري','الباطنية'),
  (2,'13:50','15:10','E','نظري','الباطنية')
) v where not exists (select 1 from public.schedule);

-- ---------- Allowed accounts (edit the email!) ----------
-- insert into public.staff (email, full_name) values ('DOCTOR_EMAIL_HERE', 'د. رشا');
