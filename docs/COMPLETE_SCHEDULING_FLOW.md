# Complete Session Scheduling Flow

## Overview
This document describes the complete session scheduling flow, including all use cases for mentees requesting sessions and mentors managing those requests.

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    MENTEE SIDE FLOW                              │
└─────────────────────────────────────────────────────────────────┘

1. Mentee browses available mentors
   └─> Views mentor profiles, availability

2. Mentee requests a session
   └─> Selects mentor, date, time slot
   └─> Adds description/notes
   └─> POST /api/sessions
   └─> Session created with status="scheduled"

3. Mentee sees session status
   └─> Pending: Waiting for mentor response
   └─> Confirmed: Mentor accepted
   └─> Declined: Mentor declined (with reason)
   └─> Rescheduled: Mentor suggested new time

┌─────────────────────────────────────────────────────────────────┐
│                    MENTOR SIDE FLOW                              │
└─────────────────────────────────────────────────────────────────┘

1. Mentor receives session request
   └─> Notification/alert about new request
   └─> Shows in "Pending" tab
   └─> Displays: mentee info, requested time, description

2. Mentor reviews request
   └─> Can see mentee profile
   └─> Can see requested date/time
   └─> Can see mentee's message/description

3. Mentor decision options:

   A. ACCEPT REQUEST
      └─> PATCH /api/sessions/:id/status { status: "confirmed" }
      └─> Session moves to "Upcoming" tab
      └─> Both parties notified
      └─> Session is now confirmed

   B. DECLINE REQUEST (Simple Decline)
      └─> DELETE /api/sessions/:id
      └─> Body: { reason: "..." }
      └─> Session status → "cancelled"
      └─> Mentee notified with reason
      └─> Use case: Don't want this mentee, not available, etc.

   C. DECLINE AND RESCHEDULE
      └─> PATCH /api/sessions/:id/reschedule
      └─> Body: { 
            reason: "Not available at that time",
            newScheduledAt: "2024-03-15T14:00:00Z",
            message: "How about this time instead?"
          }
      └─> Session status → "rescheduled"
      └─> Original session cancelled, new session created
      └─> OR: Update existing session with new time
      └─> Mentee notified and can accept/decline new time

4. Mentor confirms accepted session (before it starts)
   └─> For confirmed sessions, mentor can confirm attendance
   └─> PATCH /api/sessions/:id/confirm
   └─> Sets mentorConfirmed = true
   └─> Used to track attendance confirmation

## Session Status Flow

```
SCHEDULED (initial)
    │
    ├─> CONFIRMED (mentor accepts)
    │       │
    │       └─> IN_PROGRESS (session starts)
    │               │
    │               └─> COMPLETED (session ends)
    │
    ├─> CANCELLED (mentor declines)
    │
    └─> RESCHEDULED (mentor suggests new time)
            │
            └─> Back to SCHEDULED (mentee accepts new time)
                    │
                    └─> CONFIRMED (mentor confirms new time)
```

## Use Cases

### Use Case 1: Mentee Requests Session
**Actor**: Mentee
**Flow**:
1. Mentee selects mentor from list
2. Mentee views mentor's available time slots
3. Mentee selects date and time
4. Mentee adds description/notes
5. Mentee submits request
6. Session created with status="scheduled"
7. Mentor receives notification

**Backend**: `POST /api/sessions`
**Frontend**: `RequestSessionScreen`

---

### Use Case 2: Mentor Accepts Request
**Actor**: Mentor
**Flow**:
1. Mentor sees request in "Pending" tab
2. Mentor reviews mentee info and request details
3. Mentor clicks "Accept"
4. Session status changes to "confirmed"
5. Session moves to "Upcoming" tab
6. Both parties notified

**Backend**: `PATCH /api/sessions/:id/status { status: "confirmed" }`
**Frontend**: `SessionsScreen` → Accept button

---

### Use Case 3: Mentor Declines Request (Simple)
**Actor**: Mentor
**Flow**:
1. Mentor sees request in "Pending" tab
2. Mentor clicks "Decline"
3. Mentor optionally provides reason
4. Session status changes to "cancelled"
5. Session removed from pending
6. Mentee notified with reason (if provided)

**Backend**: `DELETE /api/sessions/:id { reason?: string }`
**Frontend**: `SessionsScreen` → Decline button → Reason modal

**Reasons might include**:
- "I'm not available at this time"
- "I don't have capacity for new mentees"
- "This doesn't align with my expertise"
- "Other commitments"

---

### Use Case 4: Mentor Declines and Reschedules
**Actor**: Mentor
**Flow**:
1. Mentor sees request in "Pending" tab
2. Mentor clicks "Decline & Reschedule"
3. Mentor selects new date/time from their availability
4. Mentor adds message (optional)
5. Original session cancelled
6. New session created with status="rescheduled" or "scheduled"
7. Mentee notified with new time and message
8. Mentee can accept or decline new time

**Backend**: `PATCH /api/sessions/:id/reschedule`
**Frontend**: `SessionsScreen` → Decline & Reschedule button → Time picker

**Implementation Options**:
- Option A: Cancel original, create new session
- Option B: Update existing session with new time and status="rescheduled"
- Option C: Create reschedule request (separate entity)

**Recommended**: Option B - Update existing session

---

### Use Case 5: Mentor Confirms Accepted Session
**Actor**: Mentor
**Flow**:
1. Mentor has accepted session (status="confirmed")
2. Before session time, mentor confirms attendance
3. Sets mentorConfirmed = true
4. Used for attendance tracking

**Backend**: `PATCH /api/sessions/:id/confirm { type: "mentor" }`
**Frontend**: `SessionsScreen` → Upcoming tab → Confirm button

---

### Use Case 6: Mentee Responds to Reschedule
**Actor**: Mentee
**Flow**:
1. Mentee receives notification about reschedule
2. Mentee sees new proposed time
3. Mentee can:
   - Accept new time → Session status → "confirmed"
   - Decline new time → Session status → "cancelled"

**Backend**: 
- Accept: `PATCH /api/sessions/:id/status { status: "confirmed" }`
- Decline: `DELETE /api/sessions/:id`

---

## Database Schema

### Session Entity Fields Used:
- `status`: SESSION_STATUS enum
  - `scheduled`: Initial request (waiting for mentor)
  - `confirmed`: Mentor accepted
  - `rescheduled`: Mentor suggested new time
  - `cancelled`: Declined/cancelled
  - `in_progress`: Session started
  - `completed`: Session finished

- `mentorConfirmed`: boolean (attendance confirmation)
- `menteeConfirmed`: boolean (attendance confirmation)
- `cancellationReason`: string (reason for decline)
- `scheduledAt`: datetime (session time)

---

## API Endpoints

### Existing Endpoints:
- `POST /api/sessions` - Create session (mentee)
- `GET /api/sessions` - Get user sessions
- `GET /api/sessions/:id` - Get session details
- `PATCH /api/sessions/:id/status` - Update status (accept)
- `DELETE /api/sessions/:id` - Cancel session (decline)

### New Endpoints Needed:
- `PATCH /api/sessions/:id/reschedule` - Decline and reschedule
- `PATCH /api/sessions/:id/confirm` - Confirm attendance

---

## Frontend Screens

### Mentee:
- `RequestSessionScreen` - Request new session ✅
- `ScheduleScreen` - View sessions (pending/upcoming/history) ✅
- `SessionDetailsScreen` - View session details

### Mentor:
- `SessionsScreen` - View all sessions ✅
  - Pending tab: status="scheduled"
  - Upcoming tab: status="confirmed"
  - History tab: status="completed"
- `SessionCard` - Display session with actions ✅
  - Accept button
  - Decline button
  - Decline & Reschedule button (NEW)

---

## Notifications

### When to Send:
1. **Mentee requests session** → Notify mentor
2. **Mentor accepts** → Notify mentee
3. **Mentor declines** → Notify mentee (with reason)
4. **Mentor reschedules** → Notify mentee (with new time)
5. **Mentee accepts reschedule** → Notify mentor
6. **Mentee declines reschedule** → Notify mentor

---

## Implementation Priority

1. ✅ Basic request/accept/decline (already implemented)
2. ⏳ Decline with reason (enhancement)
3. ⏳ Decline and reschedule (new feature)
4. ⏳ Mentor confirmation (attendance tracking)
5. ⏳ Notifications (enhancement)

