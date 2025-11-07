# Mentor Backend Architecture Documentation

## 📋 Overview

The Mentor App backend is a **Node.js/Express/TypeScript** REST API built with:
- **TypeORM** for database management (MySQL)
- **JWT** for authentication
- **Socket.io** for WebSocket/real-time communication
- **Bull/BullMQ** for job queues (optional, currently disabled)
- **Nodemailer** for email services
- **Node-cron** for scheduled tasks
- **Zod** for validation

**Deployed at**: https://api.paxify.org/

---

## 🏗️ Architecture Pattern

The backend follows a **layered architecture** pattern:

```
┌─────────────────────────────────────┐
│         Routes Layer                │  ← HTTP endpoints, route definitions
├─────────────────────────────────────┤
│         Controllers Layer           │  ← Request/response handling
├─────────────────────────────────────┤
│         Services Layer              │  ← Business logic
├─────────────────────────────────────┤
│         Repository Layer            │  ← Data access (optional)
├─────────────────────────────────────┤
│         Database Layer              │  ← TypeORM entities
└─────────────────────────────────────┘
```

---

## 📁 Project Structure

```
mentor-backend/
├── src/
│   ├── index.ts                      # Application entry point
│   │
│   ├── config/                       # Configuration files
│   │   ├── data-source.ts           # TypeORM database configuration
│   │   ├── int-services.ts          # Service initialization (JWT, Logger, etc.)
│   │   └── index.ts                 # Config exports
│   │
│   ├── common/                       # Shared utilities and helpers
│   │   ├── auth/                    # Authentication utilities
│   │   ├── constants/               # App-wide constants
│   │   ├── encryption/              # Password hashing, encryption
│   │   ├── errors/                  # Custom error classes
│   │   ├── helpers/                 # Utility functions
│   │   ├── logger/                  # Winston logger setup
│   │   ├── middleware/              # Express middleware
│   │   ├── redis/                   # Redis client (optional)
│   │   └── types/                   # TypeScript type definitions
│   │
│   ├── controllers/                  # Request handlers (11 controllers)
│   │   ├── auth.controller.ts       # Authentication endpoints
│   │   ├── bible.controller.ts      # Bible content endpoints
│   │   ├── bibleUser.controller.ts  # User Bible features (bookmarks, etc.)
│   │   ├── chat.controller.ts       # Chat/messaging endpoints
│   │   ├── menteeProfile.controller.ts
│   │   ├── mentorProfile.controller.ts
│   │   ├── mentors.controller.ts    # Browse/search mentors
│   │   ├── session.controller.ts    # Session management
│   │   ├── streak.controller.ts     # Reading streak tracking
│   │   ├── study.controller.ts      # Study paths/sessions
│   │   └── upload.controller.ts     # File uploads
│   │
│   ├── services/                    # Business logic layer (11 services)
│   │   ├── auth.service.ts          # Authentication logic
│   │   ├── bible.service.ts         # Bible API integration
│   │   ├── chat.service.ts          # Chat/messaging logic
│   │   ├── menteeProfile.service.ts
│   │   ├── mentorProfile.service.ts
│   │   ├── session.service.ts       # Session management logic
│   │   ├── sessionReminder.service.ts # Email reminders for sessions
│   │   ├── streak.service.ts        # Streak calculation
│   │   ├── study.service.ts         # Study progress tracking
│   │   ├── user.service.ts          # User management
│   │   └── websocket.service.ts     # Real-time WebSocket handling
│   │
│   ├── routes/                      # Route definitions (10 route files)
│   │   ├── root.route.ts            # Main router, mounts all routes
│   │   ├── auth.routes.ts           # Authentication routes
│   │   ├── bible.routes.ts          # Bible routes
│   │   ├── bibleUser.routes.ts      # User Bible routes
│   │   ├── chat.routes.ts           # Chat routes
│   │   ├── menteeProfile.routes.ts
│   │   ├── mentorProfile.routes.ts
│   │   ├── mentors.routes.ts        # Mentor browsing routes
│   │   ├── session.routes.ts        # Session routes
│   │   ├── streak.routes.ts         # Streak routes
│   │   └── upload.routes.ts         # Upload routes
│   │
│   ├── database/
│   │   ├── entities/                 # TypeORM entities (20+ entities)
│   │   │   ├── user.entity.ts       # User model
│   │   │   ├── menteeProfile.entity.ts
│   │   │   ├── mentorProfile.entity.ts
│   │   │   ├── session.entity.ts    # Mentorship sessions
│   │   │   ├── mentorAvailability.entity.ts
│   │   │   ├── conversation.entity.ts
│   │   │   ├── message.entity.ts
│   │   │   ├── bibleBookmark.entity.ts
│   │   │   ├── bibleHighlight.entity.ts
│   │   │   ├── bibleReflection.entity.ts
│   │   │   ├── bibleProgress.entity.ts
│   │   │   ├── studySession.entity.ts
│   │   │   ├── studyReflection.entity.ts
│   │   │   └── ... (more entities)
│   │   ├── migrations/              # Database migrations (5 migrations)
│   │   └── seeders/                 # Database seeders
│   │       ├── user.seeder.ts
│   │       ├── mentor.seeder.ts
│   │       └── seed-runner.ts
│   │
│   ├── middleware/                  # Express middleware
│   │   ├── auth.middleware.ts       # JWT authentication
│   │   └── upload.middleware.ts     # File upload handling
│   │
│   ├── validation/                  # Zod validation schemas
│   │   ├── auth.validation.ts      # Auth validation
│   │   ├── chat.validation.ts
│   │   ├── mentee.validation.ts
│   │   ├── mentor.validation.ts
│   │   ├── profile.validation.ts
│   │   ├── session.validation.ts
│   │   └── user.schema.ts
│   │
│   ├── repository/                  # Data access layer (optional)
│   │   ├── base.repository.ts
│   │   ├── user.repository.ts
│   │   └── system-config.repository.ts
│   │
│   ├── core/                        # Core services
│   │   ├── cron.service.ts          # Scheduled tasks (session reminders)
│   │   ├── email.service.ts        # Email sending (Nodemailer)
│   │   ├── fileUpload.service.ts    # File upload handling
│   │   ├── queue.service.ts        # Job queue (Bull/BullMQ)
│   │   └── systemConfig.service.ts  # System configuration
│   │
│   ├── queue/                       # Job queue system (optional)
│   │   ├── board.ts                 # Bull Board UI
│   │   ├── manager.ts               # Queue manager
│   │   ├── workers/                 # Queue workers
│   │   │   ├── email.worker.ts
│   │   │   └── notification.worker.ts
│   │   └── types.ts
│   │
│   └── mails/                       # Email templates (Handlebars)
│       ├── partials/                # Email template partials
│       │   ├── baseLayout.hbs
│       │   ├── email-verification.hbs
│       │   ├── password-reset.hbs
│       │   └── ... (more templates)
│       └── assets/                  # Email assets (logos, etc.)
│
├── dist/                            # Compiled JavaScript (generated)
├── package.json                     # Dependencies and scripts
├── tsconfig.json                    # TypeScript configuration
└── README.md                        # Project documentation
```

---

## 🔄 Request Flow

### Typical Request Flow:

```
1. HTTP Request
   ↓
2. Express App (index.ts)
   ↓
3. Root Router (root.route.ts)
   ↓
4. Feature Router (e.g., auth.routes.ts)
   ↓
5. Middleware (auth, validation)
   ↓
6. Controller (e.g., auth.controller.ts)
   ↓
7. Service (e.g., auth.service.ts)
   ↓
8. Repository/Database (TypeORM)
   ↓
9. Response back through layers
```

### Example: User Login Flow

```
POST /api/auth/send-login-otp
  ↓
auth.routes.ts → validate(sendLoginOtpSchema)
  ↓
auth.controller.ts → sendLoginOtp()
  ↓
auth.service.ts → sendLoginOtp()
  ↓
UserRepository → findOne({ email })
  ↓
EmailService → sendEmailVerificationEmail()
  ↓
Response: { success: true, message: "..." }
```

---

## 🔑 Key Components

### 1. **Entry Point** (`src/index.ts`)

Initializes:
- Express app with CORS, JSON parsing
- Database connection (TypeORM)
- Cron jobs (session reminders)
- WebSocket service (Socket.io)
- Routes
- Error handler
- HTTP server

### 2. **Database Layer** (`src/database/`)

**TypeORM Configuration**:
- MySQL database
- 20+ entities
- 5 migrations
- Seeders for initial data

**Key Entities**:
- `User` - Core user model
- `MenteeProfile` - Mentee-specific data
- `MentorProfile` - Mentor-specific data
- `Session` - Mentorship sessions
- `MentorAvailability` - Mentor availability slots
- `Conversation` / `Message` - Chat system
- `BibleBookmark` / `BibleHighlight` / `BibleReflection` - Bible features
- `StudySession` / `StudyReflection` - Study tracking

### 3. **Authentication System**

**JWT-based authentication**:
- Access tokens (short-lived)
- Refresh tokens (long-lived)
- Token stored in `RefreshToken` entity

**Endpoints**:
- `POST /api/auth/send-login-otp` - Send OTP for login
- `POST /api/auth/verify-login-otp` - Verify OTP and get tokens
- `POST /api/auth/forgot-password` - Send password reset OTP
- `POST /api/auth/reset-password` - Reset password
- `GET /api/auth/me` - Get current user
- `POST /api/auth/refresh` - Refresh access token

**Middleware**:
- `authenticateToken` - Validates JWT token
- `requireRole` - Checks user role (mentor/mentee)

### 4. **API Routes Structure**

All routes are prefixed with `/api`:

```
/api/auth/*              - Authentication
/api/mentee-profiles/*   - Mentee profile management
/api/mentor-profiles/*   - Mentor profile management
/api/mentors/*          - Browse/search mentors
/api/sessions/*         - Session management
/api/bible/*            - Bible content
/api/bible/user/*       - User Bible features
/api/study/*            - Study paths
/api/chat/*             - Chat/messaging
/api/upload/*           - File uploads
/api/auth/streak/*      - Reading streak
/health                 - Health check
```

### 5. **Services Layer**

Each service handles business logic for a domain:

- **AuthService**: Registration, login, OTP, password reset
- **SessionService**: Create sessions, check availability, get slots
- **ChatService**: Conversations, messages, real-time chat
- **BibleService**: Bible API integration (bible-api.com + Bible Brain)
- **MentorProfileService**: Mentor onboarding, profile management
- **MenteeProfileService**: Mentee onboarding, profile management
- **SessionReminderService**: Email reminders (15 min before sessions)
- **StreakService**: Calculate reading streaks
- **WebSocketService**: Real-time communication

### 6. **Validation Layer**

**Zod schemas** for request validation:
- Input validation before reaching controllers
- Type-safe validation
- Automatic error responses

Example:
```typescript
// validation/auth.validation.ts
export const sendLoginOtpSchema = z.object({
  email: z.string().email('Invalid email address'),
});
```

### 7. **Email System**

**EmailService** (`src/core/email.service.ts`):
- Uses Nodemailer
- Handlebars templates
- Templates in `src/mails/partials/`
- Currently sends directly (no queue)

**Email Types**:
- Email verification (OTP)
- Password reset (OTP)
- Session reminders
- General notifications

### 8. **Cron Jobs**

**CronService** (`src/core/cron.service.ts`):
- Session reminders (15 minutes before)
- Runs every minute
- Checks for upcoming sessions
- Sends email reminders

### 9. **WebSocket**

**WebSocketService** (`src/services/websocket.service.ts`):
- Socket.io for real-time communication
- Chat messages
- Session updates
- Notifications

### 10. **File Uploads**

**UploadService** (`src/core/fileUpload.service.ts`):
- Profile images
- Video introductions
- Uses Multer
- Stores in `uploads/` directory

---

## 🔐 Security Features

1. **JWT Authentication**: Secure token-based auth
2. **Password Hashing**: bcryptjs for password storage
3. **OTP System**: 6-digit codes, 10-15 min expiry
4. **Input Validation**: Zod schemas prevent invalid data
5. **CORS**: Configured for frontend access
6. **Error Handling**: Centralized error handler
7. **Role-Based Access**: Middleware for role checking

---

## 📊 Database Schema

### Core Tables:
- `users` - User accounts
- `mentee_profiles` - Mentee data
- `mentor_profiles` - Mentor data
- `sessions` - Mentorship sessions
- `mentor_availabilities` - Mentor time slots
- `conversations` - Chat conversations
- `messages` - Chat messages
- `bible_bookmarks` - User bookmarks
- `bible_highlights` - User highlights
- `bible_reflections` - User reflections
- `study_sessions` - Study tracking
- `password_resets` - Password reset tokens
- `refresh_tokens` - JWT refresh tokens

---

## 🚀 Deployment

**Production URL**: https://api.paxify.org/

**Environment Variables** (`.env`):
- Database connection (MySQL)
- JWT secrets
- Email SMTP settings
- Redis (optional)
- API keys (Bible Brain, etc.)

**Build Process**:
```bash
npm run build:main      # Build for production
npm run db-seed:prod    # Seed production database
npm start               # Start server
```

---

## 📝 API Response Format

**Success Response**:
```json
{
  "success": true,
  "response": {
    // Data here
  },
  "message": "Success message"
}
```

**Error Response**:
```json
{
  "success": false,
  "error": {
    "message": "Error message",
    "code": "ERROR_CODE"
  }
}
```

---

## 🔄 Current Status

### ✅ Implemented:
- Authentication (OTP-based login, registration)
- User profiles (mentee/mentor)
- Session management
- Mentor availability
- Bible integration (multi-language)
- Chat system
- Study tracking
- Streak tracking
- Email notifications
- Session reminders (cron)
- File uploads
- WebSocket support

### 🚧 Optional/Disabled:
- Job queue system (Bull/BullMQ) - Currently disabled
- Redis caching - Optional

---

## 🧪 Testing Strategy

### Manual Testing Checklist:

1. **Authentication**:
   - [ ] Email registration
   - [ ] OTP verification
   - [ ] Login with OTP
   - [ ] Password reset flow
   - [ ] Token refresh

2. **Profiles**:
   - [ ] Mentee onboarding completion
   - [ ] Mentor onboarding completion
   - [ ] Profile updates

3. **Sessions**:
   - [ ] Create session request
   - [ ] Accept/decline session
   - [ ] Get available slots
   - [ ] Session reminders (cron)

4. **Bible**:
   - [ ] Get Bible chapters
   - [ ] Bookmarks, highlights, reflections
   - [ ] Multi-language support

5. **Chat**:
   - [ ] Create conversation
   - [ ] Send messages
   - [ ] WebSocket real-time updates

6. **Other**:
   - [ ] File uploads
   - [ ] Streak tracking
   - [ ] Study progress

---

## 📚 Next Steps for Staging

To set up staging environment:

1. **Create staging branch**
2. **Environment variables**:
   - Separate database for staging
   - Staging SMTP settings
   - Staging API keys
3. **CI/CD**:
   - Staging deployment on merge to `staging` branch
   - Production deployment on merge to `main` branch
4. **Database**:
   - Separate staging database
   - Staging seeders if needed

---

## 🔗 API Base URL

**Production**: https://api.paxify.org/api

**Example Endpoints**:
- `POST https://api.paxify.org/api/auth/send-login-otp`
- `GET https://api.paxify.org/api/auth/me`
- `GET https://api.paxify.org/api/mentors/recommended`
- `POST https://api.paxify.org/api/sessions`

---

## 📖 Key Files to Understand

1. **`src/index.ts`** - Application startup
2. **`src/routes/root.route.ts`** - Route mounting
3. **`src/controllers/auth.controller.ts`** - Auth endpoints
4. **`src/services/auth.service.ts`** - Auth business logic
5. **`src/config/data-source.ts`** - Database config
6. **`src/core/cron.service.ts`** - Scheduled tasks
7. **`src/core/email.service.ts`** - Email sending

---

This architecture provides a solid foundation for the Mentor App backend with clear separation of concerns, type safety, and scalability.

