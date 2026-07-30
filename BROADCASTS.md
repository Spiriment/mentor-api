# Email Broadcasts (Spiriment Admin)

Ongoing tool for rich HTML email campaigns: launch announcements, product updates, and segmented outreach.

## Who can use it

- **Super Admin only** — `/admin/broadcasts` in Spiriment Admin
- API: `/api/admin/broadcasts/*` (requires super_admin JWT)

## Sender identity

| Field | Default |
|-------|---------|
| **From** | `SMTP_FROM` env — use **`info@spiriment.com`** (live mailbox) |
| **Reply-To** | **`info@spiriment.com`** per campaign default (editable in compose UI) |

Use the same **`info@spiriment.com`** mailbox for SMTP auth (`SMTP_USER`) and **`SMTP_FROM`** so From and Reply-To match your live inbox.

## Recipients (3 modes)

1. **All users in DB** — active users with verified email (default). Skips `marketingEmailsOptOut`.
2. **Role filter** — mentors, mentees, or all roles (same opt-out rules).
3. **Excel upload** — `.xlsx` / `.xls` / `.csv` with an `email` column; optional `firstName`. Deduplicated. Matches existing users for opt-out; unknown emails still receive the send.

### Excel format

| email | firstName |
|-------|-----------|
| user@example.com | Jane |

Header row required. Column names are case-insensitive (`email`, `e-mail`, `first name`, etc.).

## Workflow

### Phase 1 — Compose & send (live)

1. Admin → **Broadcasts** → **New campaign**
2. Set name, subject, rich HTML (TinyMCE + Cloudinary images)
3. Choose audience (all DB / role / Excel)
4. **Preview audience count** (optional)
5. **Save draft** → **Send now** (async queue on API server)

Sending runs in the background (~150ms between emails). Progress updates on the campaign page (auto-refresh while `sending`).

### Phase 2 — Campaign tracking

- Status: `draft` → `scheduled` → `sending` → `sent` | `failed` | `cancelled`
- Per-recipient rows in `email_campaign_recipients`
- Duplicate campaigns, save as **template** for reuse

### Phase 3 — Schedule & compliance

- **Schedule**: datetime picker → cron runs every minute UTC
- **Unsubscribe**: footer link → `GET /api/marketing/unsubscribe?email=&token=` sets `users.marketingEmailsOptOut = true`
- Templates library: campaigns with `isTemplate = true` (list via `?templatesOnly=true`)

## Database

Migration: `1782200000000-CreateEmailCampaigns.ts`

```bash
cd mentor-backend
npm run db-migrate:run          # dev
npm run db-migrate:run:prod     # production (after build)
```

Tables:

- `email_campaigns`
- `email_campaign_recipients`
- `users.marketingEmailsOptOut` (new column)

## API reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/broadcasts` | List campaigns |
| POST | `/broadcasts` | Create draft |
| GET | `/broadcasts/:id` | Get campaign |
| PUT | `/broadcasts/:id` | Update draft/scheduled |
| DELETE | `/broadcasts/:id` | Delete draft/cancelled |
| POST | `/broadcasts/:id/preview-audience` | Count recipients |
| POST | `/broadcasts/:id/import-excel` | multipart `broadcastExcel` |
| POST | `/broadcasts/:id/send` | Start send (202) |
| POST | `/broadcasts/:id/schedule` | `{ scheduledAt: ISO string }` |
| POST | `/broadcasts/:id/cancel` | Cancel scheduled/sending |
| POST | `/broadcasts/:id/duplicate` | Clone as new draft |
| POST | `/broadcasts/:id/save-as-template` | `{ templateName }` |
| GET | `/broadcasts/:id/recipients` | Paginated delivery log |
| POST | `/broadcasts/upload-image` | TinyMCE image upload |

## Launch checklist (ops)

1. Run migration on production DB
2. Confirm `SMTP_FROM=info@spiriment.com` and SMTP credentials
3. Set `API_BASE_URL` or `APP_URL` for unsubscribe links
4. Deploy backend + admin
5. Create campaign → paste App Store / Play Store links in HTML (use **Insert launch template**)
6. Preview audience → send to yourself via Excel test list first
7. Send to full list or schedule off-peak UTC

## Legacy broadcast

The plain-text broadcast on **Users** page (`POST /api/admin/users/broadcast-email`) remains for quick messages. Prefer **Broadcasts** for launch and rich HTML going forward.

## Troubleshooting

| Issue | Check |
|-------|--------|
| 0 recipients | Verified-email filter; Excel empty; all users opted out |
| Stuck on `sending` | API logs; SMTP limits; restart won't duplicate if status is `sending` |
| Images broken | Cloudinary upload; `/broadcasts/upload-image` auth |
| Unsubscribe 400 | `JWT_SECRET` must match token generation |

## Files (dev map)

**Backend**

- `src/services/adminBroadcast.service.ts`
- `src/controllers/adminBroadcast.controller.ts`
- `src/admin/routes/broadcasts.routes.ts`
- `src/mails/partials/broadcast.hbs`
- `src/database/entities/emailCampaign*.ts`

**Admin**

- `src/pages/Broadcasts.tsx`
- `src/pages/BroadcastEditor.tsx`
- `src/components/admin/RichEditor.tsx` (shared editor)
