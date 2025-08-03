# Alternative Email Service Providers (Not Gmail)

## 1. **SendGrid (Recommended - Free Tier)**

**Pros**: 100 emails/day free, excellent deliverability, easy setup

```bash
# SendGrid Configuration
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
FROM_EMAIL=sifosman@gmail.com
FROM_NAME=HDS Group
```

**Setup Steps**:
1. Go to https://sendgrid.com
2. Sign up for free account
3. Go to Settings → API Keys → Create API Key
4. Use the API key as SMTP_PASS
5. Use "apikey" as SMTP_USER

## 2. **Mailgun (Free Tier)**

**Pros**: 5,000 emails/month free, good for transactional emails

```bash
# Mailgun Configuration
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=postmaster@your-domain.mailgun.org
SMTP_PASS=your-mailgun-password
FROM_EMAIL=sifosman@gmail.com
FROM_NAME=HDS Group
```

## 3. **Outlook/Hotmail (Microsoft)**

**Pros**: Uses your existing Outlook/Hotmail account

```bash
# Outlook Configuration
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=sifosman@outlook.com
SMTP_PASS=your-outlook-password
FROM_EMAIL=sifosman@outlook.com
FROM_NAME=HDS Group
```

## 4. **Zoho Mail (Free)**

**Pros**: 5GB storage, free for personal use

```bash
# Zoho Mail Configuration
SMTP_HOST=smtp.zoho.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=sifosman@zoho.com
SMTP_PASS=your-zoho-password
FROM_EMAIL=sifosman@zoho.com
FROM_NAME=HDS Group
```

## 5. **Amazon SES (Pay-as-you-go)**

**Pros**: Very cheap, excellent deliverability

```bash
# Amazon SES Configuration
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-ses-smtp-username
SMTP_PASS=your-ses-smtp-password
FROM_EMAIL=sifosman@gmail.com
FROM_NAME=HDS Group
```

## 6. **Mailtrap (Testing Only)**

**Pros**: Perfect for testing, captures emails instead of sending

```bash
# Mailtrap Configuration (Testing)
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_SECURE=false
SMTP_USER=your-mailtrap-username
SMTP_PASS=your-mailtrap-password
FROM_EMAIL=test@example.com
FROM_NAME=HDS Group
```

## Quick Setup Recommendations

### **For Immediate Testing**: SendGrid
1. Go to https://sendgrid.com
2. Sign up (free account)
3. Get API key from Settings → API Keys
4. Use configuration above

### **For Production**: Amazon SES
1. Sign up for AWS account
2. Go to SES service
3. Get SMTP credentials
4. Very cheap (first 62,000 emails/month free)

### **For Simple Setup**: Outlook
1. Create Outlook account if you don't have one
2. Use your existing Outlook credentials
3. Very straightforward

## Updated .env Template

```bash
# Choose one of these configurations:

# Option 1: SendGrid
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
FROM_EMAIL=sifosman@gmail.com
FROM_NAME=HDS Group

# Option 2: Outlook
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=sifosman@outlook.com
SMTP_PASS=your-outlook-password
FROM_EMAIL=sifosman@outlook.com
FROM_NAME=HDS Group

# Option 3: Zoho
SMTP_HOST=smtp.zoho.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=sifosman@zoho.com
SMTP_PASS=your-zoho-password
FROM_EMAIL=sifosman@zoho.com
FROM_NAME=HDS Group

# Option 4: Mailtrap (Testing)
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=2525
SMTP_SECURE=false
SMTP_USER=your-mailtrap-username
SMTP_PASS=your-mailtrap-password
FROM_EMAIL=test@example.com
FROM_NAME=HDS Group
```

## Testing Commands (Same for all providers)

```bash
# Test email service connection
curl http://localhost:3000/api/email/test-email-connection

# Quick test email
curl http://localhost:3000/api/email-hardcoded/quick-test

# Detailed test
curl -X POST http://localhost:3000/api/email-hardcoded/test-payment-email-hardcoded \
  -H "Content-Type: application/json" \
  -d '{"quoteNumber": "TEST-001", "amount": 250.50}'
```

## Provider Comparison

| Provider | Free Tier | Setup Difficulty | Deliverability |
|----------|-----------|------------------|----------------|
| SendGrid | 100/day | Easy | Excellent |
| Outlook | Unlimited | Easy | Good |
| Zoho | 5GB storage | Medium | Good |
| Mailgun | 5,000/month | Medium | Excellent |
| Amazon SES | 62,000/month | Medium | Excellent |
| Mailtrap | Testing only | Easy | N/A (captures) |

## Recommendation
**Start with SendGrid** - it's the easiest to set up and has a generous free tier that will handle your testing needs perfectly.
