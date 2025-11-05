# Email Configuration Guide

## SMTP Settings in cPanel

### Where to Find SMTP Settings:

1. **Log into cPanel**
2. Navigate to **Email** section
3. Click on **Email Accounts**
4. Find your email account (e.g., `noreply@yourdomain.com`) or create one
5. Click **More** → **Configure Email Client**
6. You'll see your SMTP settings:
   - **Outgoing Server**: Usually `mail.yourdomain.com` or `smtp.yourdomain.com`
   - **Port**: Usually `587` (TLS) or `465` (SSL)
   - **Username**: Your full email address
   - **Password**: Your email account password

### Alternative Method:
- Go to **Email** → **Email Routing** in cPanel
- Check the mail server configuration
- Contact your hosting provider if you can't find the settings

## Environment Variables

Add these to your `.env` file:

```env
# SMTP Configuration
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=587
SMTP_USER=noreply@yourdomain.com
SMTP_PASSWORD=your_email_password
SMTP_FROM=noreply@yourdomain.com
```

### Common Ports:
- **587**: TLS (Recommended, most common)
- **465**: SSL
- **25**: Usually blocked by hosting providers

## Testing Email Configuration

After configuring, test by:
1. Starting your backend server
2. Attempting to register a new user
3. Checking if the OTP email arrives

## Troubleshooting

### Email Not Sending?
1. Check if port 587 is blocked (try 465 with SSL)
2. Verify username is the full email address
3. Check if SMTP authentication is enabled
4. Verify password is correct
5. Check spam/junk folder

### Authentication Failed?
- Ensure you're using the full email address as username
- Verify password is correct
- Check if 2-factor authentication is enabled (may need app password)

### Connection Timeout?
- Verify SMTP server hostname is correct
- Check if your hosting provider allows SMTP connections
- Try different ports (587, 465, 25)

## Next Steps

1. Get SMTP credentials from cPanel
2. Add them to `.env` file
3. Test email sending
4. Update email templates as needed

