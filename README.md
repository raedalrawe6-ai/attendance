# حضور الرابعة – تقنيات التخدير

QR attendance for lecturers. Static front-end (GitHub Pages) + Supabase (Auth, Postgres, RLS, Realtime).

## Structure
```
index.html            markup only (all tabs)
css/styles.css        all styles (tokens → base → layout → components)
js/app.js             entry: auth gate, tab router, sync loop
js/core/config.js     Supabase URL/key + domain constants
js/core/supabase.js   shared client
js/core/store.js      state, local cache, offline queue, pub/sub
js/core/api.js        ALL database access (only file that queries tables)
js/core/session.js    timetable → current lecture, scan window
js/core/rules.js      attendance maths (absences, limits, risk)
js/core/excel.js      Excel export
js/views/*.js         one module per tab: init() + render()
supabase/schema.sql   tables, RLS, audit triggers, seed timetable
sw.js                 offline cache
```
Add a tab: create `js/views/x.js` (export init/render), add a `<button data-tab="x">` + `<section id="tab-x">`, register in `VIEWS` (app.js).

## Setup
1. supabase.com → New project. SQL Editor → run `supabase/schema.sql`, then the private `seed_students.sql`.
2. Authentication → Providers → Email: turn **off** "Allow new users to sign up".
3. Authentication → Users → Add user (doctor's email + password, auto-confirm).
4. SQL: `insert into staff (email, full_name) values ('doctor@email', 'د. رشا');`
5. Project Settings → API: copy URL + anon key into `js/core/config.js`.
6. Push to GitHub Pages.

## Security
- Only emails in `staff` can read/write (RLS). The anon key alone gives nothing.
- `audit_log` records every excuse, manual/out-of-hours entry and settings change; it can't be edited from the app.
- Lost phone → change the doctor's password (Auth → Users) – all sessions end.
