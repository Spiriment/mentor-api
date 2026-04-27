# Church Portal Feature — Implementation Checklist

> **Goal:** Add a `/particular-church` portal so each church gets its own login and dashboard to view mentor/mentee activity — without touching the existing Spiriment super-admin system.

---

## Login Assignment Strategy

**Option A (chosen): Spiriment Admin Creates the Login**

The Spiriment super-admin creates a church portal in the admin panel, enters the pastor's email, and the system sends the pastor an invite email. The pastor clicks the link, sets their own password, and logs in at their church-specific URL.

**Login flow:**
1. Spiriment admin creates the church in the admin panel (name, slug, denomination, etc.)
2. Spiriment admin adds the pastor's email → system sends an **invite email** with a one-time setup link
3. Pastor clicks the link → lands on a **Set Password** page
4. Pastor sets their password and is redirected to their church login URL:
   ```
   https://admin.spiriment.com/church/:slug/login
   ```
5. Pastor logs in with email + password from that point on

**Why Option A:**
- Spiriment admin controls exactly who gets access to each church portal
- No risk of unauthorized self-registration
- Pastor picks their own password (secure, no plaintext passwords shared)
- Clean audit trail — every portal user was explicitly created by an admin

---

## Architecture

```
Spiriment Super Admin  ←  existing admin_users + /api/admin/*  (NO CHANGES)
        |
        v  (creates & manages)
Church Portal Admin    ←  NEW: church_portals table + /api/church-portal/*
        |
        v  (sees only their church)
Mentors & Mentees      ←  existing users table (scoped by churchPortalId)
```

---

## Sprint 1 — Backend Foundation

### 1.1 Database Entities

- [x] Create `src/church-portal/entities/churchPortal.entity.ts`
- [x] Create `src/church-portal/entities/churchPortalUser.entity.ts`
- [x] Create `src/church-portal/entities/churchPortalRefreshToken.entity.ts`
- [x] Register all 3 new entities in `src/database/data-source.ts`

### 1.2 Database Migrations

- [x] Create migration `1780000000000-CreateChurchPortalTables.ts`

  ```sql
  -- church_portals
  CREATE TABLE `church_portals` (
    `id`           VARCHAR(36)  NOT NULL,
    `orgPlanId`    VARCHAR(36)  NOT NULL,
    `name`         VARCHAR(255) NOT NULL,
    `slug`         VARCHAR(100) NOT NULL UNIQUE,   -- drives /church/:slug/login URL
    `logoUrl`      VARCHAR(500) NULL,
    `denomination` VARCHAR(100) NULL,
    `city`         VARCHAR(100) NULL,
    `country`      VARCHAR(100) NULL,
    `timezone`     VARCHAR(64)  NOT NULL DEFAULT 'UTC',
    `status`       VARCHAR(24)  NOT NULL DEFAULT 'active',
    `metadata`     JSON         NULL,
    `createdAt`    DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updatedAt`    DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`id`),
    INDEX `IDX_church_portals_orgPlanId` (`orgPlanId`),
    INDEX `IDX_church_portals_slug`      (`slug`)
  ) ENGINE=InnoDB;

  -- church_portal_users (pastors — NOT in admin_users, NOT in users)
  CREATE TABLE `church_portal_users` (
    `id`             VARCHAR(36)  NOT NULL,
    `churchPortalId` VARCHAR(36)  NOT NULL,
    `email`          VARCHAR(255) NOT NULL UNIQUE,
    `password`       VARCHAR(255) NOT NULL,
    `firstName`      VARCHAR(120) NULL,
    `lastName`       VARCHAR(120) NULL,
    `role`           VARCHAR(32)  NOT NULL DEFAULT 'pastor',
    `isActive`       TINYINT(1)   NOT NULL DEFAULT 1,
    `lastLoginAt`    DATETIME(6)  NULL,
    `createdAt`      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updatedAt`      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`id`),
    INDEX `IDX_cpu_churchPortalId` (`churchPortalId`)
  ) ENGINE=InnoDB;

  -- church_portal_refresh_tokens
  CREATE TABLE `church_portal_refresh_tokens` (
    `id`                 VARCHAR(36) NOT NULL,
    `churchPortalUserId` VARCHAR(36) NOT NULL,
    `token`              TEXT        NOT NULL,
    `expiresAt`          DATETIME(6) NOT NULL,
    `createdAt`          DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (`id`),
    INDEX `IDX_cprt_userId` (`churchPortalUserId`)
  ) ENGINE=InnoDB;
  ```

- [x] Create migration `1780100000000-AddChurchPortalIdToUsers.ts`

  ```sql
  ALTER TABLE `users`
    ADD COLUMN `churchPortalId` VARCHAR(36) NULL AFTER `orgPlanId`,
    ADD INDEX `IDX_users_churchPortalId` (`churchPortalId`);
  ```

- [ ] Run both migrations against the dev database
- [x] Add `churchPortalId` column to the existing `User` entity (additive only — no other changes)

### 1.3 JWT Token Types

- [x] Append church portal constants to `src/church-portal/types/adminJwt.ts` (do NOT modify existing types):

  ```typescript
  export const CHURCH_PORTAL_JWT_TYP     = 'church_portal'         as const;
  export const CHURCH_PORTAL_REFRESH_TYP = 'church_portal_refresh' as const;

  export type ChurchPortalAccessPayload = {
    typ:            typeof CHURCH_PORTAL_JWT_TYP;
    portalUserId:   string;
    churchPortalId: string;
    email:          string;
    role:           string;
  };

  export type ChurchPortalRefreshPayload = {
    typ:          typeof CHURCH_PORTAL_REFRESH_TYP;
    portalUserId: string;
  };
  ```

- [x] Append `signChurchPortalAccessToken()` method to `JwtService`
- [x] Append `verifyChurchPortalAccessToken()` method to `JwtService`

### 1.4 Auth Middleware

- [x] Create `src/church-portal/middleware/churchPortalAuth.middleware.ts`
  - Verifies `typ === 'church_portal'` — rejects all admin and app tokens
  - Loads `ChurchPortalUser` from DB and attaches to `req.churchPortalUser`
  - All queries downstream get `churchPortalId` from `req.churchPortalUser` only (never from request body)

---

## Sprint 2 — Auth API

### 2.1 Validation Schemas

- [x] Create `src/church-portal/validation/churchPortalAuth.validation.ts`
  - `loginSchema` — email, password, churchPortalId
  - `forgotPasswordSchema` — email
  - `resetPasswordSchema` — otp, newPassword
  - `updateProfileSchema` — firstName, lastName

### 2.2 Auth Service

- [x] Create `src/church-portal/services/churchPortalAuth.service.ts`
  - [x] `login(email, password, churchPortalId)` — bcrypt verify, sign both tokens, store refresh
  - [x] `logout(refreshToken)` — delete from `church_portal_refresh_tokens`
  - [x] `refreshToken(token)` — verify, sign new access token
  - [x] `acceptInvite(inviteToken, newPassword)` — verify one-time invite token, bcrypt hash password, activate account
  - [x] `forgotPassword(email)` — generate OTP, send email
  - [x] `resetPassword(otp, newPassword)` — verify OTP, bcrypt hash, update password
  - [x] `getMe(portalUserId)` — return portal user profile
  - [x] `updateMe(portalUserId, data)` — update first/last name

### 2.3 Auth Controller & Routes

- [x] Create `src/church-portal/controllers/churchPortalAuth.controller.ts`
- [x] Create `src/church-portal/routes/auth.routes.ts`

  | Method | Path | Auth Required |
  |--------|------|---------------|
  | POST | `/auth/login` | No |
  | POST | `/auth/logout` | Yes |
  | POST | `/auth/refresh` | No |
  | POST | `/auth/accept-invite` | No — validates one-time invite token, sets password |
  | POST | `/auth/forgot-password` | No |
  | POST | `/auth/reset-password` | No |
  | GET  | `/auth/me` | Yes |
  | PATCH | `/auth/me` | Yes |

### 2.4 Portal Info Route (Public)

- [x] Create `src/church-portal/routes/portal.routes.ts`
  - `GET /portal/info?slug=:slug` — returns `{ name, logoUrl, denomination }` for login page branding

### 2.5 Wire Up Router

- [x] Create `src/church-portal/router.ts` — assembles all church-portal sub-routes
- [x] Register in `src/routes/root.route.ts`:
  ```typescript
  rootRouter.use('/api/church-portal', createChurchPortalRouter());
  ```
- [ ] Test all auth endpoints with Postman/curl

---

## Sprint 3 — Dashboard & Activity API

### 3.1 Dashboard Service

- [x] Create `src/church-portal/services/churchPortalDashboard.service.ts`
  - [x] `getSummary(churchPortalId)` — total mentors, total mentees, sessions this week, avg streak
  - [x] `getActivityFeed(churchPortalId)` — recent sessions completed + new members joined (last 7 days)

### 3.2 Members Service

- [x] Create `src/church-portal/services/churchPortalMembers.service.ts`
  - [x] `listMembers(churchPortalId, role?, page, limit)` — paginated, scoped by churchPortalId
  - [x] `getMember(churchPortalId, userId)` — profile + stats (verifies user belongs to this church)
  - [x] `getMemberSessions(churchPortalId, userId)` — session history
  - [x] `getMemberStreak(churchPortalId, userId)` — streak + Bible reading data

### 3.3 Activity Service

- [x] Create `src/church-portal/services/churchPortalActivity.service.ts`
  - [x] `getMentors(churchPortalId)` — mentors with mentee count, session count, last active
  - [x] `getMentees(churchPortalId)` — mentees with assigned mentor, last session, streak
  - [x] `getSessions(churchPortalId)` — recent/upcoming sessions across the church
  - [x] `getBibleReading(churchPortalId)` — aggregated Bible reading streaks

### 3.4 Controllers & Routes

- [x] Create `src/church-portal/controllers/churchPortalDashboard.controller.ts`
- [x] Create `src/church-portal/controllers/churchPortalMembers.controller.ts`
- [x] Create `src/church-portal/controllers/churchPortalActivity.controller.ts`
- [x] Create `src/church-portal/routes/dashboard.routes.ts`
- [x] Create `src/church-portal/routes/members.routes.ts`
- [x] Create `src/church-portal/routes/activity.routes.ts`

  | Method | Path | Description |
  |--------|------|-------------|
  | GET | `/dashboard/summary` | Counts + avg streak |
  | GET | `/dashboard/activity` | Recent activity feed |
  | GET | `/members` | All church members (`?role=mentor\|mentee&page=1`) |
  | GET | `/members/:userId` | Member profile + stats |
  | GET | `/members/:userId/sessions` | Session history |
  | GET | `/members/:userId/streak` | Streak + Bible reading |
  | GET | `/activity/mentors` | Mentor activity table |
  | GET | `/activity/mentees` | Mentee activity table |
  | GET | `/activity/sessions` | Sessions across the church |
  | GET | `/activity/bible-reading` | Aggregated Bible streaks |

- [x] Register all new routes in `src/church-portal/router.ts`

---

## Sprint 4 — Admin Panel Backend

> These endpoints are protected by the **existing** admin auth middleware — no changes to that.

- [x] Create `src/admin/routes/churchPortals.routes.ts`
- [x] Create admin controller + service for church portal management

  | Method | Path | Description |
  |--------|------|-------------|
  | GET | `/admin/church-portals` | List all portals |
  | POST | `/admin/church-portals` | Create a portal (linked to existing org_plan) |
  | GET | `/admin/church-portals/:id` | Portal detail |
  | PATCH | `/admin/church-portals/:id` | Update name, logo, status |
  | GET | `/admin/church-portals/:id/users` | List pastor logins |
  | POST | `/admin/church-portals/:id/users` | Create pastor login → sends invite email with one-time setup link |
  | DELETE | `/admin/church-portals/:id/users/:uid` | Deactivate pastor login |
  | GET | `/admin/church-portals/:id/members` | List app users in this church |
  | GET | `/admin/church-portals/:id/report` | Activity report |

- [x] Register `churchPortals.routes.ts` inside `src/admin/router.ts`

---

## Sprint 5 — Admin Panel Frontend (spiriment-admin)

### 5.1 API Functions

- [ ] Append to `src/api/adminApi.ts` (do NOT modify existing functions):
  - [ ] `createChurchPortal(body)`
  - [ ] `listChurchPortals(page?)`
  - [ ] `getChurchPortal(id)`
  - [ ] `updateChurchPortal(id, body)`
  - [ ] `createChurchPortalUser(portalId, body)`
  - [ ] `listChurchPortalUsers(portalId)`
  - [ ] `deactivateChurchPortalUser(portalId, userId)`
  - [ ] `listChurchPortalMembers(portalId, params?)`
  - [ ] `getChurchPortalReport(portalId)`

### 5.2 Church Portal Detail Page

- [ ] Create `src/pages/ChurchPortalDetail.tsx` with 4 tabs:
  - [ ] **Overview** tab — portal info card, member counts, activity summary
  - [ ] **Portal Admins** tab — table of pastor logins, create button, deactivate action
  - [ ] **Members** tab — app users (mentors + mentees) in this church
  - [ ] **Activity Report** tab — reuse existing chart components from `ChurchPlanDetail.tsx`

### 5.3 Routing & Navigation

- [ ] Add route `/church-portals/:id` to `src/App.tsx`
- [ ] Add "Manage Church Portal" button in `ChurchPlanDetail.tsx` → navigates to `/church-portals/:id`

---

## Sprint 6 — Pastor-Facing Web Portal (spiriment-admin)

> Built as a parallel route group in the existing admin app using a separate auth context. Church portal tokens are stored under different localStorage keys (`cp_access_token`, `cp_refresh_token`) and never mixed with admin tokens.

### 6.1 Auth Context & Guard

- [x] Create `src/contexts/ChurchPortalAuthContext.tsx`
  - Mirrors `AuthContext.tsx` but uses church portal login endpoint
  - Stores tokens under `cp_access_token` / `cp_refresh_token`
  - Exposes `portalRole` instead of `isSuperAdmin`
- [ ] Create `src/components/RequireChurchPortalAuth.tsx` — route guard for pastor pages

### 6.2 Pages

- [ ] `src/pages/church-portal/ChurchPortalLogin.tsx`
  - Fetches `GET /church-portal/portal/info?slug=:slug` to brand the login form
  - Route: `/church/:slug/login` (public, no auth guard)

- [ ] `src/pages/church-portal/ChurchPortalDashboard.tsx`
  - Shows summary cards: total mentors, total mentees, sessions this week, avg streak
  - Shows recent activity feed
  - Route: `/church/:slug/dashboard`

- [ ] `src/pages/church-portal/ChurchPortalMentors.tsx`
  - Table: mentor name, mentee count, session count, last active
  - Route: `/church/:slug/mentors`

- [ ] `src/pages/church-portal/ChurchPortalMentees.tsx`
  - Table: mentee name, assigned mentor, last session, current streak
  - Route: `/church/:slug/mentees`

- [ ] `src/pages/church-portal/ChurchPortalMemberDetail.tsx`
  - Profile card, session history, streak chart
  - Route: `/church/:slug/members/:userId`

- [ ] `src/pages/church-portal/ChurchPortalSessions.tsx`
  - List of recent + upcoming sessions across the whole church
  - Route: `/church/:slug/sessions`

### 6.3 Navigation Layout

- [ ] Create `src/layouts/ChurchPortalLayout.tsx` — sidebar with links to all pastor pages
- [ ] Add all `/church/:slug/*` routes to `src/App.tsx` wrapped in `RequireChurchPortalAuth`

---

## Sprint 7 — Mobile App (Optional Enhancement)

- [ ] Create `src/screens/auth/ChurchCodeScreen.tsx`
  - Optional step in onboarding flow (after `RoleSelectionScreen`)
  - User enters 6-char church code OR follows invite deep link
  - Calls `GET /api/church-portal/portal/info?slug=XXXXXX` to validate and show church name
  - On confirm: passes `churchPortalId` through onboarding params
- [ ] Add `ChurchCode` to `RootStackParamList` in `src/types/index.ts`
- [ ] Add `ChurchCodeScreen` to navigation stack in `src/navigation/index.tsx`
- [ ] Pass `churchPortalId` to the final profile save API call in onboarding

---

## Data Isolation Verification

Before marking Sprint 3 as done, verify all of these are true:

- [ ] `churchPortalAuthMiddleware` rejects any token where `typ !== 'church_portal'`
- [ ] `churchPortalId` is always sourced from `req.churchPortalUser.churchPortalId` (the verified token) — never from `req.body` or `req.query`
- [ ] Every TypeORM query in the church portal services filters by `churchPortalId`
- [ ] Admin routes at `/api/admin/*` still reject church portal tokens (admin middleware checks `typ === 'admin'`)
- [ ] Church portal users cannot call `/api/auth/*` app endpoints (they are not in the `users` table)

---

## Migration Execution Order

```
1. Run CreateChurchPortalTables migration
2. Run AddChurchPortalIdToUsers migration
3. Register new entities in data-source.ts
4. Run seed script:  scripts/seed-church-portal.ts
   (creates one OrgPlan, one ChurchPortal, one pastor ChurchPortalUser)
5. Backfill existing church users (if any):
   UPDATE users SET churchPortalId = ? WHERE orgPlanId = ?
```

---

## Key Design Decisions

| Decision | Reason |
|----------|--------|
| Pastors are in `church_portal_users`, NOT `admin_users` | Admin users are platform-wide; pastors must be scoped to one church |
| Separate `churchPortalId` column on `users` (not just `orgPlanId`) | `orgPlanId` = billing; `churchPortalId` = access control. Keeping both allows multi-campus churches later |
| `slug` field on `church_portals` | Drives the URL `/church/:slug/login`, memorable per-church, no internal UUID exposed |
| `church_portals` is separate from `org_plans` | Avoids mixing auth credentials into a billing entity |
| Parallel auth context in admin app (not shared with admin auth) | Zero token crossover between admin and pastor sessions |
