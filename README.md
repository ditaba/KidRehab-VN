# KidRehab

Pediatric rehabilitation management platform (MVP) for clinics. The goal is to make pediatric rehabilitation progress measurable.

The core loop is **Patient → Assessment → Treatment Plan → Measurable Goal → Therapy Session → Measurement → Progress Chart**.

```
apps/
  api/   NestJS 11 · Prisma 6 · PostgreSQL · JWT access + rotating refresh tokens · RBAC
  web/   Next.js 15 (App Router) · React 19 · Tailwind · TanStack Query · React Hook Form + Zod · Recharts
```

The frontend and backend deploy independently. The browser calls `/api/*` on the web origin, and Next.js proxies it to `API_URL`. This keeps the refresh-token cookie first-party and `httpOnly`.

---

## Quick start

Requirements: Node 20+ and PostgreSQL 14+ (or Docker).

```bash
# 1. Database
docker compose up -d postgres                # or use any local PostgreSQL

# 2. Install
npm install

# 3. Configure
cp apps/api/.env.example apps/api/.env       # set DATABASE_URL / JWT_ACCESS_SECRET
cp apps/web/.env.example apps/web/.env.local # API_URL (default http://localhost:4000)

# 4. Schema + demo data
npm run db:deploy                            # apply migrations
npm run db:seed                              # WARNING: wipes and reloads demo data

# 5. Run (API :4000, web :3000)
npm run dev
```

Open http://localhost:3000.

### Demo accounts (password `Password123!`)

| Email | Role |
|---|---|
| `admin@kidrehab.vn` | Admin |
| `doctor@kidrehab.vn` | Doctor |
| `therapist1@kidrehab.vn` | Therapist (Tran Minh Chau, owns the demo patient) |
| `therapist2@kidrehab.vn` | Therapist (Le Thu Ha) |
| `reception@kidrehab.vn` | Receptionist |
| `doctor@other-clinic.vn` | Doctor in a second clinic, used to demonstrate data isolation |

The seed contains:

- 1 clinic.
- Staff for every role.
- 10 patients across all statuses.
- 8 exercise templates, one of them disabled.
- Completed sessions with measurements.
- Appointments for today and the next two weeks, plus missed (no-show) ones.

**Demo patient: Nguyen Van A (KR-0001).** Age 5, cerebral palsy.

- Thời gian đứng (standing duration): 5 → 9 → 15 → 19 → **22 s** (target 30, 68%).
- Quãng đường đi (walking distance): 2 → **8 m** (target 10, 75%).

Demo content (diagnoses, plans, goals, exercises, notes) is in Vietnamese, as a Vietnamese clinic would enter it.
- Today's schedule: 08:00 Nguyen Van A, 09:00 Tran Thi B, 10:00 Le Van C.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | API (watch) + web (dev) |
| `npm run build` | Production builds of both apps |
| `npm run db:migrate` | `prisma migrate dev` (create migrations while developing) |
| `npm run db:deploy` | `prisma migrate deploy` (apply migrations) |
| `npm run db:seed` | Reset data and load the demo seed |
| `npm test` | Unit tests (API: Jest, web: Vitest) |
| `npm run test:e2e` | API end-to-end tests against PostgreSQL (see below) |
| `npm run typecheck` | TypeScript checks for both apps |

### End-to-end tests

The e2e suite boots the full Nest app against a **separate** database. It applies the migrations and loads the seed before running. The seed deletes all existing rows, so the setup refuses to run unless the database name contains `test`.

```bash
createdb kidrehab_test
DATABASE_URL_TEST="postgresql://postgres:postgres@localhost:5432/kidrehab_test?schema=public" npm run test:e2e
```

The suite covers:

- Authentication: invalid-credential message, refresh rotation and reuse detection, logout.
- RBAC for every role.
- Clinic isolation and therapist assignment scoping.
- Validation.
- The full core loop, through to goal current-value updates and progress percentages.
- Appointment conflict detection.
- Exercise template immutability.
- Audit logs.

---

## Roles & permissions

| | Admin | Doctor | Therapist | Receptionist |
|---|:-:|:-:|:-:|:-:|
| View patients | all | all | **assigned only** | all (demographics only) |
| Create patient / edit demographics / guardians | ✓ | ✓ | – | ✓ |
| Patient status, medical notes, diagnoses | ✓ | ✓ | – | – |
| View assessments, plans, goals, sessions, progress | ✓ | ✓ | ✓ | – |
| Create/edit assessments, treatment plans, goals | – | ✓ | – | – |
| Create/document/complete sessions, record measurements | – | ✓ | ✓ (own sessions) | – |
| Create/edit appointments | ✓ | ✓ | view | ✓ |
| Exercise library (create/edit/disable) | ✓ | ✓ | view | – |
| Users, clinic settings, audit log (API) | ✓ | – | – | – |

How the API enforces this:

- **Authentication.** A global `JwtAuthGuard` checks the token on every route.
- **Roles.** `@Roles(...)` on each route, checked by `RolesGuard`.
- **Patient scoping.** `AccessService` scopes every patient-related query to the caller's clinic. Therapists are further limited to patients they are the primary therapist for, or have an appointment or session with.
- **No existence leaks.** Records from another clinic return `404`, so their existence is never revealed.

The UI mirrors these rules in `apps/web/src/lib/permissions.ts`, but it only hides actions — the API is the source of truth.

A `PARENT` role and `Guardian.userId` are reserved so the Parent Portal can be added later. Parent accounts cannot log in to the staff app.

---

## Key behaviours

- **Progress.** `(current − baseline) / (target − baseline) × 100`, clamped to 0–100% in the UI.
  - Each goal and metric has a direction, `INCREASE_IS_BETTER` or `DECREASE_IS_BETTER` (for example head-tilt angle).
  - The target is validated against that direction.
  - The calculation lives in `apps/api/src/common/progress.ts`.
- **Goals and metrics.** Creating a goal creates its `ProgressMetric`. A goal can instead attach an existing metric of the patient through `progressMetricId`, which keeps its measurement history.
- **Sessions.**
  - Sessions start as `DRAFT`.
  - Observations, exercises and measurements are autosaved as the therapist taps.
  - Recording the same metric twice in one session corrects the value; it does not duplicate it.
  - **Completing** a session does four things:
    1. Sets it to `COMPLETED`.
    2. Updates each measured goal's `currentValue` from the latest measurement among completed sessions.
    3. Moves `NOT_STARTED` goals to `IN_PROGRESS`.
    4. Marks the linked appointment `COMPLETED`.
  - `ACHIEVED`, `PAUSED` and `CANCELLED` remain clinician decisions; nothing is changed automatically beyond the measured value.
  - Completed sessions are read-only. Draft measurements never appear in progress charts.
- **Exercises.** Adding an exercise to a session copies its default prescription. Editing sets, reps or seconds in the session never changes the template. Templates are disabled, never deleted, so history is preserved.
- **Treatment plans.**
  - A patient can have many historical plans.
  - Activating a plan moves any other `ACTIVE` plan to `COMPLETED`.
- **Appointments.**
  - Duration defaults to the clinic setting (45 min).
  - Overlapping appointments for the same therapist return `409 THERAPIST_OVERLAP` with the list of clashes. The UI shows a warning and offers **Book anyway** (`force: true`).
- **Dashboard.** The four figures are counted in the clinic's timezone (default `Asia/Ho_Chi_Minh`):
  - **Active Patients:** patients with status Active.
  - **Today's Sessions:** today's appointments.
  - **Need Reassessment:** patients with no assessment within `reassessmentIntervalDays` (90), or whose plan review date has passed.
  - **Missed Appointments:** no-shows, plus past appointments that were never documented, over the last 30 days.

  The web UI displays times in the device's timezone.
- **Audit.**
  - Clinical entities store `createdAt/createdBy/updatedAt/updatedBy`.
  - `AuditLog` records user, action, entity, entityId and timestamp for creates, updates, completions, logins and logouts.
  - `GET /audit-logs` is admin-only.
- **Clinical safety.** There is no diagnosis, automatic prescription or AI-generated content. All goal and plan changes are explicit clinician actions.

## Security

- Passwords are hashed with bcrypt. Logins take the same time whether or not the email exists. Password hashes are never selected into responses.
- The access token is short-lived (15 min) and kept **in memory only** by the web app.
- The refresh token is random, stored **hashed**, rotated on every use, and revoked as a family when it is reused. It is sent as an `httpOnly`, `SameSite=Lax` cookie; set `COOKIE_SECURE=true` behind HTTPS.
- Every DTO is validated with `class-validator` (`whitelist` + `forbidNonWhitelisted`). Prisma parameterises all queries.
- `helmet` headers are set. CORS uses an allow-list (`CORS_ORIGINS`) and is only needed for cross-origin clients. `trust proxy` is enabled so the app can sit behind TLS-terminating proxies.

## REST API

All routes except `/auth/login`, `/auth/refresh`, `/auth/logout` and `/health` require `Authorization: Bearer <token>`.

```
POST   /auth/login | /auth/refresh | /auth/logout      GET /auth/me
GET    /dashboard
GET    /patients?search&status&therapistId&diagnosis&page&pageSize
POST   /patients                 GET|PATCH /patients/:id
POST   /patients/:id/guardians   PATCH|DELETE /guardians/:id
POST   /patients/:id/diagnoses   PATCH|DELETE /diagnoses/:id
GET|POST /patients/:id/assessments           GET|PATCH /assessments/:id
GET|POST /patients/:id/treatment-plans       PATCH /treatment-plans/:id
POST   /treatment-plans/:id/goals            PATCH /goals/:id
GET    /sessions/today?therapistId           GET /sessions?status&therapistId&patientId
GET|POST /patients/:id/sessions              GET|PATCH /sessions/:id
POST   /sessions/:id/complete
POST   /sessions/:id/exercises               PATCH|DELETE /sessions/:id/exercises/:seId
POST   /sessions/:id/measurements            DELETE /sessions/:id/measurements/:mid
GET    /patients/:id/progress
GET    /appointments?from&to&therapistId&patientId&status
POST   /appointments             PATCH /appointments/:id
GET|POST /exercises              PATCH /exercises/:id
GET|POST /users                  PATCH /users/:id         GET|PATCH /clinic
GET    /audit-logs               GET /health
```

## Language

The web UI is in Vietnamese by default, with English available from the language switch in the sidebar (and on the sign-in page). The choice is stored in the `kidrehab-locale` cookie so the server renders the right language on the first paint.

- UI strings live in `apps/web/src/lib/i18n/messages/<namespace>.ts`, declared with `defineMessages(en, vi)`; a missing Vietnamese key is a type error, and `i18n.test.ts` checks both tables have the same keys and placeholders.
- Components use `const t = useT()` and `t('patients.title')`; enum values (roles, statuses, categories…) are labelled through `messages/enums.ts`.
- Dates and times use `vi-VN` / `en-GB` formatting. The API still answers in English; known API error messages are translated in `lib/api.ts`.
- Clinical data entered by staff (names, diagnoses, exercise names, notes) is shown as entered.

## Web pages

The following pages exist:

- `/login`
- `/dashboard`
- `/patients`
- `/patients/new`
- `/patients/[id]` (overview)
- `/patients/[id]/assessment`
- `/patients/[id]/treatment`
- `/patients/[id]/sessions`
- `/patients/[id]/progress`
- `/sessions` (today and history)
- `/sessions/[id]` (session documentation, optimised for tablets)
- `/calendar` (day, week and month views)
- `/exercises`

Every page has loading, error and empty states. Interactive controls are at least 44 px. Layouts target desktop and tablet, and also work on phones.

## Deployment notes

- **API.**
  1. `npm run build -w apps/api`
  2. `npm run prisma:deploy -w apps/api`
  3. `node apps/api/dist/main.js`

  Required environment variables:
  - `DATABASE_URL`
  - `JWT_ACCESS_SECRET` (a long random value)
  - `COOKIE_SECURE=true`
- **Web.** Run `npm run build -w apps/web`, then `npm start -w apps/web`, with `API_URL` pointing at the API's internal URL.
- **TLS.** Terminate TLS at your load balancer or reverse proxy.

## Out of scope (per PRD)

The MVP does not include:

- Billing, insurance, payroll or inventory.
- Hospital (HIS) integration or telemedicine.
- Native mobile apps.
- AI diagnosis or treatment recommendations.
- Parent Portal (the schema is prepared for it).
- Media uploads (S3 storage is planned).
