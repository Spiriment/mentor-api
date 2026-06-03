# Spiriment FAQ API — Website integration

Public read-only endpoint for displaying FAQs on **spiriment-website**. No authentication required.

---

## Base URLs

| Environment | Base URL |
|-------------|----------|
| **Production** | `https://api.paxify.org/api` |
| **Local backend** | `http://localhost:6802/api` (or your dev port) |

All paths below are relative to the base URL.

---

## Get published FAQs (use this on the website)

**`GET /faq/published`**

Returns only FAQs where `isPublished === true`, ordered by `sortOrder` ascending (then `createdAt`).

### Full URL (production)

```
GET https://api.paxify.org/api/faq/published
```

### Headers

| Header | Value |
|--------|--------|
| `Accept` | `application/json` |

No `Authorization` header required.

### Success response — `200 OK`

```json
{
  "success": true,
  "response": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "question": "What is Spiriment?",
      "answer": "Spiriment is a Christian app for Bible study and mentorship...",
      "category": "General",
      "sortOrder": 0,
      "isPublished": true,
      "createdAt": "2026-01-15T10:00:00.000Z",
      "updatedAt": "2026-01-20T12:00:00.000Z"
    }
  ]
}
```

### FAQ object fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | Unique FAQ id |
| `question` | string | Question text |
| `answer` | string | Answer text (may contain plain text or HTML — confirm with content team) |
| `category` | string \| null | Optional grouping label (e.g. `"General"`, `"Billing"`) |
| `sortOrder` | number | Display order (lower = higher on page) |
| `isPublished` | boolean | Always `true` on this endpoint |
| `createdAt` | ISO 8601 date | Created timestamp |
| `updatedAt` | ISO 8601 date | Last updated timestamp |

### Error response — `500`

```json
{
  "status": "error",
  "message": "Internal server error"
}
```

### Empty list

If no FAQs are published, `response` is an empty array:

```json
{
  "success": true,
  "response": []
}
```

---

## Example: browser `fetch`

```javascript
const API_BASE = 'https://api.paxify.org/api';

async function loadFaqs() {
  const res = await fetch(`${API_BASE}/faq/published`, {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`FAQ request failed: ${res.status}`);
  }

  const data = await res.json();
  if (!data.success) {
    throw new Error('FAQ API returned success: false');
  }

  return data.response; // Faq[]
}
```

---

## Example: Next.js (server component / SSR)

Recommended for SEO — fetch on the server so content is in the HTML.

```typescript
const API_BASE = process.env.SPIRIMENT_API_URL ?? 'https://api.paxify.org/api';

export type FaqItem = {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  sortOrder: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
};

export async function getPublishedFaqs(): Promise<FaqItem[]> {
  const res = await fetch(`${API_BASE}/faq/published`, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 300 }, // optional: cache 5 minutes
  });

  if (!res.ok) {
    throw new Error(`Failed to load FAQs: ${res.status}`);
  }

  const json = await res.json();
  return json.response ?? [];
}
```

---

## Grouping by category (optional)

The API does not group items; the website can group client-side:

```javascript
function groupByCategory(faqs) {
  return faqs.reduce((acc, faq) => {
    const key = faq.category ?? 'Other';
    (acc[key] ??= []).push(faq);
    return acc;
  }, /** @type {Record<string, typeof faqs>} */ ({}));
}
```

---

## CORS

The API allows cross-origin requests from browsers (`Access-Control-Allow-Origin` reflects the request origin).  
The website can call this endpoint directly from the client.

For production sites, **server-side fetch** (Next.js SSR, etc.) is still recommended for SEO and reliability.

---

## Content management

FAQs are created and published in **spiriment-admin** (admin panel).  
The website only reads published content via this endpoint — no write access from the public site.

---

## Endpoints not for the website

These require admin authentication (`/api/admin/...`) and are for internal tools only:

| Method | Path | Notes |
|--------|------|--------|
| GET | `/api/admin/faq` | All FAQs (draft + published) |
| GET | `/api/admin/faq/id/:id` | Single FAQ |
| POST | `/api/admin/faq` | Create |
| PUT | `/api/admin/faq/:id` | Update |
| DELETE | `/api/admin/faq/:id` | Delete |

**Website should only use:** `GET /api/faq/published`

---

## Health check (optional)

```
GET https://api.paxify.org/health
```

or

```
GET https://api.paxify.org/api/health
```

(Confirm with backend team which path is live in your environment.)

---

## Contact

For API issues, empty FAQ list, or staging credentials, contact the Spiriment backend team.
