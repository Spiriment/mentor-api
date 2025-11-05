# Session Scheduling Flow - Complete Integration

## Overview
The session scheduling system is now fully integrated between frontend and backend. Mentees can request sessions, and mentors can see, accept, or decline them.

## Flow Diagram

```
Mentee Side:
1. RequestSessionScreen → Select mentor, date, time, description
2. POST /api/sessions → Creates session with status="scheduled"
3. ScheduleScreen → Shows mentee's sessions (Upcoming/Past/All)

Mentor Side:
1. SessionsScreen → Shows all sessions where mentorId matches
   - Pending tab: status="scheduled" (waiting for acceptance)
   - Upcoming tab: status="confirmed" (accepted by mentor)
   - History tab: status="completed"
2. Accept → PATCH /api/sessions/:id/status → Updates to "confirmed"
3. Decline → DELETE /api/sessions/:id → Cancels session
```

## Backend Implementation

### Session Creation
- **Endpoint**: `POST /api/sessions`
- **Auth**: Requires mentee role
- **Status**: Creates with `status="scheduled"`
- **Relations**: Links `mentorId` and `menteeId`

### Session Retrieval
- **Endpoint**: `GET /api/sessions`
- **Filtering**: 
  - For mentors: `WHERE mentorId = userId`
  - For mentees: `WHERE menteeId = userId`
- **Relations**: Returns sessions with `mentor` and `mentee` relations loaded
- **Query Params**: 
  - `status`: Filter by status (scheduled, confirmed, completed, etc.)
  - `upcoming`: Filter for future sessions
  - `limit`, `offset`: Pagination

### Session Updates
- **Accept**: `PATCH /api/sessions/:id/status` with `{ status: "confirmed" }`
- **Decline**: `DELETE /api/sessions/:id` with optional `{ reason: "..." }`
- **Update**: `PUT /api/sessions/:id` for other updates

## Frontend Implementation

### Mentee Screens

#### RequestSessionScreen
- ✅ **Integrated**: Uncommented and connected to backend
- ✅ **Features**:
  - Loads mentor profile
  - Creates session via `sessionService.createSession()`
  - Shows success/error messages
  - Navigates back on success

#### ScheduleScreen (Mentee)
- ✅ **Integrated**: Loads sessions from backend
- ✅ **Features**:
  - Fetches sessions via `sessionService.getUserSessions()`
  - Enhances with mentor information
  - Filters by tab (Upcoming/Past/All)
  - Pull-to-refresh support

### Mentor Screens

#### SessionsScreen (Mentor)
- ✅ **Integrated**: Fully connected to backend
- ✅ **Features**:
  - Loads sessions filtered by mentor role
  - Maps backend statuses to frontend:
    - `scheduled` → `pending`
    - `confirmed` → `accepted`
    - `completed` → `completed`
  - Accept/Decline functionality
  - Shows mentee info from loaded relations
  - Pull-to-refresh support

## Status Mapping

| Backend Status | Frontend Display | Tab |
|---------------|------------------|-----|
| `scheduled` | Pending | Pending (Mentor) |
| `confirmed` | Accepted | Upcoming (Mentor) |
| `completed` | Completed | History (Mentor) |
| `cancelled` | Cancelled | History |

## Data Flow

### When Mentee Creates Session:
1. Frontend calls `POST /api/sessions` with:
   ```json
   {
     "mentorId": "uuid",
     "scheduledAt": "2024-03-15T14:00:00Z",
     "type": "one_on_one",
     "duration": 60,
     "title": "Session with Mentor",
     "description": "Session details"
   }
   ```

2. Backend creates session with:
   - `mentorId`: From request
   - `menteeId`: From authenticated user
   - `status`: `"scheduled"`
   - All other fields from request

3. Session is saved and returned to frontend

### When Mentor Views Sessions:
1. Frontend calls `GET /api/sessions?status=scheduled`
2. Backend filters: `WHERE mentorId = currentUserId AND status = 'scheduled'`
3. Backend returns sessions with `mentor` and `mentee` relations loaded
4. Frontend transforms to `SessionRequest` format for UI

### When Mentor Accepts:
1. Frontend calls `PATCH /api/sessions/:id/status` with `{ status: "confirmed" }`
2. Backend updates session status
3. Frontend refreshes session list

### When Mentor Declines:
1. Frontend calls `DELETE /api/sessions/:id` with optional reason
2. Backend marks session as cancelled
3. Frontend refreshes session list

## Verification

✅ **Mentee can create sessions** - RequestSessionScreen integrated
✅ **Mentee can view their sessions** - ScheduleScreen integrated
✅ **Mentor can see mentee requests** - SessionsScreen shows sessions where mentorId matches
✅ **Mentor can accept sessions** - Accept button updates status to "confirmed"
✅ **Mentor can decline sessions** - Decline button cancels session
✅ **Backend correctly filters by role** - Uses `mentorId` for mentors, `menteeId` for mentees
✅ **Relations are loaded** - Backend includes `mentor` and `mentee` relations

## Testing Checklist

- [ ] Mentee creates session → Appears in mentor's "Pending" tab
- [ ] Mentor accepts session → Moves to "Upcoming" tab
- [ ] Mentor declines session → Session is cancelled
- [ ] Mentee views their sessions → Shows all their sessions
- [ ] Status filtering works correctly
- [ ] Pull-to-refresh works on both screens

## Notes

- The backend automatically loads `mentor` and `mentee` relations when fetching sessions
- Frontend transforms backend format to UI format for display
- Session IDs are UUIDs in backend, converted to numeric IDs for frontend compatibility
- Date/time formatting is handled in frontend for display

