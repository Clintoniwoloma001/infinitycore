# 🏦 Infinity Bank — Operations Platform (Vite + React + Supabase)

A production-grade banking operations platform with customer management (KYC), a rule-based loan approval engine, workflow automation (leave requests), role-based access control, audit logging, and an admin dashboard.

This is the **standalone Vite version** — it runs independently of the Base44 platform and uses **Supabase** (Postgres + Auth) as its backend.

> 💾 The Base44 admin dashboard has a **"Download Vite Build"** button that packages this entire `vite-app/` folder as a downloadable ZIP.

---

## ✨ Features

- **Customer Management** — KYC-ready fields (national ID, DOB, employment, income, credit score)
- **Loan Engine** — rule-based risk scoring → auto-approve / manager review / senior review
- **Status lifecycle** — Pending → Approved → Disbursed → Repaid
- **Workflow Engine** — leave requests with multi-level approval (≤3 days → manager, >3 days → senior/admin)
- **Role-Based Access Control** — Admin, Manager, Staff
- **Audit Logging** — every critical action is recorded
- **Email Notifications** — loan & leave decisions are emailed to the submitter (registered users)
- **Superadmin Auto-Promotion** — `tamunosikiiwolomaclinton@gmail.com` is auto-promoted to `admin` on signup/login
- **InfinityCore Branding** — custom logo across the sidebar, login, and auth screens
- **Configuration Failsafe** — missing Supabase env vars show an error screen instead of a blank UI
- **Admin Dashboard** — analytics, charts, user management
- **Mobile responsive** banking UI

---

## 🚀 Quick Start (5 steps)

### 1. Install Node.js
Download and install **Node.js 18 or higher** from <https://nodejs.org>.
Verify it installed:
```bash
node --version   # should print v18.x or higher
npm --version
```

### 2. Install dependencies
From inside the `vite-app` folder:
```bash
cd vite-app
npm install
```

### 3. Add your Supabase keys
1. Create a free project at <https://supabase.com>.
2. Go to **Project Settings → API** and copy:
   - `Project URL`
   - `anon` public key
3. Copy the example env file and fill in your values:
```bash
cp .env.example .env
```
Open `.env` and paste your keys:
```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

### 4. Create the database tables
Open your Supabase project → **SQL Editor → New query**, paste the SQL from
[`schema.sql`](./schema.sql) (also included at the bottom of this README),
and click **Run**. This creates all tables, the `profiles` table, RLS policies,
and triggers.

### 5. Run the app
```bash
npm run dev
```
Open <http://localhost:5173> in your browser. Sign up with any email/password —
new users get the `staff` role by default. The email
`tamunosikiiwolomaclinton@gmail.com` is auto-promoted to `admin` on signup/login.
For other accounts, promote yourself to `admin` in the `profiles` table
(Supabase dashboard → Table Editor) to access all features.

---

## 📁 Folder Structure

```
vite-app/
├── index.html              # HTML entry point
├── package.json            # Dependencies & scripts
├── vite.config.js          # Vite configuration
├── tailwind.config.js      # Tailwind CSS config
├── postcss.config.js       # PostCSS config (Tailwind + autoprefixer)
├── .env.example            # Template for environment variables
├── .env                    # Your real keys (NOT committed to git)
├── public/
│   └── favicon.svg
└── src/
    ├── main.jsx            # React entry point
    ├── App.jsx             # Router + auth gate (role-based routes)
    ├── index.css           # Tailwind directives + base styles
    ├── supabaseClient.js   # Supabase client (reads env vars)
    ├── components/
    │   └── Layout.jsx      # Sidebar navigation + topbar shell
    ├── pages/
    │   ├── Login.jsx
    │   ├── Dashboard.jsx
    │   ├── Customers.jsx
    │   ├── Loans.jsx
    │   ├── Repayments.jsx
    │   ├── LeaveRequests.jsx
    │   ├── AuditLogs.jsx
    │   └── Users.jsx
    ├── services/
    │   └── supabaseService.js   # Generic CRUD factory + audit helper
    ├── hooks/
    │   └── useAuth.js          # Supabase auth + role state
    └── lib/
        ├── loanScoring.js      # Rule-based risk scoring engine
        └── utils.jsx          # Formatters + StatusBadge component
```

---

## 🔌 Connecting Supabase

All data and authentication flow through a single Supabase client created in
[`src/supabaseClient.js`](./src/supabaseClient.js):

```js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

- **Auth**: Supabase Auth issues a JWT on sign-in; the session is persisted
  automatically. The `useAuth` hook reads the current user and their role from
  the `profiles` table.
- **Data**: Each entity is accessed through a generic service factory in
  `src/services/supabaseService.js` (list / create / update / delete).
- **Security**: Row-Level Security policies on every table enforce that users
  only see/edit what their role allows (see the SQL schema below).

### Environment variables
| Variable | Where to find it | Used for |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase dashboard → Settings → API | Client connection |
| `VITE_SUPABASE_ANON_KEY` | Supabase dashboard → Settings → API | Anonymous auth (safe for the browser) |

> ⚠️ Never commit your `.env` file. It is already in `.gitignore`.

---

## 🗄️ Database Schema (run this in Supabase SQL Editor)

```sql
-- 1. PROFILES (joins to auth.users, holds the role)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'staff' check (role in ('admin','manager','staff')),
  created_at timestamptz default now()
);

-- 2. CUSTOMERS
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  address text,
  date_of_birth date,
  national_id text,
  account_number text,
  employment_status text default 'employed',
  employer text,
  monthly_income numeric default 0,
  credit_score numeric default 0,
  status text default 'pending',
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- 3. LOAN APPLICATIONS
create table if not exists public.loan_applications (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id),
  customer_name text,
  amount numeric not null,
  purpose text,
  term_months int not null,
  interest_rate numeric default 12,
  employment_status text default 'employed',
  monthly_income numeric default 0,
  monthly_expenses numeric default 0,
  existing_debt numeric default 0,
  repayment_history_score numeric default 50,
  risk_score numeric,
  risk_level text,
  approval_route text,
  status text default 'pending',
  reviewed_by_name text,
  reviewed_date timestamptz,
  approval_comments text,
  disbursed_date date,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- 4. LOANS (disbursed loans)
create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  application_id uuid,
  customer_id uuid,
  customer_name text,
  principal_amount numeric,
  outstanding_balance numeric,
  interest_rate numeric,
  term_months int,
  monthly_payment numeric,
  status text default 'active',
  disbursed_date date,
  maturity_date date,
  created_at timestamptz default now()
);

-- 5. REPAYMENTS
create table if not exists public.repayments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid,
  customer_id uuid,
  customer_name text,
  amount numeric not null,
  due_date date,
  payment_date date,
  status text default 'pending',
  payment_method text,
  created_at timestamptz default now()
);

-- 6. LEAVE REQUESTS (workflow engine)
create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_name text,
  leave_type text default 'annual',
  start_date date,
  end_date date,
  days int,
  reason text,
  status text default 'pending',
  approval_level int default 1,
  approved_by_name text,
  approved_date timestamptz,
  approval_comments text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- 7. AUDIT LOGS
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  entity_type text,
  entity_id text,
  user_name text,
  details text,
  severity text default 'info',
  created_at timestamptz default now()
);

-- 8. NOTIFICATIONS
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  title text not null,
  message text,
  type text default 'system',
  read boolean default false,
  link text,
  created_at timestamptz default now()
);

-- Auto-create a profile row when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Enable Row-Level Security
alter table public.profiles        enable row level security;
alter table public.customers       enable row level security;
alter table public.loan_applications enable row level security;
alter table public.loans           enable row level security;
alter table public.repayments      enable row level security;
alter table public.leave_requests  enable row level security;
alter table public.audit_logs      enable row level security;
alter table public.notifications  enable row level security;

-- Helper: current user's role
create or replace function public.current_role()
returns text language sql stable as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'staff');
$$;

-- PROFILES policies
create policy "profiles read own or admin" on public.profiles
  for select using (auth.uid() = id or public.current_role() = 'admin');
create policy "profiles update own or admin" on public.profiles
  for update using (auth.uid() = id or public.current_role() = 'admin');

-- CUSTOMERS — all authenticated staff read; managers/admins write
create policy "customers read" on public.customers
  for select using (auth.role() = 'authenticated');
create policy "customers insert" on public.customers
  for insert with check (auth.role() = 'authenticated');
create policy "customers update" on public.customers
  for update using (public.current_role() in ('admin','manager'));
create policy "customers delete" on public.customers
  for delete using (public.current_role() = 'admin');

-- LOAN APPLICATIONS — staff submit; managers/admins approve
create policy "loan_apps read" on public.loan_applications
  for select using (auth.role() = 'authenticated');
create policy "loan_apps insert" on public.loan_applications
  for insert with check (auth.role() = 'authenticated');
create policy "loan_apps update" on public.loan_applications
  for update using (created_by = auth.uid() or public.current_role() in ('admin','manager'));
create policy "loan_apps delete" on public.loan_applications
  for delete using (public.current_role() = 'admin');

-- LOANS — managers/admins manage
create policy "loans read" on public.loans
  for select using (auth.role() = 'authenticated');
create policy "loans write" on public.loans
  for all using (public.current_role() in ('admin','manager'))
  with check (public.current_role() in ('admin','manager'));

-- REPAYMENTS — managers/admins manage
create policy "repayments read" on public.repayments
  for select using (auth.role() = 'authenticated');
create policy "repayments write" on public.repayments
  for all using (public.current_role() in ('admin','manager'))
  with check (public.current_role() in ('admin','manager'));

-- LEAVE REQUESTS — own or manager/admin
create policy "leave read" on public.leave_requests
  for select using (created_by = auth.uid() or public.current_role() in ('admin','manager'));
create policy "leave insert" on public.leave_requests
  for insert with check (auth.role() = 'authenticated');
create policy "leave update" on public.leave_requests
  for update using (created_by = auth.uid() or public.current_role() in ('admin','manager'));
create policy "leave delete" on public.leave_requests
  for delete using (public.current_role() = 'admin');

-- AUDIT LOGS — admin only
create policy "audit read" on public.audit_logs
  for select using (public.current_role() = 'admin');
create policy "audit insert" on public.audit_logs
  for insert with check (auth.role() = 'authenticated');

-- NOTIFICATIONS — owner only
create policy "notif read"   on public.notifications for select using (user_id = auth.uid());
create policy "notif insert" on public.notifications for insert with check (auth.role() = 'authenticated');
create policy "notif update" on public.notifications for update using (user_id = auth.uid());
create policy "notif delete" on public.notifications for delete using (user_id = auth.uid());
```

---

## 🛡️ Loan Risk Scoring Engine

The scoring logic lives in [`src/lib/loanScoring.js`](./src/lib/loanScoring.js)
and is identical to the Base44 version. It weights three factors:

| Factor | Weight |
|---|---|
| Income-to-loan affordability (disposable income ÷ monthly payment) | 45% |
| Employment status | 25% |
| Repayment history score | 30% |

The composite score (0–100) maps to a risk level and approval route:

| Score | Risk | Route |
|---|---|---|
| ≥ 75 | **Low** | Auto-approve |
| 50–74 | **Medium** | Manager approval |
| < 50 | **High** | Senior (admin) review |

---

## 👤 Roles & Permissions

| Capability | Staff | Manager | Admin |
|---|:---:|:---:|:---:|
| View dashboard & customers | ✅ | ✅ | ✅ |
| Submit loan / leave requests | ✅ | ✅ | ✅ |
| Approve medium-risk loans | ❌ | ✅ | ✅ |
| Approve high-risk loans / >3-day leave | ❌ | ❌ | ✅ |
| Disburse loans & record repayments | ❌ | ✅ | ✅ |
| Manage users & roles | ❌ | ❌ | ✅ |
| View audit logs | ❌ | ❌ | ✅ |

---

## ☁️ Deployment

### Vercel
1. Push this `vite-app` folder to a GitHub repository.
2. In Vercel → **New Project** → import the repo.
3. Set the **Root Directory** to `vite-app`.
4. Framework preset: **Vite** (auto-detected). Build: `npm run build`, output: `dist`.
5. Add environment variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
6. Deploy.

### Netlify
1. Push to GitHub.
2. Netlify → **Add new site** → import the repo. Base directory: `vite-app`.
3. Build command: `npm run build`. Publish directory: `dist`.
4. Add the same environment variables under **Site settings → Environment variables**.
5. Deploy.

> In Supabase → **Authentication → URL Configuration**, add your deployed URL
> to the **Site URL** and redirect allow-list so auth redirects work in production.

---

## 🛠️ Troubleshooting

**`Missing Supabase env vars` warning in the console**
→ You haven't created `.env` or the values are empty. Copy `.env.example` to
`.env` and fill in your real keys, then restart `npm run dev`.

**Blank page / "Invalid API key"**
→ Double-check the anon key is the **public/anon** key, not the service_role
key. The service_role key bypasses RLS and must never be in the browser.

**Can't see all menu items / "Access denied"**
→ Your user has the default `staff` role. In the Supabase dashboard →
**Table Editor → profiles**, change your row's `role` to `admin` and refresh.

**Sign-up works but login fails**
→ Supabase may require email confirmation. Either confirm via the email, or
disable "Confirm email" under **Authentication → Providers → Email** for local
testing.

**RLS blocks everything (empty tables even as admin)**
→ Make sure you ran the full SQL block including the `create policy` statements
and that your profile row exists with `role = 'admin'`.

**Changes not showing after editing `.env`**
→ Vite only reads env vars at startup. Stop the dev server (`Ctrl+C`) and run
`npm run dev` again.

**Port 5173 already in use**
→ Run `npm run dev -- --port 3000` to use another port.

---

## 📜 Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the local dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build locally |

---

## 📄 License

Internal project for Infinity Bank. All rights reserved.