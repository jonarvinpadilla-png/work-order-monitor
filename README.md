# Work Order Monitor

A shared work order tracking app for you and your team: board, log, and dashboard views,
covering preventive maintenance, corrective/breakdown repairs, and safety corrective actions.
Everyone who signs in sees the same live, shared data.

This is a real app — a React front end backed by a Supabase database (which also handles
logins). Getting it live takes about 15–20 minutes of clicking through two free signups.
No coding needed for any of the steps below.

---

## Step 1 — Create a free Supabase project (the database + logins)

1. Go to **supabase.com** and sign up (free tier is enough for this).
2. Click **New project**. Pick any name (e.g. "work-order-monitor") and a database password
   — save that password somewhere safe, you likely won't need it again but keep it just in case.
3. Wait about a minute for the project to finish setting up.
4. In the left sidebar, open **SQL Editor** → **New query**.
5. Open the `supabase/schema.sql` file from this project, copy its entire contents, paste it
   into the SQL Editor, and click **Run**. This creates the work_orders table and the security
   rules that make sure only signed-in teammates can see or edit the data.
6. In the left sidebar, open **Project Settings → API**. You'll need two values from this page
   in Step 3:
   - **Project URL**
   - **anon public** key

By default, Supabase lets anyone sign up with an email address. If you'd rather personally
invite each colleague instead of open signups, go to **Authentication → Providers → Email**
and turn off "Allow new users to sign up," then invite people from **Authentication → Users**.

## Step 2 — Put the project on GitHub

1. Go to **github.com**, sign up if you don't have an account, and create a **New repository**
   (e.g. "work-order-monitor"). Keep it private if you'd like.
2. Upload all the files from this folder into that repository (GitHub's web uploader lets you
   drag and drop the whole folder — no command line needed).

## Step 3 — Deploy on Vercel (this gives you the live web address)

1. Go to **vercel.com** and sign up using your GitHub account — this lets Vercel see your
   repositories directly.
2. Click **Add New → Project**, and select the repository you just created.
3. Vercel will auto-detect this as a Vite project. Before clicking Deploy, open
   **Environment Variables** and add:
   - `VITE_SUPABASE_URL` → paste the Project URL from Step 1
   - `VITE_SUPABASE_ANON_KEY` → paste the anon public key from Step 1
4. Click **Deploy**. After a minute or two you'll get a live address like
   `https://work-order-monitor.vercel.app` — that's your app.

## Step 4 — Invite your colleagues

Send them the Vercel URL. Each person creates their own account on the sign-in screen (or you
invite them directly from Supabase if you disabled open signups). Everyone who's signed in
sees the same shared work orders, live — no separate setup needed per person.

---

## Making changes later

Any time you want to change how the app looks or behaves, you can hand this whole project
back to me (or to Claude Code) and describe the change — I can edit the files directly.
After editing, push the updated files to the same GitHub repository and Vercel will
automatically redeploy the new version within a minute or two.

## Running it on your own computer first (optional)

If you want to preview it before deploying:

```
npm install
cp .env.example .env      # then fill in your Supabase URL and anon key
npm run dev
```

This opens the app at `http://localhost:5173`.
