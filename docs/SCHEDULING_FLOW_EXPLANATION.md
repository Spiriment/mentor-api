# Complete Session Scheduling Flow & Use Cases

## Overview
This document explains the complete session scheduling flow from mentee request to mentor confirmation, including all use cases and decision points.

---

## 📋 Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    MENTEE SIDE                              │
└─────────────────────────────────────────────────────────────┘

1. Browse Mentors
   └─> View mentor profiles, availability, reviews

2. Request Session
   └─> Select mentor
   └─> Choose date from available dates
   └─> Select time slot (only available slots shown)
   └─> Add description/notes
   └─> Submit request
   └─> POST /api/sessions
   └─> Status: "scheduled" (waiting for mentor)

3. Wait for Response
   └─> Session appears in "Pending" tab
   └─> Can see status: scheduled/rescheduled

4. Receive Response
   └─> If ACCEPTED: Status → "confirmed" (moves to "Upcoming")
   └─> If DECLINED: Status → "cancelled" (removed from list)
   └─> If RESCHEDULED: Status → "rescheduled" (can accept/decline new time)

5. Respond to Reschedule (if applicable)
   └─> Accept new time → Status → "confirmed"
   └─> Decline new time → Status → "cancelled"

┌─────────────────────────────────────────────────────────────┐
│                    MENTOR SIDE                              │
└─────────────────────────────────────────────────────────────┘

1. Receive Session Request
   └─> Notification/alert about new request
   └─> Appears in "Pending" tab
   └─> Shows: mentee name, requested date/time, description

2. Review Request
   └─> Can see mentee profile
   └─> Can see requested date/time
   └─> Can see mentee's message/description

3. Make Decision (3 Options):

   OPTION A: ACCEPT
   └─> Click "Accept" button
   └─> PATCH /api/sessions/:id/status { status: "confirmed" }
   └─> Session moves to "Upcoming" tab
   └─> Both parties notified
   └─> Session is now confirmed

   OPTION B: DECLINE (Simple)
   └─> Click "Decline" button
   └─> Modal appears with 2 options:
       ├─> "Decline (with optional reason)"
       └─> "Decline & Reschedule"
   └─> If "Decline":
       └─> Enter optional reason
       └─> DELETE /api/sessions/:id { reason: "..." }
       └─> Status → "cancelled"
       └─> Mentee notified with reason

   OPTION C: DECLINE & RESCHEDULE
   └─> Click "Decline" → Select "Decline & Reschedule"
   └─> Reschedule modal opens:
       ├─> Select new date (from next 4 weeks)
       ├─> Select new time slot (from mentor availability)
       └─> Add optional message
   └─> PATCH /api/sessions/:id/reschedule
   └─> Status → "rescheduled"
   └─> Mentee notified with new time and message
   └─> Mentee can accept or decline new time

4. Confirm Accepted Session (Before Start)
   └─> For confirmed sessions in "Upcoming" tab
   └─> Can confirm attendance
   └─> PATCH /api/sessions/:id/confirm
   └─> Sets mentorConfirmed = true
   └─> Used for attendance tracking
```

---

## 🎯 Detailed Use Cases

### Use Case 1: Mentee Requests Session

**Actor**: Mentee  
**Preconditions**: 
- Mentee is logged in
- Mentor exists and has set availability

**Flow**:
1. Mentee navigates to mentor profile
2. Clicks "Request Session"
3. Sees available dates (next 4 weeks)
4. Selects a date
5. Sees available time slots for that date (only slots where mentor is available)
6. Selects a time slot
7. Adds description/notes (optional)
8. Clicks "Send Request"
9. Backend validates:
   - Mentor exists
   - Time slot is available
   - No conflict with existing sessions
10. Session created with status="scheduled"
11. Mentor receives notification

**Postconditions**:
- Session appears in mentee's "Pending" tab
- Session appears in mentor's "Pending" tab
- Both parties can see session details

---

### Use Case 2: Mentor Accepts Request

**Actor**: Mentor  
**Preconditions**:
- Mentor has a pending session request (status="scheduled")
- Mentor is logged in

**Flow**:
1. Mentor opens "Sessions" screen
2. Sees request in "Pending" tab
3. Reviews mentee info and request details
4. Clicks "Accept" button
5. Backend updates session:
   - Status → "confirmed"
   - mentorConfirmed = false (will be set when mentor confirms attendance)
6. Session moves to "Upcoming" tab for both parties
7. Both parties receive notification

**Postconditions**:
- Session status = "confirmed"
- Session visible in "Upcoming" tab for both parties
- Session can be confirmed for attendance later

---

### Use Case 3: Mentor Declines Request (Simple)

**Actor**: Mentor  
**Preconditions**:
- Mentor has a pending session request
- Mentor is logged in

**Flow**:
1. Mentor opens "Sessions" screen
2. Sees request in "Pending" tab
3. Clicks "Decline" button
4. **Decline Options Modal** appears with 2 choices:
   - "Decline (with optional reason)"
   - "Decline & Reschedule"
5. Mentor selects "Decline (with optional reason)"
6. **Decline Reason Modal** appears
7. Mentor optionally enters reason (e.g., "Not available", "Don't have capacity")
8. Clicks "Decline"
9. Backend updates session:
   - Status → "cancelled"
   - cancellationReason = reason (if provided)
   - cancelledAt = current timestamp
10. Session removed from pending list
11. Mentee receives notification with reason

**Postconditions**:
- Session status = "cancelled"
- Session removed from both parties' lists
- Mentee notified with reason

**Common Reasons**:
- "I'm not available at this time"
- "I don't have capacity for new mentees"
- "This doesn't align with my expertise"
- "Other commitments"

---

### Use Case 4: Mentor Declines & Reschedules

**Actor**: Mentor  
**Preconditions**:
- Mentor has a pending session request
- Mentor is logged in
- Mentor has availability for alternative times

**Flow**:
1. Mentor opens "Sessions" screen
2. Sees request in "Pending" tab
3. Clicks "Decline" button
4. **Decline Options Modal** appears
5. Mentor selects "Decline & Reschedule"
6. **Reschedule Modal** opens:
   - Shows date picker (next 4 weeks)
   - Shows time slot picker (from mentor's availability)
   - Optional message field
7. Mentor selects new date
8. System loads available time slots for that date
9. Mentor selects new time slot
10. Mentor optionally adds message (e.g., "How about this time instead?")
11. Clicks "Reschedule"
12. Backend validates:
    - New time is within mentor's availability
    - No conflict with existing sessions
13. Backend updates session:
    - scheduledAt → new date/time
    - Status → "rescheduled"
    - cancellationReason = "Not available at requested time"
    - mentorNotes = message (if provided)
14. Mentee receives notification with new time and message
15. Session appears in mentee's list with status="rescheduled"

**Postconditions**:
- Session status = "rescheduled"
- Session has new scheduledAt time
- Mentee can accept or decline new time
- If mentee accepts → status → "confirmed"
- If mentee declines → status → "cancelled"

---

### Use Case 5: Mentee Responds to Reschedule

**Actor**: Mentee  
**Preconditions**:
- Mentee has a rescheduled session (status="rescheduled")
- Mentee is logged in

**Flow**:
1. Mentee receives notification about reschedule
2. Opens "Sessions" screen
3. Sees session with status="rescheduled"
4. Sees new proposed date/time
5. Sees mentor's message (if provided)
6. Two options:

   **Option A: Accept New Time**
   - Clicks "Accept"
   - PATCH /api/sessions/:id/status { status: "confirmed" }
   - Status → "confirmed"
   - Session moves to "Upcoming" tab
   - Mentor notified

   **Option B: Decline New Time**
   - Clicks "Decline"
   - DELETE /api/sessions/:id
   - Status → "cancelled"
   - Session removed from list
   - Mentor notified

**Postconditions**:
- If accepted: Session confirmed, both parties can see in "Upcoming"
- If declined: Session cancelled, removed from both lists

---

### Use Case 6: Mentor Confirms Attendance

**Actor**: Mentor  
**Preconditions**:
- Mentor has a confirmed session (status="confirmed")
- Session is in "Upcoming" tab
- Session time is approaching

**Flow**:
1. Mentor opens "Sessions" screen
2. Navigates to "Upcoming" tab
3. Sees confirmed session
4. Before session time, clicks "Confirm" (if available)
5. PATCH /api/sessions/:id/confirm
6. Backend sets mentorConfirmed = true
7. Used for attendance tracking

**Postconditions**:
- mentorConfirmed = true
- Can track who confirmed attendance before session

**Note**: This is separate from accepting the request. This is for confirming attendance before the session starts.

---

## 📊 Session Status Transitions

```
┌─────────────┐
│  SCHEDULED  │ ← Initial state when mentee requests
└──────┬──────┘
       │
       ├─────────────────┐
       │                 │
       ▼                 ▼
┌─────────────┐   ┌──────────────┐
│  CONFIRMED  │   │  CANCELLED   │
└──────┬──────┘   └──────────────┘
       │
       ▼
┌─────────────┐
│IN_PROGRESS │ ← When session starts
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  COMPLETED  │ ← When session ends
└─────────────┘

Alternative path:
┌─────────────┐
│  SCHEDULED  │
└──────┬──────┘
       │
       │ (Mentor reschedules)
       ▼
┌─────────────┐
│ RESCHEDULED │ ← Mentor suggests new time
└──────┬──────┘
       │
       ├─────────────────┐
       │                 │
       ▼                 ▼
┌─────────────┐   ┌──────────────┐
│  CONFIRMED  │   │  CANCELLED   │
└─────────────┘   └──────────────┘
 (Mentee accepts)  (Mentee declines)
```

---

## 🔔 Notification Flow

### When Notifications Are Sent:

1. **Mentee Requests Session**
   - → Notify mentor: "New session request from [Mentee Name]"

2. **Mentor Accepts**
   - → Notify mentee: "Your session request has been accepted!"

3. **Mentor Declines (Simple)**
   - → Notify mentee: "Your session request has been declined. Reason: [reason]"

4. **Mentor Reschedules**
   - → Notify mentee: "Your session has been rescheduled to [new date/time]. Message: [message]"

5. **Mentee Accepts Reschedule**
   - → Notify mentor: "[Mentee Name] accepted the rescheduled time"

6. **Mentee Declines Reschedule**
   - → Notify mentor: "[Mentee Name] declined the rescheduled time"

---

## 🎨 UI Components

### Mentor Sessions Screen

**Pending Tab**:
- Shows sessions with status="scheduled" or "rescheduled"
- Each session card has:
  - Mentee name & avatar
  - Requested date/time
  - Description
  - Actions: "Accept" | "Decline"

**Upcoming Tab**:
- Shows sessions with status="confirmed"
- Each session card has:
  - Mentee name & avatar
  - Scheduled date/time
  - Actions: "Join" | "Confirm" (attendance)

**History Tab**:
- Shows sessions with status="completed"
- Each session card shows:
  - Mentee name & avatar
  - Date/time
  - Session notes/feedback

### Modals

1. **Decline Options Modal**
   - Two buttons: "Decline" | "Decline & Reschedule"

2. **Decline Reason Modal**
   - Text input for reason (optional)
   - "Cancel" | "Decline" buttons

3. **Reschedule Modal**
   - Date picker (horizontal scroll)
   - Time slot picker (shows only available slots)
   - Message input (optional)
   - "Cancel" | "Reschedule" buttons

---

## 🔒 Permissions & Validation

### Backend Validations:

1. **Session Creation**:
   - Only mentees can create sessions
   - Mentor must exist
   - Time must be within mentor's availability
   - No conflict with existing sessions

2. **Accept Session**:
   - Only mentor can accept
   - Session must be in "scheduled" status
   - User must be the mentor for this session

3. **Decline Session**:
   - Mentor or mentee can decline
   - Session cannot be completed
   - Reason is optional

4. **Reschedule Session**:
   - Only mentor can reschedule
   - New time must be within mentor's availability
   - No conflict with existing sessions
   - Session cannot be completed or cancelled

5. **Confirm Attendance**:
   - Mentor can confirm as mentor
   - Mentee can confirm as mentee
   - Session must be "confirmed" status

---

## 📱 API Endpoints Summary

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/sessions` | Create session request | Mentee |
| GET | `/api/sessions` | Get user sessions | Both |
| GET | `/api/sessions/:id` | Get session details | Both |
| PATCH | `/api/sessions/:id/status` | Update status (accept) | Both |
| DELETE | `/api/sessions/:id` | Cancel session (decline) | Both |
| PATCH | `/api/sessions/:id/reschedule` | Reschedule session | Mentor |
| PATCH | `/api/sessions/:id/confirm` | Confirm attendance | Both |
| GET | `/api/sessions/mentor/:id/availability/:date` | Get available slots | Both |

---

## ✅ Implementation Checklist

### Backend ✅
- [x] Session entity with all statuses
- [x] Create session endpoint
- [x] Accept session endpoint
- [x] Decline session endpoint (with reason)
- [x] Reschedule session endpoint
- [x] Confirm attendance endpoint
- [x] Get available slots endpoint
- [x] Validation schemas
- [x] Permission checks

### Frontend ✅
- [x] SessionsScreen with tabs
- [x] Decline options modal
- [x] Decline reason modal
- [x] Reschedule modal with date/time pickers
- [x] Session service methods
- [x] Error handling
- [x] Loading states

### Notifications ⏳
- [ ] Email notifications
- [ ] Push notifications
- [ ] In-app notifications

---

## 🎯 Key Features

1. **Flexible Decline Options**: Mentor can simply decline or suggest alternative time
2. **Availability-Based Scheduling**: Only shows times when mentor is actually available
3. **Reschedule Flow**: Smooth flow for suggesting new times
4. **Attendance Confirmation**: Track who confirmed before session
5. **Status Tracking**: Clear status transitions throughout the flow
6. **User-Friendly UI**: Modals and clear action buttons

---

This complete flow ensures both mentees and mentors have full control over session scheduling with clear communication at every step.

