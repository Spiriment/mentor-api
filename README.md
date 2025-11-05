# Mentor App Backend API

A comprehensive Node.js backend for a spiritual mentorship platform connecting mentees with mentors for Bible study and spiritual growth.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- MySQL 8.0+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database and email settings

# Start development server
npm run start:dev
```

The server will start on `http://localhost:6802`

## 📋 Available Scripts

- `npm run start:dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run db-seed` - Seed database (development)
- `npm run db-seed:prod` - Seed database (production)
- `npm run migration:run` - Run database migrations

## 🔗 API Endpoints

Base URL: `http://localhost:6802/api`

### Authentication
- `POST /auth/login` - Login with email/password
- `POST /auth/send-login-otp` - Send OTP for login
- `POST /auth/verify-login-otp` - Verify OTP and login
- `POST /auth/email-registration` - Start email registration (send OTP)
- `POST /auth/verify-otp` - Verify OTP code
- `POST /auth/select-role` - Select user role (mentee/mentor)
- `GET /auth/me` - Get current user profile

### Mentors & Discovery
- `GET /mentors` - Get all approved mentors
- `GET /mentors/recommended` - Get recommended mentors
- `GET /mentors/{mentorId}` - Get specific mentor profile

### Sessions
- `GET /sessions` - Get user sessions
- `POST /sessions` - Create new session
- `GET /sessions/{sessionId}` - Get session details
- `PUT /sessions/{sessionId}` - Update session
- `DELETE /sessions/{sessionId}` - Cancel session

### Bible & Study
- `GET /bible/books` - Get Bible books
- `GET /bible/books/{book}/chapters/{chapter}` - Get chapter verses
- `GET /bible/user/progress` - Get user reading progress
- `GET /study/progress` - Get study progress

### Chat & Messaging
- `GET /chat/conversations` - Get user conversations
- `POST /chat/conversations` - Create conversation
- `GET /chat/conversations/{id}/messages` - Get messages

For complete API documentation, see [docs/POSTMAN_URLS.md](docs/POSTMAN_URLS.md)

## ⚙️ Configuration

### Environment Variables

Create a `.env` file with:

```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=your_password
DB_NAME=mentor_app

# Server
PORT=6802
NODE_ENV=development

# JWT
JWT_PRIVATE_KEY=your_private_key
JWT_PUBLIC_KEY=your_public_key

# Email (SMTP)
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=587
SMTP_USER=noreply@yourdomain.com
SMTP_PASSWORD=your_password
SMTP_FROM=noreply@yourdomain.com
```

See [docs/EMAIL_CONFIGURATION.md](docs/EMAIL_CONFIGURATION.md) for email setup.

## 🗄️ Database

### Setup

```bash
# Create database
mysql -u root -p
CREATE DATABASE mentor_app;

# Run migrations
npm run migration:run

# Seed database (development)
npm run db-seed
```

## 🚀 Deployment

### Production Build

```bash
npm run build:main
npm start
```

### Database Seeding (Production)

```bash
npm run build:main
npm run db-seed:prod
```

See [docs/CPANEL_SEEDING_GUIDE.md](docs/CPANEL_SEEDING_GUIDE.md) for cPanel deployment.

## 📚 Documentation

All detailed documentation is available in the `docs/` folder:

- [API Documentation](docs/POSTMAN_URLS.md) - Complete API endpoints
- [Email Configuration](docs/EMAIL_CONFIGURATION.md) - SMTP setup guide
- [Login OTP Flow](docs/LOGIN_OTP_FLOW.md) - OTP-based authentication
- [Session Scheduling](docs/SESSION_SCHEDULING_FLOW.md) - Session management
- [Bible Integration](docs/BIBLE_INTEGRATION.md) - Bible API integration
- [Seeder Migration](docs/SEEDER_MIGRATION.md) - Database seeding guide

## 🛠️ Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: MySQL with TypeORM
- **Authentication**: JWT tokens
- **Validation**: Zod
- **Email**: Nodemailer
- **File Upload**: Multer

## 📁 Project Structure

```
src/
├── config/          # Configuration files
├── controllers/     # Request handlers
├── services/        # Business logic
├── routes/          # API routes
├── database/        # Entities, migrations, seeders
├── middleware/      # Custom middleware
├── validation/      # Request validation schemas
└── common/          # Shared utilities
```

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## 📄 License

MIT License
