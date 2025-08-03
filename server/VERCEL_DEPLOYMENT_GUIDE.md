# Vercel Deployment Guide - PayFast Email Notifications

## Quick Setup for Testing with sifosman@gmail.com

### 1. Environment Variables for Vercel

Add these exact variables to your Vercel project:

```bash
# PayFast Sandbox Configuration
PAYFAST_MERCHANT_ID=10000100
PAYFAST_MERCHANT_KEY=46f0cd694581a
PAYFAST_PASSPHRASE=test123
PAYFAST_SANDBOX=true
PAYFAST_BASE_URL=https://your-app.vercel.app

# Email Configuration (for sifosman@gmail.com)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=sifosman@gmail.com
SMTP_PASS=your-app-password-here
FROM_EMAIL=sifosman@gmail.com
FROM_NAME=HDS Group

# Supabase Configuration
SUPABASE_URL=https://your-supabase-url.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key

# Server Configuration
PORT=3000
NODE_ENV=production
```

### 2. Gmail App Password Setup

For sifosman@gmail.com:

1. Go to Google Account Settings
2. Security → 2-Step Verification → App passwords
3. Generate app password for "Mail"
4. Use this password for SMTP_PASS (not your regular password)

### 3. Immediate Testing Commands

```bash
# Test 1: Check email service connection
curl https://your-app.vercel.app/api/email/test-email-connection

# Test 2: Quick test with hardcoded email
curl https://your-app.vercel.app/api/email-hardcoded/quick-test

# Test 3: Detailed test with parameters
curl -X POST https://your-app.vercel.app/api/email-hardcoded/test-payment-email-hardcoded \
  -H "Content-Type: application/json" \
  -d '{
    "quoteNumber": "TEST-12345",
    "amount": 250.50,
    "invoicePath": "./test-invoice.pdf"
  }'
```

### 4. PayFast Testing URLs

When testing PayFast integration:

**Payment Form URL**:
```
https://your-app.vercel.app/api/payfast/payment-form?quoteId=12345&amount=250.50&projectName=TestProject&customerName=JohnDoe&customerEmail=sifosman@gmail.com
```

**ITN Endpoint** (for PayFast webhook):
```
https://your-app.vercel.app/api/payfast/notify
```

### 5. Vercel Dashboard Setup

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Select your project
3. Settings → Environment Variables
4. Add all variables from section 1
5. Redeploy after adding variables

### 6. Testing Workflow

1. **Test Email Service**:
   ```bash
   curl https://your-app.vercel.app/api/email-hardcoded/quick-test
   ```

2. **Test PayFast Integration**:
   - Use PayFast sandbox credentials
   - Test with small amounts (R1.00)
   - Verify email is received at sifosman@gmail.com

3. **Verify Email Content**:
   - Check spam folder
   - Verify PDF attachment
   - Check optimization details

### 7. Troubleshooting

**Email not sending?**
- Check Gmail app password is correct
- Verify SMTP settings
- Check Vercel logs for errors

**PayFast not working?**
- Verify sandbox credentials
- Check webhook URL is correct
- Ensure HTTPS is enabled (required for PayFast)

**Environment variables not loading?**
- Redeploy after adding variables
- Check for typos in variable names
- Verify all required variables are present

### 8. Production Checklist

- [ ] Replace sandbox credentials with live PayFast credentials
- [ ] Update FROM_EMAIL to production email
- [ ] Verify all environment variables are set
- [ ] Test with real payment amounts
- [ ] Check email delivery to customer emails

### 9. Quick Commands Summary

```bash
# Deploy to Vercel
vercel --prod

# Check logs
vercel logs --follow

# Test email
curl https://your-app.vercel.app/api/email-hardcoded/quick-test

# Test PayFast form
curl "https://your-app.vercel.app/api/payfast/payment-form?quoteId=TEST&amount=1.00&customerEmail=sifosman@gmail.com"
```

### 10. Support Information

**Email**: sifosman@gmail.com (configured for testing)
**PayFast Sandbox**: Using test merchant ID 10000100
**Environment**: Vercel production with sandbox credentials
