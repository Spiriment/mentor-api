# Admin backend — implementation plan

This plan aligns with [ADMIN_PORTAL_SPECIFICATION.md](./ADMIN_PORTAL_SPECIFICATION.md) (Parts B–E) and the `/api/admin` surface in Part D.

## Guiding decisions (lock these early)

1. **Admin identity** — Separate admin accounts vs elevated app users (`adminRole` on `User`). Drives login, JWT claims, and whether spiriment-admin reuses `/api/auth` or uses `/api/admin/auth/*`.
2. **RBAC** — Enforce Part C on every route; “authenticated app user” is not enough for admin APIs.
3. **Legacy paths** — Today `GET /api/mentor-profiles/admin/pending` and `POST /api/mentor-profiles/:userId/approve` exist. Plan: implement Part D under `/api/admin/mentor-applications/*`, then deprecate old paths (same middleware + services underneath).

## Phase 0 — Skeleton (done)

- Module root: `src/admin/` with composed router mounted at `/api/admin` (see `src/admin/router.ts`).
- Stub handlers return `501` until implemented (clear JSON error).

## Phase 1 — Security foundation (done)

- **Separate admin accounts** in table `admin_users` (email, bcrypt password, `super_admin` | `support`). Migration: `1770300000000-CreateAdminUsersAndAuditLogs.ts`.
- **Auth**: `POST /api/admin/auth/login`, `POST /api/admin/auth/refresh`, `POST /api/admin/auth/logout` (body: `{ refreshToken }`). Access token is a dedicated admin JWT (`typ: admin`); refresh uses `typ: admin_refresh` and is stored in `refresh_tokens` with `userType: admin`.
- **Middleware**: `createAdminAuthMiddleware(jwt)` loads `AdminUser` and sets `req.admin`. Use `requireAdminRole(...ADMIN_ROLE)` on routes that are Super Admin only (Part C).
- **Protected**: All `/api/admin/*` except `/auth/*` require `Authorization: Bearer <accessToken>`. **Breaking:** `POST /api/admin/broadcast-push` now requires a valid admin token.
- **Audit**: table `admin_audit_logs` + `adminAuditService.log()`. Successful logins and broadcast-push are logged.
- **Rate limits**: `express-rate-limit` on `/auth` (60 / 15 min) and on the rest of the admin API (2000 / 15 min); tighten per-route later (e.g. exports).
- **Bootstrap**: `npm run admin:create-user -- <email> <password> <super_admin|support>` (password min 12 chars). Run DB migration first.
- **Env (optional)**: `ADMIN_JWT_ACCESS_EXPIRES_IN` (default `8h`), `ADMIN_JWT_REFRESH_EXPIRES_IN` (default `7d`).

## Phase 2 — Dashboard + mentor applications (done)

- **`GET /api/admin/dashboard/summary`** — `users` (mentee/mentor/total), `pendingMentorApplications` (same queue as legacy pending list), subscription/plan placeholders with `note` until Phase 4.
- **`GET /api/admin/mentor-applications`** — query: `page`, `limit`, `sort`, `search`, `status` (`pending_review` | `approved` | `rejected` | `needs_more_info` | `draft` | `all`), `country`, `dateFrom`, `dateTo`. Response `{ data, meta }` per Part D.9. **Default (no `status`)** = review queue only (submitted, not approved, status pending or null). Use `status=all` for every submitted application including approved. `:id` is the mentor **user id**.
- **`GET /api/admin/mentor-applications/:id`** — profile + safe user + `internalAdminNotes` + `documents` (image/video URLs).
- **`POST /api/admin/mentor-applications/:id/notes`** — body `{ body }`; appends to `mentor_profiles.internalAdminNotes` (JSON array).
- **`POST /api/admin/mentor-applications/:id/decision`** — body `{ action: approve | reject | needs_more_info, messageOverride?, templateId? }`; email (if verified) + audit; push/in-app via `mentorProfile.service`.
- **`GET /api/admin/message-templates/:templateId`** — preview for `mentor_application_*_v1` ids (`src/admin/mentorApplicationTemplates.ts`).
- **Onboarding / approval (Part B.2)** — `completeOnboarding` no longer auto-approves unless **`MENTOR_AUTO_APPROVE_ON_ONBOARDING=true`** (use in dev/test only). Otherwise sets `mentorApprovalStatus: pending`, `isApproved: false`, and notifies the mentor that the application was submitted.
- **DB** — migration `1770400000000-AddNeedsMoreInfoAndMentorInternalNotes.ts`: `users.mentorApprovalStatus` adds `needs_more_info`; `mentor_profiles.internalAdminNotes` JSON.

## Phase 3 — Post-approval mentors + users (done)

- **`GET /api/admin/mentors`** — Query: `page`, `limit`, `sort`, `search`, `country`, `accountStatus` (`active` \| `suspended` \| `deleted` \| `all`), `approvedOnly` (`true` default = approved + onboarded mentors only; `false` = any mentor profile row). Response `{ data, meta }`.
- **`GET /api/admin/mentors/:userId`** — User + `mentorProfile` (via `getProfile` with session stats), `sessionStats`, subscription placeholders, `flags` (review counts / avg / low ratings).
- **`PATCH /api/admin/mentors/:userId/status`** — Body `{ action: suspend | unsuspend | remove }` (maps to `accountStatus` + `isActive`; `remove` = soft `deleted`). Audit logged.
- **`POST /api/admin/mentors/:userId/messages`** — Body `{ title?, message, channels?: ['in_app','email','push'] }` (default `in_app` + `email`). Push when token present. Audit logged.
- **`GET /api/admin/users`** — Query: `page`, `limit`, `sort`, `search`, `role` (`mentee` \| `mentor` \| `all`), `country`, `churchSearch` (matches mentee `churchName` or mentor `churchAffiliation`).
- **`GET /api/admin/users/:userId`** — Safe user + `menteeProfile` / `mentorProfile` if applicable, `discounts[]`, empty `subscriptionHistory` + note until Phase 4.
- **`POST /api/admin/users/:userId/discounts`** — Super Admin only (`requireAdminRole`). Body `{ type: percent|fixed, value, label?, validFrom?, validUntil? }`. Stored in **`user_discounts`** (migration `1770500000000-CreateUserDiscountsTable.ts`).
- **`DELETE /api/admin/users/:userId/discounts/:discountId`** — Super Admin only.

## Phase 4 — Subscriptions, plans, settings (done)

- **DB** — migration `1770600000000-Phase4SubscriptionsPlansSettings.ts`: `spiriment_settings`, `org_plans`, `user_subscriptions` (one row per user).
- **`GET /api/admin/subscriptions/summary`** — tier counts + `activeSubscribers` / `usersWithoutSubscriptionRecord` for all admins; `revenue.totalMrrCents` only for **Super Admin** (Support sees `revenue: null` + note).
- **`PUT /api/admin/users/:userId/subscription`** — Super Admin; upserts `user_subscriptions`, audit `admin.user.subscription.upsert`.
- **Plans** — `GET/POST/PATCH/DELETE` `/api/admin/plans/church|family/...` (DELETE soft-deactivates). **Super Admin only** (router-level `requireAdminRole`).
- **Settings** — `GET/PATCH /api/admin/settings` on `spiriment_settings` id `global`. **Super Admin only**; shallow patch for `supportEmail`, `publicAppName`, `maintenanceMode`, `features` merge.
- **Dashboard** — `GET /api/admin/dashboard/summary` uses live subscription slice + org plan counts; omits `totalMrrCents` for Support.

## Phase 5 — Exports, support queue, hardening

- Monthly export: sync vs async job + signed URLs (Part D.8).
- `GET/PATCH /api/admin/reports` when report entities exist (Part D.10).
- Observability, feature flags (Part B.8); optional 2FA / shorter admin sessions (Part B.1).

## Folder layout (`src/admin/`)

| Path | Purpose |
|------|---------|
| `router.ts` | Composes sub-routers; wires `broadcast-push`; top-level routes (`audit-log`, `message-templates`). |
| `handlers/notImplemented.ts` | Shared `501` stub until a route is implemented. |
| `middleware/` | `adminAuth`, `requireRole` (Phase 1). |
| `routes/*.routes.ts` | One file per Part D area (auth, dashboard, mentor-applications, …). |
| `services/` (optional) | Thin orchestration when controllers would get fat; else keep logic in existing domain services. |

## spiriment-admin

After Phase 1–2, point the Vite app at `VITE_API_URL` + `/api/admin/...` and replace `mockData` per screen.
