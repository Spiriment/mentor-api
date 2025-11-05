# Login OTP Flow - Implementation Guide

## Overview
The login flow has been updated to use OTP (One-Time Password) instead of password. Users enter their email, receive an OTP, and verify it to log in.

## New Endpoints

### 1. Send Login OTP
**POST** `/api/auth/send-login-otp`

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "response": {
    "success": true,
    "message": "Verification code sent to your email. Please check your inbox."
  }
}
```

**Behavior:**
- Checks if user exists with the email
- Validates user is active and email is verified
- Generates 6-digit OTP
- Saves OTP to database (expires in 10 minutes)
- Sends OTP email with "Login Verification" template

**Errors:**
- `404`: No account found with this email
- `403`: Account is inactive
- `400`: Email not verified

### 2. Verify Login OTP
**POST** `/api/auth/verify-login-otp`

**Request Body:**
```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "response": {
    "accessToken": "jwt_token_here",
    "refreshToken": "refresh_token_here",
    "token": "jwt_token_here",
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "mentee",
      "isVerified": true,
      "isOnboardingComplete": true
    }
  }
}
```

**Behavior:**
- Verifies OTP matches and hasn't expired
- Clears OTP from database after successful verification
- Returns JWT tokens and user data

**Errors:**
- `400`: No verification code found or expired
- `401`: Invalid verification code
- `404`: User not found
- `403`: Account inactive or email not verified

## Email Template

The email template (`email-verification.hbs`) has been updated to:
- Show "Login Verification" vs "Email Verification" based on context
- Display Mentor App branding (instead of AptFuel)
- Include security tips and expiration notice

The template automatically detects if it's for login or registration using the `isLogin` flag.

## Flow Comparison

### Old Flow (Password-based):
1. User enters email + password
2. Backend validates credentials
3. Returns tokens

### New Flow (OTP-based):
1. User enters email → `POST /api/auth/send-login-otp`
2. Backend checks if user exists
3. Backend sends OTP email
4. User enters OTP → `POST /api/auth/verify-login-otp`
5. Backend verifies OTP
6. Returns tokens

## Security Features

1. **OTP Expiration**: 10 minutes
2. **OTP Validation**: Must match exactly
3. **One-time Use**: OTP is cleared after successful verification
4. **User Validation**: Checks if user exists, is active, and email is verified
5. **Email Verification Required**: Users must verify email before login

## Integration Notes

- The old password-based login endpoint (`POST /api/auth/login`) still exists for backward compatibility
- New OTP endpoints are available for the mobile app
- Email templates are automatically selected based on context (login vs registration)

## Testing

1. Send OTP:
   ```bash
   curl -X POST http://localhost:3000/api/auth/send-login-otp \
     -H "Content-Type: application/json" \
     -d '{"email": "test@example.com"}'
   ```

2. Verify OTP:
   ```bash
   curl -X POST http://localhost:3000/api/auth/verify-login-otp \
     -H "Content-Type: application/json" \
     -d '{"email": "test@example.com", "otp": "123456"}'
   ```

## Next Steps

1. Update frontend to use new OTP login flow
2. Configure SMTP settings in `.env`
3. Test email delivery
4. Update UI to match new flow

