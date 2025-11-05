# Mentor Availability Setup - Complete Guide

## Overview
Mentors can set their available days and times, which are saved to the backend. Mentees can then only select from these available times when requesting sessions.

## ✅ Backend Implementation

### Endpoints

#### 1. Create/Update Availability
```
POST /api/sessions/availability
```
- **Auth**: Required (mentor role only)
- **Body**:
  ```json
  {
    "dayOfWeek": 1,          // 0-6 (Sunday-Saturday)
    "startTime": "09:00:00",  // HH:MM:SS format
    "endTime": "17:00:00",    // HH:MM:SS format
    "slotDuration": 60,        // minutes (optional, default 30)
    "timezone": "America/New_York",
    "breaks": [               // optional
      {
        "startTime": "12:00:00",
        "endTime": "13:00:00",
        "reason": "Lunch"
      }
    ],
    "notes": "Available for mentoring" // optional
  }
  ```
- **Behavior**: 
  - If availability exists for the same day, it **updates** it
  - Otherwise, it **creates** new availability
  - Prevents duplicate entries for the same day

#### 2. Get Mentor Availability
```
GET /api/sessions/mentor/:mentorId/availability
```
- Returns all availability records for a mentor
- Includes recurring and specific date availability

#### 3. Get Available Slots for Date
```
GET /api/sessions/mentor/:mentorId/availability/:date
```
- Returns available time slots for a specific date
- Filters out:
  - Break periods
  - Already booked sessions (scheduled or confirmed)
- Only returns slots where `available: true`

### Database Schema

**Table**: `mentor_availability`
- `mentorId`: UUID (foreign key to users)
- `dayOfWeek`: 0-6 (enum)
- `startTime`: TIME (e.g., "09:00:00")
- `endTime`: TIME (e.g., "17:00:00")
- `status`: 'available' | 'unavailable' | 'booked'
- `slotDuration`: INT (minutes, default 30)
- `timezone`: TEXT
- `breaks`: JSON array
- `isRecurring`: BOOLEAN
- `specificDate`: DATE (optional, for one-time overrides)

## ✅ Frontend Implementation

### Mentor Screen: SetAvailabilityScreen

**Location**: `src/screens/mentor/profile/SetAvailabilityScreen.tsx`

**Features**:
1. ✅ Toggle availability for each day of the week
2. ✅ Set start and end times for each day
3. ✅ Set session duration (30, 60, 90, 120 minutes)
4. ✅ Loads existing availability from backend
5. ✅ Updates existing availability instead of creating duplicates
6. ✅ Saves all enabled days to backend

**Navigation**:
- Accessible from ProfileScreen via "Set Availability" button
- Added to MentorNavigator stack

### Flow

1. **Mentor opens Set Availability screen**
   - Loads existing availability (if any)
   - Shows all 7 days with toggle switches

2. **Mentor enables days and sets times**
   - Toggle day on/off
   - Select start time (30-minute intervals)
   - Select end time (must be after start time)
   - Choose session duration

3. **Mentor saves**
   - Only saves enabled days
   - Backend updates existing or creates new
   - Success message shown

4. **Data is saved**
   - Stored in `mentor_availability` table
   - Available for mentees to see when requesting sessions

## ✅ Integration Points

### Backend Validation
- ✅ `isMentorAvailable()` checks availability before session creation
- ✅ `getAvailableSlots()` only returns available slots
- ✅ Prevents booking unavailable times

### Frontend Validation
- ✅ Mentees only see available slots
- ✅ Cannot select unavailable times
- ✅ Backend rejects if somehow an unavailable time is selected

## How It Works End-to-End

### Example: Mentor Sets Availability

1. **Mentor sets**:
   - Monday: 9 AM - 5 PM (60 min slots)
   - Wednesday: 2 PM - 6 PM (30 min slots)
   - Friday: 10 AM - 2 PM (60 min slots)

2. **Backend saves**:
   - 3 records in `mentor_availability` table
   - Status: 'available'
   - isRecurring: true

3. **Mentee requests session**:
   - Selects Monday, March 15
   - Frontend calls: `GET /api/sessions/mentor/123/availability/2024-03-15`
   - Backend calculates:
     - Monday = dayOfWeek 1 ✅
     - Available: 9 AM - 5 PM
     - Slot duration: 60 min
     - Already booked: 2 PM ❌ (has existing session)
   - Returns: `[9:00, 10:00, 11:00, 12:00, 1:00, 3:00, 4:00]` (2 PM excluded)

4. **Mentee selects 10 AM**:
   - Frontend validates: slot exists and available ✅
   - Creates session: `POST /api/sessions`
   - Backend validates: `isMentorAvailable()` ✅
   - Session created ✅

5. **Next mentee tries Monday**:
   - 10 AM now shows `available: false` (booked)
   - Cannot select 10 AM
   - Can select other available times

## Testing Checklist

- ✅ Mentor can set availability for multiple days
- ✅ Availability is saved to database
- ✅ Existing availability is updated (not duplicated)
- ✅ Disabled days don't appear in available slots
- ✅ Mentees can only see available slots
- ✅ Backend prevents booking unavailable times
- ✅ Time slots respect slot duration
- ✅ Break periods are excluded

## Notes

- **Update vs Create**: Backend automatically updates if availability exists for the same day
- **Disabled Days**: If mentor disables a day, it won't be saved. Existing availability for that day remains but won't be used (since it's not in the enabled list)
- **Slot Duration**: Each day can have different slot durations
- **Timezone**: Stored in database, but calculations use UTC
- **Recurring**: Default is recurring (weekly). Specific dates can override

## Future Enhancements

1. **Delete Availability**: Add endpoint to delete/disable specific days
2. **Break Periods UI**: Add UI for setting break periods
3. **Timezone Display**: Show times in user's timezone
4. **Bulk Operations**: Set same schedule for multiple days at once
5. **Templates**: Save and reuse common availability patterns

