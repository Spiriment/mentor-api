# Mentor Availability System

## Overview
This document describes how the mentor availability system works to ensure mentees can only select times when mentors are actually available.

## System Flow

### 1. Mentor Sets Availability
- Mentors can set their available times using the availability API
- Availability is stored in `mentor_availability` table
- Supports:
  - Recurring weekly availability (e.g., Monday 9 AM - 5 PM)
  - Specific date overrides
  - Break periods (lunch, etc.)
  - Slot duration (default 30 minutes)

### 2. Mentee Views Available Slots
- When mentee selects a date, frontend calls:
  ```
  GET /api/sessions/mentor/:mentorId/availability/:date
  ```
- Backend calculates available slots based on:
  - Mentor's recurring availability for that day of week
  - Specific date overrides (if any)
  - Break periods
  - Already booked sessions (scheduled or confirmed)

### 3. Frontend Only Shows Available Slots
- Frontend filters to show only slots where `available: true`
- Unavailable slots are hidden from the UI
- If no slots available, shows message: "No available time slots for this date"

### 4. Backend Validation on Session Creation
- When mentee creates session, backend validates:
  - `isMentorAvailable()` checks:
    - Day of week matches mentor's availability
    - Time is within mentor's available hours
    - Not in a break period
    - No existing session at that time (scheduled or confirmed)
  - If validation fails, returns error: "Mentor is not available at the requested time"

## Implementation Details

### Backend Endpoints

#### Get Available Slots
```
GET /api/sessions/mentor/:mentorId/availability/:date
```
- Returns array of time slots with availability status
- Each slot has: `{ time: "HH:MM", available: boolean }`
- Only generates slots within mentor's available hours
- Marks slots as unavailable if:
  - In a break period
  - Already has a scheduled/confirmed session

#### Create Session
```
POST /api/sessions
```
- Validates mentor availability before creating
- Returns error if mentor not available
- Prevents double-booking

### Frontend Implementation

#### RequestSessionScreen
1. **Date Selection**: Mentee selects a date
2. **Fetch Slots**: Automatically calls `getAvailableSlots()` for selected date
3. **Display Slots**: Only shows slots where `available: true`
4. **Time Selection**: Mentee can only select from available slots
5. **Validation**: Additional check before submitting (no slots = error)

### Database Schema

#### mentor_availability Table
```sql
- mentorId: UUID
- dayOfWeek: 0-6 (Sunday-Saturday)
- startTime: TIME (e.g., "09:00:00")
- endTime: TIME (e.g., "17:00:00")
- status: 'available' | 'unavailable' | 'booked'
- breaks: JSON array of break periods
- slotDuration: INT (minutes, default 30)
- timezone: TEXT
- specificDate: DATE (for one-time overrides)
- isRecurring: BOOLEAN
```

#### sessions Table
- `scheduledAt`: DATETIME (when session is scheduled)
- `status`: 'scheduled' | 'confirmed' | 'completed' | 'cancelled'
- Used to check for existing bookings

## Protection Layers

### Layer 1: Frontend Filtering
- Only shows available slots to mentee
- Prevents selecting unavailable times in UI

### Layer 2: Frontend Validation
- Checks if slots exist before allowing submission
- Validates selected slot is still available

### Layer 3: Backend Validation
- `isMentorAvailable()` method validates:
  - Day of week availability
  - Time range
  - Break periods
  - Existing sessions
- Returns error if validation fails

### Layer 4: Database Constraints
- Unique constraints prevent duplicate bookings
- Foreign key constraints ensure data integrity

## Example Flow

1. **Mentor sets availability**:
   - Monday, 9:00 AM - 5:00 PM
   - 30-minute slots
   - Break: 12:00 PM - 1:00 PM

2. **Mentee selects Monday, March 15**:
   - Frontend calls: `GET /api/sessions/mentor/123/availability/2024-03-15`
   - Backend calculates:
     - 9:00 AM - available ✅
     - 9:30 AM - available ✅
     - ...
     - 12:00 PM - unavailable (break) ❌
     - 12:30 PM - unavailable (break) ❌
     - 1:00 PM - available ✅
     - ...
     - 2:00 PM - unavailable (already booked) ❌
     - 2:30 PM - available ✅

3. **Mentee sees only available slots**:
   - 9:00 AM, 9:30 AM, 10:00 AM, ..., 1:00 PM, 1:30 PM, 2:30 PM, ...
   - Cannot see 12:00 PM, 12:30 PM, or 2:00 PM

4. **Mentee selects 2:30 PM and submits**:
   - Frontend validates: slot exists and is available ✅
   - Backend validates: `isMentorAvailable()` returns true ✅
   - Session created successfully ✅

5. **Next mentee tries to select 2:30 PM**:
   - Backend calculates slots: 2:30 PM now shows `available: false`
   - Frontend doesn't show 2:30 PM option
   - Even if they somehow submit, backend validation rejects it

## Error Handling

### Frontend Errors
- "No available time slots for this date" - No slots available
- "Failed to load available time slots" - API error
- "Selected time slot is no longer available" - Slot became unavailable

### Backend Errors
- "Mentor is not available at the requested time" - Validation failed
- "Mentor not found" - Invalid mentor ID
- "Invalid date format" - Malformed date

## Testing Checklist

- ✅ Mentee can only see available slots
- ✅ Unavailable slots are hidden
- ✅ Break periods are excluded
- ✅ Already booked slots are excluded
- ✅ Backend rejects unavailable time requests
- ✅ Multiple mentees can't book same slot
- ✅ Confirmed sessions block slots
- ✅ Scheduled sessions block slots

## Future Enhancements

1. **Real-time Updates**: WebSocket notifications when slots become unavailable
2. **Buffer Time**: Add buffer between sessions (e.g., 15 min)
3. **Timezone Handling**: Convert times to user's timezone
4. **Waitlist**: Queue mentees when slots are full
5. **Flexible Duration**: Allow different session durations based on slot duration

