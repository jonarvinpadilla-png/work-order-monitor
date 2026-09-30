# HLPI Facilities CMMS

A maintenance management system (CMMS), in the style of Limble, for **HAVI Logistics Philippines
facilities and material handling equipment (MHE)**. Delivery fleet (trucks, trailers, reefer units)
is deliberately left out.

It runs on **one PC at the site**. Everyone else (office PCs, technicians' phones, MHE operators
doing pre-use checks) opens it in a browser over the site network and works on the same live data.
There is no cloud service to sign up for: no Vercel, no Supabase, and no internet needed.

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
| **QR labels** | Printable stickers for assets and places. Scanning one with a phone opens that unit to report a problem, run the pre-use check or start a work order |
| **Settings** | Users and roles, sites and locations (including cold-chain temperature zones), asset categories, pre-use checklist editor, labour rate, QR label address, backups |

### Who can do what

| Role | Access |
|---|---|
| **Admin / Manager** | Everything, including approving requests, managing users, vendors, contracts and compliance |
| **Technician** | Work orders, PM schedules, assets, parts and pre-use checks. Cannot approve requests or manage users |
| **Requester** | Report problems, run MHE pre-use checks, and follow their own requests. Sees nothing else |

### Look and feel

Warehouse illustrations run from sign-in to the main screens. The sign-in screen shows a freezer
aisle with a reach truck at work, sign-up and first-run setup show the loading docks, and choosing a
new password shows the battery charging room. The loading screen continues the freezer aisle. The dashboard opens with a
cutaway of the DC (office, dry, chiller, freezer and docks) that shows **live open-job counts per
zone** and switches between day and night with the light/dark theme. Each MHE type (reach truck,
forklift, pallet truck, stacker, order picker, scissor lift and more) has its own drawing on the MHE
board and the pre-use check. To use real site photos on the sign-in screens or requester home
instead, see `src/photos/README.md`.

These rules are enforced by the CMMS server on every request, not just hidden in the screens. The
**first account, created on the server PC, is the admin**. The admin adds people with a temporary
password, or lets them create their own Requester account on the sign-in page, and changes roles in
**Settings → Users & roles**.

---

## Setting it up

You need one Windows PC that stays on during every shift and is on the same network (Wi-Fi) as the
phones and PCs that will use the CMMS. Setting up takes about 10 minutes and no coding.

### Step 1: Get the package

Download the latest **HLPI-CMMS** package:

- from this repository's **Releases** page (`HLPI-CMMS-<version>-win-x64.zip`), or
- from **Actions → Test and package →** the latest run on `main` **→ Artifacts → HLPI-CMMS-windows**.

Before unzipping, right-click the zip → **Properties → Unblock** so Windows doesn't warn about each
file. Unzip it somewhere permanent, for example `C:\HLPI-CMMS`.

### Step 2: Start it

Double-click **Start HLPI CMMS**. A black window opens and your browser shows the CMMS. The first
time, Windows may ask:

- *"Do you want to run this file?"* or *"Windows protected your PC"*: choose **Run** (or **More info →
  Run anyway**).
- **Windows Defender Firewall** about *Node.js JavaScript Runtime*: tick **Private networks** and click
  **Allow access** (needs admin rights). This is what lets phones and other PCs reach the CMMS.

Keep the black window open; closing it stops the CMMS for everyone. To start it automatically with
Windows, see `README.txt` in the package.

### Step 3: Create the admin account and your team

1. In the browser on the server PC, create the admin account. (For safety this only works on the
   server PC itself.)
2. *Optional, to explore first:* click **Load sample data** on the dashboard. It adds a sample
   "Plaridel DC" with about 60 assets (reach trucks, electric pallet trucks, forklifts, freezer
   condensing units, dock levelers, genset, fire systems), PM schedules, parts, fictional vendors, a
   compliance register and 12 weeks of history. When you're ready to go live, remove it in
   **Settings → General → Remove all data** (it keeps users, settings, categories and checklists).
3. Add your site and locations, then people in **Settings → Users & roles → Add person**. Each person
   gets a temporary password and chooses their own the first time they sign in.

### Step 4: Open it on phones and other PCs

The black window, and **Settings → General**, list addresses such as `http://192.168.1.20:8080`.
Open one on any phone or PC on the same network and bookmark it (on phones, *Add to Home screen*).
Ask IT to reserve a fixed IP address for the server PC so the address never changes.

### Step 5: Put QR labels on equipment and rooms

Scanning a label with a phone's camera opens that unit in the CMMS. People can then report a problem
(already filled in with the unit and its location) or run the MHE pre-use check. Technicians and
admins can also start a work order or open the asset record. A locked-out unit shows its lockout
warning instead of the pre-use check. Labels for rooms and areas (canteen, docks, comfort rooms)
open a page for reporting a problem there, listing the equipment in that place.

1. In **Settings → General**, set **Address on QR labels** to the fixed address phones use, for
   example `http://192.168.1.20:8080`. Every label contains it, so labels stop working if it changes.
2. Open **Assets → QR labels** (or **QR label** on an asset, **QR labels** on the MHE board, or the
   tag icon next to a location in **Settings → Sites & locations**).
3. Tick the assets and places, choose **Small** (21 per A4 sheet, 63.5 × 38.1 mm) or **Large**
   (8 per sheet, 99.1 × 67.7 mm), and print at 100% (*Actual size*). The sheets match common A4
   label sheets such as Avery L7160 and L7165. Plain paper cut along the guides works too.

Scanning works with the phone's normal camera; nothing needs installing. People sign in once per
phone, and after that a scan goes straight to the unit. Links look like `…/#/u/RT-04` (by asset tag,
so reprint a label after changing a tag) and `…/#/p/<place id>`.

### Your data and backups

Everything lives in the `data` folder next to **Start HLPI CMMS**: `data\cmms.db` is the database, and
`data\backups\` gets a copy every night at 00:30 (the newest 14 are kept). Copy the backups to another
drive or a shared folder regularly. Admins can also **Back up now** or **Download a copy** under
**Settings → General**.

To restore: close the black window, delete `data\cmms.db-wal` and `data\cmms.db-shm` if they exist, copy
the backup over `data\cmms.db`, and start again.

To update to a new version, close the black window and unzip the new package over the old folder.
The `data` folder isn't in the package, so your records stay.

### Passwords and access

- Passwords are stored as salted scrypt hashes. After too many wrong attempts, sign-in pauses for 15
  minutes.
- There is no email, so **Forgot password** asks people to see an admin, who sets a temporary password
  in **Settings → Users & roles**. That signs the person out everywhere, and they choose a new password
  at their next sign-in.
- To stop self sign-up, untick it in **Settings → General**. To lock someone out, deactivate them.
- The CMMS uses plain HTTP inside your network, as most in-house tools do. It only answers to IP
  addresses, `localhost` and the PC's own name. If IT gives the PC a DNS name, add it to
  `CMMS_ALLOWED_HOSTS` in **Start HLPI CMMS.bat**.

---

## Coming from the old Work Order Monitor

The old app kept its work orders in Supabase. This version doesn't read from Supabase, so to keep old
records, export them from the Supabase table editor to CSV before you shut that project down. The
Vercel deployment is switched off in `vercel.json`. Once you no longer need the old site, delete
the project in Vercel and pause or delete the Supabase project.

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
- **Every morning at 05:50** (and whenever the server starts or a technician opens the app) the server
  creates the PM work orders that have come due. **Every night at 00:30** it saves a backup.

---

## For developers

Node.js 22.13 or newer (24 LTS recommended). The server uses only Node's built-in modules, including
its built-in SQLite, so there's no database to install.

```
npm install
npm run server      # CMMS server on http://localhost:8080 (data in ./data), restarts on changes
npm run dev         # web app with hot reload on http://localhost:5173, /api goes to the server
npm test            # unit tests plus server tests: rules, permissions, accounts, HTTP, sample data
npm run build       # build the web app into dist/
npm start           # production mode: the server also serves dist/
npm run package     # Windows package in release/ (downloads a checksum-verified Node.js runtime)
```

Server options: `--port`, `--data <folder>`, `--open`; environment `PORT`, `CMMS_DATA_DIR`,
`CMMS_ALLOWED_HOSTS` and `CMMS_REMOTE_SETUP=1` (create the first admin from another device, e.g. on
a headless server).

Code map: `src/pages/` (one file per screen), `src/components/` (shared UI, charts, layout),
`src/data/` (API client, loading, live updates), `src/lib/` (dates, KPIs, domain rules),
`src/illustrations/` (hand-built SVG scenes and MHE drawings), and `server/`: `schema.sql` (tables),
`rules.js` (business rules: codes, approvals, stock ledger, PM roll-forward, pre-use lockout),
`access.js` (who can see and change what), `auth.js` (accounts and sessions), `app.js` (HTTP API,
live updates, static files), `demo.js` (sample data) and `test/`.
