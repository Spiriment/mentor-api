# 🚀 Postman API URLs Collection

## 📋 Base Configuration

```
Base URL: http://localhost:6802/api
Content-Type: application/json
```

---

## 🔐 Authentication Endpoints

### 1. Login (Existing Users)

```
POST http://localhost:6802/api/auth/login
```

**Body:**

```json
{
  "email": "sarah.johnson@example.com",
  "password": "password123"
}
```

### 2. Email Registration (New Users)

```
POST http://localhost:6802/api/auth/email-registration
```

**Body:**

```json
{
  "email": "newuser@example.com"
}
```

### 3. Verify OTP

```
POST http://localhost:6802/api/auth/verify-otp
```

**Body:**

```json
{
  "email": "newuser@example.com",
  "otp": "123456"
}
```

### 4. Update Profile

```
POST http://localhost:6802/api/auth/update-profile
```

**Body:**

```json
{
  "email": "newuser@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "gender": "male",
  "country": "United States",
  "countryCode": "US",
  "birthday": "1990-01-15"
}
```

### 5. Select Role

```
POST http://localhost:6802/api/auth/select-role
```

**Body:**

```json
{
  "email": "newuser@example.com",
  "role": "mentee"
}
```

### 6. Get Current User Profile

```
GET http://localhost:6802/api/auth/me
```

**Headers:**

```
Authorization: Bearer YOUR_TOKEN_HERE
```

### 7. Logout

```
POST http://localhost:6802/api/auth/logout
```

**Headers:**

```
Authorization: Bearer YOUR_TOKEN_HERE
```

---

## 👥 User Profiles

### Mentee Profiles

#### Get Mentee Profile

```
GET http://localhost:6802/api/mentee-profiles/{userId}
```

**Headers:**

```
Authorization: Bearer YOUR_TOKEN_HERE
```

#### Get Onboarding Progress

```
GET http://localhost:6802/api/mentee-profiles/{userId}/onboarding-progress
```

**Headers:**

```
Authorization: Bearer YOUR_TOKEN_HERE
```

#### Update Bible Reading Frequency

```
PUT http://localhost:6802/api/mentee-profiles/{userId}/bible-reading-frequency
```

**Headers:**

```
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json
```

**Body:**

```json
{
  "bibleReadingFrequency": "daily"
}
```

#### Update Spiritual Growth Areas

```
PUT http://localhost:6802/api/mentee-profiles/{userId}/spiritual-growth-areas
```

**Headers:**

```
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json
```

**Body:**

```json
{
  "spiritualGrowthAreas": ["prayer", "bible_study", "worship"]
}
```

### Mentor Profiles

#### Get Mentor Profile

```
GET http://localhost:6802/api/mentor-profiles/{userId}
```

**Headers:**

```
Authorization: Bearer YOUR_TOKEN_HERE
```

#### Approve Mentor (Admin)

```
POST http://localhost:6802/api/mentor-profiles/{userId}/approve
```

**Headers:**

```
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json
```

**Body:**

```json
{
  "approvalNotes": "Approved after review"
}
```

---

## 🎓 Mentors & Discovery

### Get All Approved Mentors

```
GET http://localhost:6802/api/mentors
```

**Query Parameters:**

```
?page=1&limit=10&search=john
```

### Get Recommended Mentors (HomeScreen)

```
GET http://localhost:6802/api/mentors/recommended?limit=3
```

### Search Mentors

```
GET http://localhost:6802/api/mentors/search
```

**Query Parameters:**

```
?experience=5+&format=video_calls&location=US
```

### Get Specific Mentor Profile

```
GET http://localhost:6802/api/mentors/{mentorId}
```

---

## 📅 Sessions

### Get User Sessions

```
GET http://localhost:6802/api/sessions
```

**Headers:**

```
Authorization: Bearer YOUR_TOKEN_HERE
```

**Query Parameters:**

```
?upcoming=true&limit=5&status=scheduled
```

### Create New Session

```
POST http://localhost:6802/api/sessions
```

**Headers:**

```
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json
```

**Body:**

```json
{
  "mentorId": "mentor-uuid-here",
  "scheduledAt": "2024-02-15T10:00:00Z",
  "type": "one_on_one",
  "duration": 60,
  "title": "Bible Study Session",
  "description": "Studying Romans chapter 1"
}
```

### Get Session Details

```
GET http://localhost:6802/api/sessions/{sessionId}
```

**Headers:**

```
Authorization: Bearer YOUR_TOKEN_HERE
```

### Update Session

```
PUT http://localhost:6802/api/sessions/{sessionId}
```

**Headers:**

```
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json
```

**Body:**

```json
{
  "title": "Updated Session Title",
  "description": "Updated description"
}
```

### Cancel Session

```
DELETE http://localhost:6802/api/sessions/{sessionId}
```

**Headers:**

```
Authorization: Bearer YOUR_TOKEN_HERE
```

---

## 💬 Chat & Messaging

### Get User Conversations

```
GET http://localhost:6802/api/chat/conversations
```

**Headers:**

```
Authorization: Bearer YOUR_TOKEN_HERE
```

**Query Parameters:**

```
?limit=20&offset=0
```

### Create Conversation

```
POST http://localhost:6802/api/chat/conversations
```

**Headers:**

```
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json
```

**Body:**

```json
{
  "participantIds": ["mentor-uuid-here"],
  "type": "direct_message"
}
```

### Get Conversation Details

```
GET http://localhost:6802/api/chat/conversations/{conversationId}
```

**Headers:**

```
Authorization: Bearer YOUR_TOKEN_HERE
```

### Get Messages

```
GET http://localhost:6802/api/chat/conversations/{conversationId}/messages
```

**Headers:**

```
Authorization: Bearer YOUR_TOKEN_HERE
```

**Query Parameters:**

```
?limit=50&offset=0&beforeMessageId=message-uuid
```

### Send Message

```
POST http://localhost:6802/api/chat/conversations/{conversationId}/messages
```

**Headers:**

```
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json
```

**Body:**

```json
{
  "content": "Hello! I'd like to schedule a session.",
  "type": "text"
}
```

---

## 📖 Bible & Study

### Get Bible Books

```
GET http://localhost:6802/api/bible/books
```

### Get Book Chapters

```
GET http://localhost:6802/api/bible/books/Romans/chapters
```

### Get Chapter Verses

```
GET http://localhost:6802/api/bible/books/Romans/chapters/1
```

### Get User Reading Progress

```
GET http://localhost:6802/api/bible/user/progress
```

**Headers:**

```
Authorization: Bearer YOUR_TOKEN_HERE
```

### Get User Bookmarks

```
GET http://localhost:6802/api/bible/user/bookmarks
```

**Headers:**

```
Authorization: Bearer YOUR_TOKEN_HERE
```

### Get User Highlights

```
GET http://localhost:6802/api/bible/user/highlights
```

**Headers:**

```
Authorization: Bearer YOUR_TOKEN_HERE
```

---

## 📊 Study Progress

### Get Study Progress

```
GET http://localhost:6802/api/study/progress
```

**Headers:**

```
Authorization: Bearer YOUR_TOKEN_HERE
```

### Get Study Sessions

```
GET http://localhost:6802/api/study/sessions
```

**Headers:**

```
Authorization: Bearer YOUR_TOKEN_HERE
```

### Get User Reflections

```
GET http://localhost:6802/api/study/reflections
```

**Headers:**

```
Authorization: Bearer YOUR_TOKEN_HERE
```

### Add Reflection

```
POST http://localhost:6802/api/study/reflections
```

**Headers:**

```
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json
```

**Body:**

```json
{
  "pathId": "accountability-path",
  "book": "Romans",
  "chapter": 1,
  "verse": 16,
  "content": "This verse really speaks to me about sharing the gospel."
}
```

---

## 📁 File Uploads

### Upload Profile Image

```
POST http://localhost:6802/api/upload/profile-image
```

**Headers:**

```
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: multipart/form-data
```

**Body (Form Data):**

```
image: [SELECT FILE]
```

### Upload Video Introduction

```
POST http://localhost:6802/api/upload/video-introduction
```

**Headers:**

```
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: multipart/form-data
```

**Body (Form Data):**

```
video: [SELECT FILE]
```

---

## 🔥 Streak System

### Get User Streak

```
GET http://localhost:6802/api/auth/streak
```

**Headers:**

```
Authorization: Bearer YOUR_TOKEN_HERE
```

### Increment Streak

```
POST http://localhost:6802/api/auth/streak/increment
```

**Headers:**

```
Authorization: Bearer YOUR_TOKEN_HERE
```

---

## 🧪 Test Accounts (Pre-seeded)

### Mentee Accounts

```
Email: sarah.johnson@example.com
Password: password123

Email: michael.chen@example.com
Password: password123

Email: emily.rodriguez@example.com
Password: password123

Email: david.kim@example.com
Password: password123

Email: jessica.thompson@example.com
Password: password123
```

### Health Check

```
GET http://localhost:6802/health
```

---

## 📝 Postman Setup Tips

1. **Create Environment Variables:**

   - `base_url`: `http://localhost:6802/api`
   - `token`: `{{your_jwt_token}}`

2. **Use Variables in URLs:**

   - `{{base_url}}/auth/login`
   - `{{base_url}}/mentors/recommended`

3. **Set Collection Headers:**

   - `Content-Type`: `application/json`
   - `Authorization`: `Bearer {{token}}`

4. **Test Flow:**
   1. Login with test account
   2. Copy token from response
   3. Set token in environment
   4. Test protected endpoints

---

**🚀 Ready for Postman testing!**
