# SMTP Configuration Guide for cPanel

## Where to Find SMTP Settings in cPanel

### Method 1: Email Accounts (Recommended)
1. Log into **cPanel**
2. Navigate to **Email** section
3. Click on **Email Accounts**
4. Find your email account (or create one if needed)
5. Click **More** → **Configure Email Client**
6. You'll see:
   - **Incoming Server**: `mail.yourdomain.com` (IMAP/POP3)
   - **Outgoing Server**: `mail.yourdomain.com` (SMTP)
   - **Port**: Usually `587` (TLS) or `465` (SSL)
   - **Username**: Full email address (e.g., `noreply@yourdomain.com`)
   - **Password**: Your email account password

### Method 2: Email Routing
1. In cPanel, go to **Email** → **Email Routing**
2. Check your routing configuration
3. Note the mail server hostname

### Method 3: Contact Your Hosting Provider
If you can't find SMTP settings, contact your hosting provider and ask for:
- SMTP Server/Host
- SMTP Port (usually 587 for TLS or 465 for SSL)
- SMTP Username (usually your full email address)
- SMTP Password
- Authentication method (usually "Normal Password" or "Plain")

## Common cPanel SMTP Settings

### Standard Settings (Most Common)
```
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=587
SMTP_SECURE=false (TLS)
SMTP_USER=noreply@yourdomain.com
SMTP_PASSWORD=your_email_password
SMTP_FROM=noreply@yourdomain.com
```

### Alternative Settings (SSL)
```
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=465
SMTP_SECURE=true (SSL)
SMTP_USER=noreply@yourdomain.com
SMTP_PASSWORD=your_email_password
SMTP_FROM=noreply@yourdomain.com
```

## Testing Your SMTP Settings

After configuring, you can test by:
1. Running the backend server
2. Attempting to register a new user
3. Checking if the OTP email arrives

## Troubleshooting

### Common Issues:
1. **Port 587 blocked**: Some hosting providers block port 587. Try port 465 with SSL.
2. **Authentication failed**: Ensure you're using the full email address as username
3. **Connection timeout**: Check if your hosting provider allows SMTP connections
4. **SPF/DKIM**: Some providers require these DNS records for email delivery

## Next Steps

Once you have your SMTP credentials:
1. Add them to your `.env` file
2. Test the email sending functionality
3. Check spam folder if emails don't arrive

