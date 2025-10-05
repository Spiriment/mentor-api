# 🚀 Mentor App Backend

A comprehensive Node.js backend for a spiritual mentorship platform connecting mentees with mentors for Bible study and spiritual growth.

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [API Endpoints](#api-endpoints)
3. [Authentication Flow](#authentication-flow)
4. [Features](#features)
5. [Database Schema](#database-schema)
6. [Testing](#testing)
7. [Configuration](#configuration)
8. [Deployment](#deployment)

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- MySQL 8.0+
- npm or yarn

### Installation

```bash
# Clone and install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database and email settings

# Start MySQL database
# Create database: mentor_app

# Run the server
npm run start:dev
```

The server will start on `http://localhost:6802`

### Health Check

```bash
curl http://localhost:6802/health
```

## 🔗 API Endpoints

### Base URL

```
http://localhost:6802/api
```

### 🔐 Authentication

| Endpoint                   | Method | Description                         |
| -------------------------- | ------ | ----------------------------------- |
| `/auth/login`              | POST   | Login with email/password           |
| `/auth/register`           | POST   | Register new user                   |
| `/auth/email-registration` | POST   | Start email registration (send OTP) |
| `/auth/verify-otp`         | POST   | Verify OTP code                     |
| `/auth/update-profile`     | PUT    | Update user profile                 |
| `/auth/select-role`        | POST   | Select user role (mentee/mentor)    |
| `/auth/me`                 | GET    | Get current user profile            |
| `/auth/logout`             | POST   | Logout user                         |

### 👥 User Profiles

| Endpoint                                        | Method | Description             |
| ----------------------------------------------- | ------ | ----------------------- |
| `/mentee-profiles/{userId}`                     | GET    | Get mentee profile      |
| `/mentee-profiles/{userId}/onboarding-progress` | GET    | Get onboarding progress |
| `/mentor-profiles/{userId}`                     | GET    | Get mentor profile      |
| `/mentor-profiles/{userId}/approve`             | POST   | Approve mentor (admin)  |

### 🎓 Mentors & Discovery

| Endpoint               | Method | Description                 |
| ---------------------- | ------ | --------------------------- |
| `/mentors`             | GET    | Get all approved mentors    |
| `/mentors/recommended` | GET    | Get recommended mentors     |
| `/mentors/search`      | GET    | Search mentors              |
| `/mentors/{mentorId}`  | GET    | Get specific mentor profile |

### 📅 Sessions

| Endpoint                | Method | Description         |
| ----------------------- | ------ | ------------------- |
| `/sessions`             | GET    | Get user sessions   |
| `/sessions`             | POST   | Create new session  |
| `/sessions/{sessionId}` | GET    | Get session details |
| `/sessions/{sessionId}` | PUT    | Update session      |
| `/sessions/{sessionId}` | DELETE | Cancel session      |

### 💬 Chat & Messaging

| Endpoint                                        | Method | Description            |
| ----------------------------------------------- | ------ | ---------------------- |
| `/chat/conversations`                           | GET    | Get user conversations |
| `/chat/conversations`                           | POST   | Create conversation    |
| `/chat/conversations/{conversationId}`          | GET    | Get conversation       |
| `/chat/conversations/{conversationId}/messages` | GET    | Get messages           |
| `/chat/conversations/{conversationId}/messages` | POST   | Send message           |

### 📖 Bible & Study

| Endpoint                                 | Method | Description               |
| ---------------------------------------- | ------ | ------------------------- |
| `/bible/books`                           | GET    | Get Bible books           |
| `/bible/books/{book}/chapters`           | GET    | Get book chapters         |
| `/bible/books/{book}/chapters/{chapter}` | GET    | Get chapter verses        |
| `/bible/user/progress`                   | GET    | Get user reading progress |
| `/bible/user/bookmarks`                  | GET    | Get user bookmarks        |
| `/bible/user/highlights`                 | GET    | Get user highlights       |

### 📊 Study Progress

| Endpoint             | Method | Description          |
| -------------------- | ------ | -------------------- |
| `/study/progress`    | GET    | Get study progress   |
| `/study/sessions`    | GET    | Get study sessions   |
| `/study/reflections` | GET    | Get user reflections |
| `/study/reflections` | POST   | Add reflection       |

### 📁 File Uploads

| Endpoint                     | Method | Description               |
| ---------------------------- | ------ | ------------------------- |
| `/upload/profile-image`      | POST   | Upload profile image      |
| `/upload/video-introduction` | POST   | Upload video introduction |

## 🔐 Authentication Flow

### 1. Email Registration (New Users)

```bash
# Step 1: Start registration
curl -X POST http://localhost:6802/api/auth/email-registration \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'

# Step 2: Verify OTP (check server console for code)
curl -X POST http://localhost:6802/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "otp": "123456"}'

# Step 3: Update profile
curl -X PUT http://localhost:6802/api/auth/update-profile \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "gender": "male",
    "country": "United States",
    "birthday": "1990-01-15"
  }'

# Step 4: Select role
curl -X POST http://localhost:6802/api/auth/select-role \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "role": "mentee"}'
```

### 2. Direct Login (Existing Users)

```bash
curl -X POST http://localhost:6802/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123"}'
```

### 3. Get Current User

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:6802/api/auth/me
```

## ✨ Features

### 🎯 Core Features

- **Dual Authentication**: Email/OTP registration + Email/Password login
- **Role-Based System**: Separate mentee and mentor experiences
- **Real-time Chat**: WebSocket-based messaging system
- **Session Management**: Schedule and manage mentorship sessions
- **Bible Integration**: Complete Bible API with reading progress
- **Study Tracking**: Progress tracking, bookmarks, highlights, reflections
- **File Uploads**: Profile images and video introductions
- **Streak System**: Bible reading streak tracking

### 🔧 Technical Features

- **TypeScript**: Full type safety
- **TypeORM**: Database ORM with migrations
- **JWT Authentication**: Secure token-based auth
- **Zod Validation**: Request/response validation
- **WebSocket Support**: Real-time communication
- **File Upload**: Multer with local storage
- **Email Service**: OTP verification (console logging for dev)
- **Error Handling**: Comprehensive error management
- **Logging**: Structured logging system

## 🗄️ Database Schema

### Core Tables

- `users` - User accounts and basic info
- `mentee_profiles` - Mentee-specific profile data
- `mentor_profiles` - Mentor-specific profile data
- `sessions` - Mentorship sessions
- `conversations` - Chat conversations
- `messages` - Chat messages
- `study_progress` - Bible reading progress
- `study_sessions` - Study session records
- `study_reflections` - User reflections

### Key Relationships

- Users → Mentee/Mentor Profiles (1:1)
- Users → Sessions (1:many)
- Users → Conversations (many:many)
- Users → Study Progress (1:many)

## 🧪 Testing

### Test Accounts (Pre-seeded)

**Mentees:**

- `sarah.johnson@example.com` / `password123`
- `michael.chen@example.com` / `password123`
- `emily.rodriguez@example.com` / `password123`
- `david.kim@example.com` / `password123`
- `jessica.thompson@example.com` / `password123`

**Mentors:** (5 seeded mentors available)

### Quick Tests

```bash
# Test login
curl -X POST http://localhost:6802/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "sarah.johnson@example.com", "password": "password123"}'

# Test mentors
curl http://localhost:6802/api/mentors/recommended

# Test sessions (requires auth token)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:6802/api/sessions?upcoming=true
```

## ⚙️ Configuration

### Environment Variables

```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=your_password
DB_DATABASE=mentor_app

# Server
PORT=6802
NODE_ENV=development

# JWT
JWT_PRIVATE_KEY=your_private_key
JWT_PUBLIC_KEY=your_public_key
JWT_EXPIRES_IN=7d

# Email (Development)
EMAIL_FROM=noreply@mentorapp.com
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# File Upload
UPLOAD_MAX_SIZE=52428800
UPLOAD_PATH=./uploads
```

### Database Setup

```sql
-- Create database
CREATE DATABASE mentor_app;

-- Tables are created automatically via TypeORM
-- Or run migrations if needed
```

## 🚀 Deployment

### Development

```bash
npm run start:dev
```

### Production

```bash
npm run build
npm run start:prod
```

### Docker (Optional)

```bash
docker-compose up -d
```

## 📱 Frontend Integration

### API Base URL

```javascript
const API_BASE_URL = 'http://localhost:6802/api';
```

### Authentication Headers

```javascript
headers: {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
}
```

### WebSocket Connection

```javascript
const socket = io('http://localhost:6802', {
  auth: { token: userToken },
});
```

## 🔍 Troubleshooting

### Common Issues

1. **Database Connection Failed**

   - Check MySQL is running
   - Verify credentials in `.env`
   - Ensure database `mentor_app` exists

2. **Routes Not Found (404)**

   - Ensure server is running on port 6802
   - Check route registration in `root.route.ts`

3. **Authentication Issues**

   - Verify JWT keys in `.env`
   - Check token format in Authorization header

4. **File Upload Issues**
   - Ensure `uploads/` directory exists
   - Check file size limits

### Logs

- Server logs: `server.log`
- Error logs: `logs/` directory
- Console output during development

## 📚 API Documentation

For detailed API documentation with request/response examples, see the individual route files in `src/routes/` and `src/controllers/`.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

---

**🚀 Ready for frontend integration!**

The backend provides a complete, production-ready API for the mentor app with all necessary endpoints for authentication, user management, chat, sessions, and Bible study features.
