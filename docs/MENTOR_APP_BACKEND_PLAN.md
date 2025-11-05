# Mentor App - Complete Backend Plan & Architecture

## 📋 **Current Backend Status**

### ✅ **What's Already Implemented**

1. **Authentication System**

   - ✅ Email registration (`POST /api/mentor-app/email-registration`)
   - ✅ OTP verification (`POST /api/mentor-app/verify-otp`)
   - ✅ Profile update (`PUT /api/mentor-app/update-profile`)
   - ✅ Role selection (`POST /api/mentor-app/select-role`)
   - ✅ JWT token management (access + refresh tokens)
   - ✅ User entity with mentor app fields

2. **Session Management**

   - ✅ Full CRUD for sessions
   - ✅ Session status management
   - ✅ Mentor availability system
   - ✅ Available slots calculation
   - ⚠️ **Issue**: Query validation expects body validation (needs fix)

3. **Infrastructure**
   - ✅ TypeORM + MySQL
   - ✅ Zod validation
   - ✅ Logger service
   - ✅ Error handling middleware
   - ✅ Authentication middleware
   - ✅ Role-based access control

---

## 🔧 **Immediate Fix Required**

### **Problem**: GET `/api/sessions` Validation Error

**Root Cause**: The `sessionQuerySchema` validates query parameters but the route applies validation to the body/params.

**Solution**: Update the validation middleware to properly handle query parameters OR create a separate query validation.

```typescript
// Option 1: Fix in session.routes.ts
router.get(
  '/',
  validate(sessionQuerySchema, 'query'), // Specify validation source
  sessionController.getUserSessions
);

// Option 2: Update validation.ts to support validation sources
export const validate = (
  schema: AnyZodObject,
  source: 'body' | 'query' | 'params' | 'all' = 'all'
) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      let dataToValidate = {};

      switch (source) {
        case 'body':
          dataToValidate = req.body;
          break;
        case 'query':
          dataToValidate = req.query;
          break;
        case 'params':
          dataToValidate = req.params;
          break;
        case 'all':
        default:
          dataToValidate = {
            ...req.body,
            ...req.query,
            ...req.params,
          };
      }

      await schema.parseAsync(dataToValidate);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.errors.map((err) => ({
          path: err.path.join('.'),
          message: err.message,
        }));
        next(new ValidationError('Validation failed', formattedErrors));
      } else {
        next(error);
      }
    }
  };
};
```

---

## 🏗️ **Backend Architecture Overview**

```
mentor-backend/
├── src/
│   ├── common/                    # Shared utilities
│   │   ├── middleware/
│   │   │   └── validation.ts      # Zod validation middleware
│   │   ├── errors/                # Custom error classes
│   │   ├── logger/                # Winston logger
│   │   └── helpers/               # Response helpers
│   │
│   ├── config/                    # App configuration
│   │   ├── data-source.ts         # TypeORM config
│   │   └── index.ts               # Environment config
│   │
│   ├── database/
│   │   ├── entities/              # TypeORM entities
│   │   │   ├── user.entity.ts     # ✅ User (with role, mentor fields)
│   │   │   ├── session.entity.ts  # ✅ Session
│   │   │   ├── mentorAvailability.entity.ts  # ✅ Availability
│   │   │   ├── mentorProfile.entity.ts       # Mentor-specific data
│   │   │   ├── menteeProfile.entity.ts       # Mentee-specific data
│   │   │   └── passwordReset.entity.ts       # ✅ OTP storage
│   │   └── migrations/            # Database migrations
│   │
│   ├── controllers/               # Request handlers
│   │   ├── auth.controller.ts     # ✅ Auth endpoints
│   │   ├── session.controller.ts  # ✅ Session management
│   │   ├── mentorProfile.controller.ts
│   │   └── menteeProfile.controller.ts
│   │
│   ├── services/                  # Business logic
│   │   ├── auth.service.ts        # ✅ Auth logic
│   │   ├── session.service.ts     # ✅ Session logic
│   │   ├── mentorProfile.service.ts
│   │   └── email.service.ts       # ✅ Email sending
│   │
│   ├── routes/                    # API routes
│   │   ├── auth.routes.ts         # ✅ /api/mentor-app/...
│   │   ├── session.routes.ts      # ✅ /api/sessions
│   │   └── index.ts               # Route aggregator
│   │
│   ├── validation/                # Zod schemas
│   │   ├── auth.validation.ts     # ✅ Auth schemas
│   │   ├── session.validation.ts  # ✅ Session schemas
│   │   └── profile.validation.ts
│   │
│   ├── middleware/
│   │   └── auth.middleware.ts     # ✅ JWT validation, role checks
│   │
│   └── index.ts                   # ✅ Express app entry
```

---

## 📱 **Frontend → Backend API Map**

### **Authentication Flow**

| Screen                    | Frontend Action | Backend Endpoint                          | Status   |
| ------------------------- | --------------- | ----------------------------------------- | -------- |
| `EmailLoginScreen`        | Enter email     | `POST /api/mentor-app/email-registration` | ✅ Ready |
| `OTPVerificationScreen`   | Enter OTP       | `POST /api/mentor-app/verify-otp`         | ✅ Ready |
| `BirthdaySelectionScreen` | Submit profile  | `PUT /api/mentor-app/update-profile`      | ✅ Ready |
| `RoleSelectionScreen`     | Select role     | `POST /api/mentor-app/select-role`        | ✅ Ready |

### **Mentor Screens**

| Screen              | Data Needed               | Backend Endpoint                                      | Status            |
| ------------------- | ------------------------- | ----------------------------------------------------- | ----------------- |
| `HomeScreen`        | Today's sessions, mentees | `GET /api/mentor/dashboard`                           | ⏳ TODO           |
| `SessionsScreen`    | Sessions by status        | `GET /api/sessions?status=pending/upcoming/completed` | ⚠️ Fix validation |
| `MenteesScreen`     | All mentees               | `GET /api/mentor/mentees`                             | ⏳ TODO           |
| `ProfileScreen`     | Mentor profile + stats    | `GET /api/mentor/profile`                             | ⏳ TODO           |
| `EditProfileScreen` | Update profile            | `PUT /api/mentor/profile`                             | ⏳ TODO           |
| `EditProfileScreen` | Upload photo              | `PUT /api/mentor/profile/photo`                       | ⏳ TODO           |

### **Session Actions**

| Action           | Endpoint                                             | Status   |
| ---------------- | ---------------------------------------------------- | -------- |
| Accept session   | `POST /api/sessions/:id/accept`                      | ⏳ TODO  |
| Decline session  | `POST /api/sessions/:id/decline`                     | ⏳ TODO  |
| Join session     | `GET /api/sessions/:id/join`                         | ⏳ TODO  |
| Complete session | `PATCH /api/sessions/:id/status` (status: completed) | ✅ Ready |

---

## 🎯 **Phased Implementation Plan**

### **Phase 1: Fix Current Issues** ⚠️ PRIORITY

**Tasks:**

1. Fix session query validation
2. Test auth flow end-to-end
3. Verify token persistence and refresh

**Deliverables:**

- ✅ `/api/sessions` works with query parameters
- ✅ Auth flow works from frontend
- ✅ Tokens stored securely in frontend

---

### **Phase 2: Mentor Dashboard API**

**New Endpoints to Create:**

```typescript
// GET /api/mentor/dashboard
{
  todaysSessions: [
    {
      id: string;
      mentee: { id, name, avatar };
      scheduledAt: DateTime;
      status: 'pending' | 'accepted';
    }
  ],
  recentMentees: [
    {
      id: string;
      name: string;
      avatar: string;
      lastSeen: DateTime;
    }
  ],
  stats: {
    totalMentees: number;
    activeSessions: number;
    upcomingSessions: number;
  }
}
```

**Implementation:**

1. Create `MentorDashboardService`
2. Create `mentor.controller.ts`
3. Add route `GET /api/mentor/dashboard`
4. Add validation schema
5. Wire to `HomeScreen.tsx`

---

### **Phase 3: Session Actions**

**New Endpoints:**

```typescript
// POST /api/sessions/:id/accept
// POST /api/sessions/:id/decline
{
  sessionId: string;
  reason?: string; // For decline
}

// Response
{
  session: SessionDTO;
  message: string;
}
```

**Implementation:**

1. Add methods to `SessionService`:
   - `acceptSession(sessionId, mentorId)`
   - `declineSession(sessionId, mentorId, reason?)`
2. Add controller methods
3. Add routes
4. Update `SessionsScreen.tsx` to call these endpoints
5. Add optimistic updates in frontend

---

### **Phase 4: Mentees Management**

**New Endpoints:**

```typescript
// GET /api/mentor/mentees
// Query: ?page=1&limit=20&search=name
{
  mentees: [
    {
      id: string;
      name: string;
      avatar: string;
      lastSeen: DateTime;
      activeSessions: number;
      totalSessions: number;
    }
  ],
  pagination: {
    total: number;
    page: number;
    pages: number;
  }
}

// GET /api/mentor/mentees/:menteeId
{
  mentee: {
    id, name, avatar, email, bio;
    stats: { totalSessions, completedSessions };
    recentSessions: Session[];
  }
}
```

**Implementation:**

1. Create `MentorshipService`
2. Add to `mentor.controller.ts`
3. Wire to `MenteesScreen.tsx`

---

### **Phase 5: Mentor Profile Management**

**New Endpoints:**

```typescript
// GET /api/mentor/profile
{
  profile: {
    id, firstName, lastName, email, avatar, bio, location;
    stats: {
      role: 'Mentor';
      totalMentees: number;
      rating: number;
      totalSessions: number;
    }
    availability: string; // Bio text
    settings: {
      email: string;
      notificationsEnabled: boolean;
    }
  }
}

// PUT /api/mentor/profile
// Body: { firstName, lastName, bio, location, notificationsEnabled }

// PUT /api/mentor/profile/photo
// FormData: { photo: File }
```

**Implementation:**

1. Enhance `MentorProfileService`
2. Add aggregate queries for stats
3. Add file upload handling (multer + S3/local)
4. Wire to `ProfileScreen.tsx` and `EditProfileScreen.tsx`

---

### **Phase 6: Real-time Features** (Future)

- WebSocket for session status updates
- Real-time notifications
- Live chat during sessions

---

## 🗄️ **Database Schema (Current + Needed)**

### **Existing Tables** ✅

```sql
users (
  id UUID PRIMARY KEY,
  email VARCHAR UNIQUE,
  firstName VARCHAR,
  lastName VARCHAR,
  role ENUM('mentor', 'mentee'),
  gender VARCHAR,
  country VARCHAR,
  countryCode VARCHAR,
  birthday DATE,
  isOnboardingComplete BOOLEAN,
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP
)

sessions (
  id UUID PRIMARY KEY,
  mentorId UUID FK,
  menteeId UUID FK,
  status ENUM,
  scheduledAt TIMESTAMP,
  startedAt TIMESTAMP,
  endedAt TIMESTAMP,
  ...
)

mentor_availability (
  id UUID PRIMARY KEY,
  mentorId UUID FK,
  dayOfWeek ENUM,
  startTime TIME,
  endTime TIME,
  ...
)
```

### **Tables to Add** ⏳

```sql
mentor_profiles (
  id UUID PRIMARY KEY,
  userId UUID FK UNIQUE,
  bio TEXT,
  location VARCHAR,
  photoUrl VARCHAR,
  notificationsEnabled BOOLEAN DEFAULT true,
  rating DECIMAL(3,2),
  totalRatings INT,
  ...
)

mentee_profiles (
  id UUID PRIMARY KEY,
  userId UUID FK UNIQUE,
  bio TEXT,
  photoUrl VARCHAR,
  ...
)

mentorships (
  id UUID PRIMARY KEY,
  mentorId UUID FK,
  menteeId UUID FK,
  status ENUM('active', 'paused', 'ended'),
  startedAt TIMESTAMP,
  endedAt TIMESTAMP,
  ...
)

session_actions (
  id UUID PRIMARY KEY,
  sessionId UUID FK,
  userId UUID FK,
  action ENUM('accept', 'decline', 'cancel', 'complete'),
  reason TEXT,
  createdAt TIMESTAMP
)
```

---

## 🔐 **Security Checklist**

- ✅ JWT authentication
- ✅ Role-based access control
- ✅ Password hashing (for OTP)
- ✅ Input validation (Zod)
- ⏳ Rate limiting on auth endpoints
- ⏳ CORS configuration
- ⏳ SQL injection prevention (TypeORM parameterized queries)
- ⏳ File upload validation (size, type)
- ⏳ Token refresh mechanism

---

## 🧪 **Testing Strategy**

### **Current Test Files**

- ✅ `test-auth-integration.js`
- ✅ `test-session-complete.js`
- ✅ `test-mentor-api.js`

### **Tests Needed**

1. Auth flow: email → OTP → profile → role
2. Session CRUD: create, list, update, cancel
3. Session actions: accept, decline, complete
4. Mentor profile: get, update, photo upload
5. Mentees list: pagination, search
6. Authorization: role checks, ownership checks

---

## 📝 **Next Steps (Prioritized)**

### **Immediate (Day 1)**

1. ✅ Fix session query validation
2. ✅ Test `/api/sessions` endpoint
3. ✅ Document all current endpoints

### **Short-term (Week 1)**

1. Create mentor dashboard endpoint
2. Add session accept/decline actions
3. Wire frontend `HomeScreen` and `SessionsScreen` to backend

### **Medium-term (Week 2-3)**

1. Implement mentees management
2. Implement profile management
3. Add file upload for profile photos
4. Add comprehensive error handling

### **Long-term (Week 4+)**

1. Add real-time features
2. Add notifications system
3. Performance optimization
4. Comprehensive testing suite

---

## 🚀 **How to Proceed**

1. **Fix validation issue** (5 mins)
2. **Test auth flow** with Postman/frontend (30 mins)
3. **Create mentor dashboard endpoint** (2-3 hours)
4. **Wire frontend to backend** incrementally (ongoing)

Would you like me to start with **fixing the validation issue** and then move on to creating the mentor dashboard endpoint?
