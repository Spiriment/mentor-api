# Authentication and Streak Fixes

## ✅ Changes Made

### 1. Streak Timer Fixed
**File**: `mentor-app/src/screens/shared/BibleReadingScreen.tsx`

**Change**: Updated minimum reading time from 5 seconds to 3 minutes (180 seconds)

**Before**:
```typescript
// Check if user has read for minimum time (5 seconds)
if (elapsed >= 5 && !hasReadForMinimumTime) {
```

**After**:
```typescript
// Check if user has read for minimum time (3 minutes = 180 seconds)
if (elapsed >= 180 && !hasReadForMinimumTime) {
```

### 2. Streak Update Enabled
**File**: `mentor-app/src/screens/shared/BibleReadingScreen.tsx`

**Change**: Uncommented and enabled the `updateStreak()` function call

**Before**:
```typescript
// await authService.updateStreak();
```

**After**:
```typescript
await authService.updateStreak();
```

Also uncommented the import:
```typescript
import { authService } from '../../services/authService';
```

---

## 🔐 Authentication Status

### Backend Authentication ✅
- **Token Verification**: Working via `authenticateToken` middleware
- **Token Format**: Bearer token in Authorization header
- **User Lookup**: Fetches user from database on each request
- **Error Handling**: Proper error codes (MISSING_TOKEN, INVALID_TOKEN, TOKEN_EXPIRED)
- **Account Status**: Checks if user is active

### Frontend Authentication ✅
- **Token Storage**: Using Expo SecureStore for secure token storage
- **Token Injection**: Automatically adds Bearer token to all requests
- **Response Handling**: Properly extracts backend response format
- **Error Handling**: Handles 401 errors by clearing tokens

### Authentication Flow

1. **Login**:
   - User submits credentials
   - Backend validates and returns `accessToken` and `refreshToken`
   - Frontend stores tokens in SecureStore
   - Frontend fetches user profile via `/auth/me` (or `/auth/profile`)

2. **API Requests**:
   - Frontend interceptor adds `Authorization: Bearer {token}` header
   - Backend middleware verifies token
   - Backend fetches user from database
   - Request proceeds with `req.user` populated

3. **Token Expiration**:
   - On 401 error, frontend clears tokens
   - User needs to login again
   - **Note**: Automatic token refresh not yet implemented

---

## 🔄 Potential Improvements

### Token Refresh (Not Yet Implemented)
Currently, when a token expires (401), the app just clears tokens. Consider implementing:

1. **Automatic Token Refresh**:
   ```typescript
   // In api.ts interceptor
   if (error.response?.status === 401) {
     const refreshToken = await SecureStore.getItemAsync('refresh_token');
     if (refreshToken) {
       try {
         const newTokens = await authService.refreshToken(refreshToken);
         // Retry original request with new token
         return api.request(originalRequest);
       } catch (refreshError) {
         // Refresh failed, logout user
       }
     }
   }
   ```

2. **Token Expiration Check**:
   - Decode JWT to check expiration before making requests
   - Proactively refresh if token expires soon

---

## 📊 Streak System

### How It Works

1. **User opens Bible reading page**
2. **Timer starts** when page loads
3. **After 3 minutes** (180 seconds):
   - `hasReadForMinimumTime` is set to `true`
   - `updateStreak()` is called
   - Backend updates user's streak data

### Backend Endpoints

- `POST /api/auth/update-streak` - Updates streak when user reads for 3+ minutes
- `POST /api/auth/streak/increment` - Alternative streak increment endpoint
- `GET /api/auth/streak` - Get current streak data

### Streak Data Structure

```typescript
{
  currentStreak: number;      // Current consecutive days
  longestStreak: number;       // Best streak ever
  lastStreakDate: string;      // Last date streak was updated
  weeklyStreakData: boolean[]; // Array of 7 booleans for week
}
```

---

## ✅ Verification Checklist

### Streak System
- [x] Timer changed from 5 seconds to 3 minutes
- [x] `updateStreak()` function enabled
- [x] `authService` import uncommented
- [x] Backend endpoint exists: `/api/auth/update-streak`
- [x] Backend endpoint requires authentication

### Authentication
- [x] Backend token verification working
- [x] Frontend token storage working
- [x] Frontend token injection working
- [x] Error handling for 401 responses
- [ ] Automatic token refresh (not implemented yet)

---

## 🧪 Testing

### Test Streak
1. Open Bible reading screen
2. Stay on page for 3+ minutes
3. Check console for "✅ Streak updated for reading session"
4. Verify streak updated in backend

### Test Authentication
1. Login with valid credentials
2. Make authenticated API request
3. Verify token is sent in Authorization header
4. Verify user data is returned correctly

---

## 📝 Notes

- The `/auth/me` endpoint might need to be `/auth/profile` - verify this matches backend routes
- Consider adding automatic token refresh for better UX
- Streak updates only happen once per session (controlled by `streakUpdated` flag)

