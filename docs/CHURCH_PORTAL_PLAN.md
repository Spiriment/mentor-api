# Church Portal & Church Billing — How It Works

> **Status:** live. Rewritten October 2026 to describe what is built (the original April sprint
> checklist is in git history). Member-facing pricing: `mentor-app/SPIRIMENT_SUBSCRIPTION_GUIDE.md` §11.

Each church gets:

- a **church portal**: a pastor dashboard at `https://admin.spiriment.com/church/:slug/login`
- a **church billing plan** (`org_plans`, `planType = church`) that pays for the members the church chooses

```
Spiriment admins  ← admin_users + /api/admin/*               (creates churches, invites pastors, billing)
       │
Pastors           ← church_portal_users + /api/church-portal/* (sees only their church)
       │
Members           ← users.churchPortalId  (joined the church: gets the church discount)
                    users.orgPlanId       (the church pays for them: tier set by the church)
```

`churchPortalId` (membership) and `orgPlanId` (who the church pays for) are deliberately separate:
joining with the code gives the discount; the church then picks who it pays for.

---

## 1. Setting up a church

1. A Spiriment admin creates the church (name, slug, denomination…). A **join code** (8 characters) is generated.
2. The admin adds pastor logins (role `pastor`, `deacon` or `leader`). Each gets an invite email
   (`church-portal-invite` template, link valid 48 h) to set a password at `/church/:slug/accept-invite`.
   If the email fails, the account still exists and the admin uses **Resend invite**.
3. The church's billing plan is created automatically the first time billing is used (no seat cap).

Pastor accounts: login, refresh, logout, forgot password (6-digit code by email, valid 15 min,
burned after 5 wrong tries; signs out other sessions). A pastor who never finished their invite gets
a fresh invite instead of a code. Tokens are `typ: church_portal*` JWTs and never work on admin or
app routes (and vice versa).

## 2. Members joining

- In the app (onboarding or Profile → Church) the member enters the join code (or the church's slug).
- This creates a **pending join request**; one pending request at a time (asking another church withdraws it).
- Pastors are **emailed** (`church-join-request`, at most one email per church per hour, with the
  pending count) and see a badge on **Join requests** in the portal.
- On approve/decline the member gets a **push**. Approval links them (`users.churchPortalId`) and
  recalculates the church discount; a member already in another church can't be approved.
- Removed members must ask again (their old approval no longer re-links them).
- Leaving the church (app) or being removed (pastor, or an admin with `church.remove_members`) ends
  the church discount and anything the church pays for.

## 3. Pricing

| Item | Price |
|---|---|
| Church portal | €50 / month, on every church invoice |
| Each member the church pays for | tier price (Basic €3, Pro €5, Premium €7.50) minus the church discount |
| Church discount | 5%; 10% once the church has 100+ members (mentors + mentees) |

Constants: `src/common/constants/subscriptionPricing.ts` (`CHURCH_DISCOUNT_PERCENT`,
`CHURCH_BULK_DISCOUNT_PERCENT`, `CHURCH_BULK_MEMBER_THRESHOLD`, `CHURCH_PORTAL_MONTHLY_FEE_EUR`).

The discount is stored on every member (`users.churchDiscountPercent`) and resynced on each join and
leave. Members who subscribe themselves by card get it as a Stripe coupon; when the percent changes
(crossing 100 members) or they leave, their coupon is updated from the next invoice. Members who
subscribed **before** joining get it added on approval (only if they have no other discount).
App Store prices can't be discounted. One discount per person: the biggest wins (mentor 30%, youth 30%, church 5/10%).

## 4. Who the church pays for

Pastors (Billing page, **Pastor role only** for changes) and Spiriment super admins (church page →
Billing tab) can:

| Action | Effect |
|---|---|
| **Church pays** (pick a tier) | member gets the tier now (`church_central` subscription), a push, and is on the next invoice |
| **Change tier** | immediate; next invoice uses the new tier |
| **Stop paying** | member moves to Free (email "subscription ended"); stays in the church |

Rules:
- Only members of the church can be added.
- Someone already paying for themselves (card, App Store, family plan) must cancel and let it run out first; nobody pays twice.
- Members the church pays for can't buy or change a plan in the app.
- Optional **paid places cap** per church (super admin). 0 = no cap.

API — `src/services/churchBilling.service.ts`, `src/controllers/churchBilling.controller.ts`:

| Pastor (`/api/church-portal`) | Admin (`/api/admin/church-portals/:portalId`, Super Admin) |
|---|---|
| `GET /billing/coverage` | `GET /billing` |
| `POST\|PATCH\|DELETE /billing/coverage/:userId` `{ tier }` | `POST\|PATCH\|DELETE /billing/members/:userId` `{ tier }` |
| `PATCH /billing/settings` `{ billingEmail }` | `PATCH /billing/settings` `{ billingEmail, autoInvoice: { enabled, dayOfMonth }, seatCap }` |

## 5. Invoices

- **One Stripe invoice per month** (`collection_method: send_invoice`, due in 14 days): the €50
  portal fee plus one line per member the church pays for. Built in
  `AdminOrgPlanService.buildChurchInvoiceDraft`; sent by `StripeService.createAndSendInvoice` (items
  are attached to the invoice itself; the total is checked before sending).
- **Recipient**, in order: billing admin user → church billing email → the pastor generating it →
  the church's first active pastor.
- **Automatic monthly invoicing** (off by default; a super admin turns it on per church with a day
  1–28): cron daily 08:00 UTC, catches up if a day was missed, one automatic invoice per month,
  skipped while the church is suspended. Failures alert super admins.
- **Manual**: pastor (max once per 24 h) or admin "Generate invoice".
- **Tracking**: each invoice is recorded on the plan (`metadata.invoices`) and updated from Stripe
  webhooks (`invoice.paid`, `payment_succeeded`, `payment_failed`, `overdue`, `voided`,
  `marked_uncollectible`) plus a daily reconcile at 09:30 UTC. Super admins are alerted on paid,
  failed and overdue (once). Status shows on the pastor Billing page and the admin plan page.
- Church invoice webhooks never touch personal subscriptions (detected by `metadata.planType = church`).
- **Unpaid invoices don't cut anyone off automatically**; Spiriment decides (e.g. suspend the church).

## 6. Suspension

Super admins (or support admins granted `church.suspend`) can suspend/reactivate a church:
pastors are signed out on their next request and can't sign in; new joins are blocked; members'
church discount drops to 0% (Stripe coupons removed and restored on reactivation for exactly the
members who had one). Plans the church pays for are **not** changed by suspension.

## 7. Pastor portal pages (`spiriment-admin`, `/church/:slug/*`)

Dashboard · Join requests · Mentors · Mentees · Sessions · Bible reading · Member detail (remove from
church: Pastor role) · Billing
(who the church pays for, billing email, invoice preview, invoice history) · Login / accept invite /
forgot password.

## 8. Known gaps

- Sessions are attributed to the church only when the **mentor** is a church member (church mentees
  with outside mentors don't appear in the dashboard/session counts).
- Streak numbers are only refreshed when the member opens the app, so inactive members can show old streaks.
- "New member" in the activity feed uses the account creation date, not the join date.
- The portal sessions list doesn't show mentor/mentee names.
- Not built: bulk import, bulk tier changes, default tier for new members, CSV exports, in-app church branding.
- Church invoice revenue is not counted in MRR (`church_central` is a non-paying provider in MRR).

## 9. Key design decisions

| Decision | Reason |
|---|---|
| Pastors in `church_portal_users`, not `admin_users` | Admins are platform-wide; pastors are scoped to one church |
| `churchPortalId` separate from `orgPlanId` | Membership/discount vs who the church pays for; a church only pays for members it chooses |
| `slug` on `church_portals` | Readable portal URL without exposing ids |
| Separate auth context in the admin app | No token crossover between admin and pastor sessions |
| Plan created on first billing use | Every church can bill without manual plan setup |
| Automatic invoicing opt-in per church | Existing churches aren't suddenly invoiced |
