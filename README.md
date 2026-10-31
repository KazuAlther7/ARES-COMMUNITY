# ARES COMMUNITY

Starter foundation for ARES MLBB Tournament Hub.

## Stack
- Static HTML/CSS/JavaScript
- Supabase Auth, Postgres, Storage, Realtime
- Deployable on Cloudflare Pages or GitHub Pages

## Setup
1. Confirm you are using the correct Supabase project for ARES COMMUNITY.
2. Run `supabase/schema.sql` in Supabase SQL Editor.
3. Copy the Supabase anon/publishable key into `js/config.js`.
4. Open `index.html` locally or deploy the repository to Cloudflare Pages.
5. Create an admin user in Supabase Auth. The user must be granted `app_metadata.role = "admin"` through trusted server-side/admin tooling. Do not use user-editable metadata and never expose the service-role key in browser code.

## Current starter scope
- Public landing page
- Tournament, team, and match data loading
- Realtime refresh for tournament/team/match changes
- Admin sign-in gate
- Initial database schema and RLS policies

Admin dashboard, tournament CRUD, roster editor, bracket generation, score editor, and advanced tournament formats are the next implementation phase.


## Migrasi: mode klasemen (Normal / MLBB)
Jalankan sekali di Supabase SQL Editor (kalau kolom belum ada):
```sql
alter table tournaments add column if not exists standings_mode text not null default 'normal';
alter table tournaments add column if not exists qualify_count integer;
```

## Folder convention
- `assets/` — logo, banner, ikon, dan gambar.
- `css/` — stylesheet.
- `js/` — JavaScript modules and configuration.
