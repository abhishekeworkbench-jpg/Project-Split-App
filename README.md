# Splitly

Expense splitting for family and friends. INR only. Vite + React PWA on Supabase, hosted on Netlify.

## Run locally
1. `npm install`
2. Copy `.env.example` to `.env` (both values are public by design).
3. `npm run dev`, then open the printed URL (on your phone use the network URL).

## Supabase setup (one time)
The database schema is already applied to the project. It is also saved in `supabase/migrations/001_schema.sql`.

In the Supabase dashboard:
1. **Authentication > Sign In / Providers > Email**: turn **Confirm email** off.
2. **Authentication > URL Configuration**: set **Site URL** to your Netlify URL, and add it plus `http://localhost:5173` under **Redirect URLs**.
3. **Google sign-in**: create an OAuth client in Google Cloud Console (type Web application). Add the redirect URI shown on Supabase's Google provider page, then paste the client ID and secret into **Authentication > Sign In / Providers > Google**.

## Netlify
1. Link this GitHub repo to your Netlify site (Site configuration > Build & deploy > Link repository).
2. Under **Environment variables** add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (values in `.env.example`).
3. Build command `npm run build`, publish directory `dist` (already in `netlify.toml`).

Never put the `service_role` key in this project.

## Rules enforced by the database
- You only see groups you belong to. Joining needs the 6-digit code; 10 wrong codes in an hour locks joining for the rest of that hour.
- Only the person who added an expense can edit or delete it. Same for payments.
- Only the group creator can remove members, reset the code, or delete the group.
- You can leave a group, or be removed, only when your balance is settled. The creator can't leave; they delete the group.
- Amounts are integer paise. Each entry is time-stamped by the server (shown in IST).
