# HLPI Facilities CMMS

A maintenance management system (CMMS), in the style of Limble, for **HAVI Logistics Philippines
facilities and material handling equipment (MHE)**. Delivery fleet (trucks, trailers, reefer units)
is deliberately left out.

Everyone signs in to the same live, shared data from a desk or a phone.

| Module | What it does |
|---|---|
| **Dashboard** | Open and overdue work, PM compliance, MHE availability, mean time to repair, weekly throughput, backlog age, repeat-failure assets, parts to reorder, expiring permits and contracts |
| **Work orders** | List and board views, task checklists, labour hours, parts issued from stock, contractor cost, activity log, printable job card, close-out with cause, downtime and hour-meter reading |
| **Requests** | Anyone can report a problem. An admin approves it into a work order or rejects it with a reason |
| **Preventive maintenance** | Schedules by calendar (daily to yearly, fixed or floating) or by hour meter (e.g. every 250 h). Work orders are created automatically before they fall due. 90-day forecast |
| **MHE** | Board of reach trucks, forklifts, pallet trucks, stackers, order pickers and lifts, showing lockout status, hour meter, today's pre-use check, next service and inspection-certificate expiry. Batteries and chargers are tracked too |
| **MHE pre-use checks** | Phone-friendly daily checklists. A failed item raises a work order automatically. A failed **critical** item (brakes, horn, forks…) **locks the unit out** until a technician returns it to service |
| **Assets** | Site → location → asset register with categories, criticality, warranty and cost history, status history and hour-meter readings |
| **Parts & stock** | Spares with bin, min/max and cost. Every receive, issue, return and adjustment is kept in a stock ledger |
| **Vendors & contracts** | Service providers and contract periods, with renewal warnings |
| **Compliance** | Register of permits, certificates, tests and reports (BFP FSIC, DENR permits, electrical inspection, water tests, fire drills, FSSC 22000 audit…) with renewal history |
| **Settings** | Users and roles, sites and locations (including cold-chain temperature zones), asset categories, pre-use checklist editor, labour rate |

### Who can do what

| Role | Access |
|---|---|
| **Admin / Manager** | Everything, including approving requests, managing users, vendors, contracts and compliance |
| **Technician** | Work orders, PM schedules, assets, parts and pre-use checks. Cannot approve requests or manage users |
| **Requester** | Report problems, run MHE pre-use checks, and follow their own requests. Sees nothing else |

These rules are enforced inside the database (row-level security), not just hidden in the screens.
The **first person to sign up becomes the admin**. Everyone after that starts as a Requester until an
admin changes their role in **Settings → Users & roles**.

---

## Setting it up

It's the same stack as before: a React front end on Vercel and a free Supabase database. It takes
about 20 minutes and no coding.

### Step 1: Create the database (Supabase)

1. Go to **supabase.com** → **New project**. Use a **new project** for the CMMS (recommended), and
   save the database password somewhere safe.
2. Open **SQL Editor → New query**, paste the whole of `supabase/schema.sql`, and click **Run**.
   This creates every table, the automatic rules (PM generation, lockouts, stock ledger) and the
   security rules. It is safe to run again later.
3. Open **Project Settings → API** and copy the **Project URL** and the **anon public** key.

### Step 2: Deploy the app (Vercel)

1. In Vercel, open the existing project for this repository, or **Add New → Project** and select it.
2. Under **Settings → Environment Variables**, set:
   - `VITE_SUPABASE_URL` → the Project URL
   - `VITE_SUPABASE_ANON_KEY` → the anon public key
3. Redeploy. You get an address like `https://hlpi-cmms.vercel.app`.
4. Back in Supabase, open **Authentication → URL Configuration** and set **Site URL** to that address,
   so sign-up confirmation and password-reset emails link back to the app.

### Step 3: Sign in and set up

1. Open the app and **Create an account**. The first account is the admin.
2. *Optional, to explore first:* in the SQL Editor, run `supabase/seed_demo.sql`. It loads a sample
   "Plaridel DC" with about 60 assets (reach trucks, electric pallet trucks, forklifts, freezer
   condensing units, dock levelers, genset, fire systems), PM schedules, parts, fictional vendors, a
   compliance register and 12 weeks of history.
3. When you're ready to go live, run `supabase/reset_data.sql` to clear the sample data. It keeps
   users, categories and checklists. Then enter your own data under **Settings → Sites & locations**,
   **Assets**, **PM**, **Parts**, **Vendors** and **Compliance**.
4. Send colleagues the link. They create their own accounts. Promote technicians in
   **Settings → Users & roles**. Warehouse staff and MHE operators can stay as Requesters.

To stop open sign-ups, go to Supabase → **Authentication → Providers → Email** and turn off
"Allow new users to sign up", then invite people from **Authentication → Users**.

### Optional: daily PM generation even when nobody logs in

The app creates due PM work orders whenever a technician or admin opens it. To also have it happen
at 05:50 every morning, enable the **pg_cron** extension (Supabase → Database → Extensions) and run
`supabase/cron.sql` once.

---

## Coming from the old Work Order Monitor

- **New Supabase project (recommended):** nothing to migrate. To keep old records, export them to
  CSV from the old app first.
- **Same Supabase project:** `schema.sql` renames the old `work_orders` table to
  `work_orders_legacy` instead of deleting it. After creating your site in the app, run
  `supabase/import_legacy.sql` to copy the old work orders across. Their codes are kept, and
  facilities become locations.

---

## How the automatic parts behave

- **PM schedules:** a work order is created `lead days` before the due date, or when the hour meter
  is within `lead hours` of the service. Only one open work order per schedule exists at a time.
  Completing or cancelling it moves the schedule to the next date: **Fixed** keeps the calendar
  cycle, **Floating** counts from the completion date. Hour-meter schedules restart from the reading
  entered at completion.
- **Pre-use checks:** hour-meter readings update the asset. Any failed item raises a *High* work order
  and flags the unit *Needs Attention*. A failed **critical** item raises a *Critical* work order and
  sets the unit *Out of Service*. Operators can't start a check on a locked-out unit. When a
  technician completes the work order, they tick "Return to service".
- **Stock:** quantities change only through stock movements. Issuing a part to a work order charges
  its cost to that job, and returns credit it back. Only admins can make count adjustments.
- **Costs:** labour uses the standard rate in **Settings → General**, plus parts and contractor cost.

---

## For developers

```
npm install
cp .env.example .env      # fill in your Supabase URL and anon key
npm run dev               # http://localhost:5173
npm test                  # unit tests for KPIs, dates and PM maths
```

`scripts/test-db.sh` runs the schema (twice), 52 behaviour tests for roles, security and
triggers, the demo seed, the reset and the upgrade path from the old app against a local Postgres
(`PGHOST=/tmp PGPORT=5432 PGUSER=postgres scripts/test-db.sh`).

Code map: `src/pages/` (one file per screen), `src/components/` (shared UI, charts, layout),
`src/data/` (loading, live updates and saving), `src/lib/` (dates, KPIs, domain rules), and
`supabase/` (database).
