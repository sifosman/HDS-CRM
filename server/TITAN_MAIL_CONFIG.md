# Titan Mail Configuration for mohamed@owdsolutions.co.za

## Titan Mail SMTP Settings

Titan Mail uses standard SMTP settings. Here's your exact configuration:

### **Primary Configuration**
```bash
# Titan Mail SMTP Settings
SMTP_HOST=smtp.titan.email
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=mohamed@owdsolutions.co.za
SMTP_PASS=your-titan-email-password
FROM_EMAIL=mohamed@owdsolutions.co.za
FROM_NAME=HDS Group
```

### **Alternative Ports (if 587 doesn't work)**
```bash
# Alternative ports
SMTP_HOST=smtp.titan.email
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=mohamed@owdsolutions.co.za
SMTP_PASS=your-titan-email-password
FROM_EMAIL=mohamed@owdsolutions.co.za
FROM_NAME=HDS Group
```

### **Port 25 (if your hosting allows)**
```bash
SMTP_HOST=smtp.titan.email
SMTP_PORT=25
SMTP_SECURE=false
SMTP_USER=mohamed@owdsolutions.co.za
SMTP_PASS=your-titan-email-password
FROM_EMAIL=mohamed@owdsolutions.co.za
FROM_NAME=HDS Group
```

## Complete .env File Template

```bash
# Titan Mail Configuration
SMTP_HOST=smtp.titan.email
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=mohamed@owdsolutions.co.za
SMTP_PASS=your-actual-titan-password
FROM_EMAIL=mohamed@owdsolutions.co.za
FROM_NAME=HDS Group

# Supabase Configuration (replace with your actual values)
SUPABASE_URL=https://your-supabase-url.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key

# PayFast Sandbox Configuration
PAYFAST_MERCHANT_ID=10000100
PAYFAST_MERCHANT_KEY=46f0cd694581a
PAYFAST_PASSPHRASE=test123
PAYFAST_SANDBOX=true

# Server Configuration
PORT=3000
NODE_ENV=development
```

## Titan Mail Setup Steps

### 1. **Get SMTP Password**
- Log into your Titan Mail account
- Your SMTP password is the same as your email password
- If you don't know it, reset it through your hosting provider

### 2. **Verify SMTP Settings**
- **SMTP Server**: smtp.titan.email
- **Port**: 587 (recommended) or 465
- **Security**: STARTTLS (port 587) or SSL/TLS (port 465)
- **Authentication**: Yes, use full email address as username

### 3. **Test Connection**
```bash
# Test email service connection
curl http://localhost:3000/api/email/test-email-connection

# Quick test email to mohamed@owdsolutions.co.za
curl http://localhost:3000/api/email-hardcoded/quick-test

# Detailed test
curl -X POST http://localhost:3000/api/email-hardcoded/test-payment-email-hardcoded \
  -H "Content-Type: application/json" \
  -d '{"quoteNumber": "TEST-001", "amount": 250.50}'
```

## Troubleshooting Titan Mail

### **Connection Issues**
1. **Check password**: Ensure you're using the correct email password
2. **Verify hostname**: Use `smtp.titan.email` (not your domain)
3. **Port selection**: Try 587 first, then 465 if 587 fails
4. **Firewall**: Ensure your hosting allows outbound SMTP

### **Authentication Errors**
- Use full email address: `mohamed@owdsolutions.co.za` (not just `mohamed`)
- Verify password is correct
- Check if SMTP is enabled in your hosting control panel

### **Email Not Sending**
- Check spam folder
- Verify DNS records for your domain
- Ensure proper MX records are set up

## Vercel Deployment with Titan Mail

```bash
# Set Titan Mail environment variables
vercel env add SMTP_HOST smtp.titan.email
vercel env add SMTP_PORT 587
vercel env add SMTP_SECURE false
vercel env add SMTP_USER mohamed@owdsolutions.co.za
vercel env add SMTP_PASS your-titan-password
vercel env add FROM_EMAIL mohamed@owdsolutions.co.za
vercel env add FROM_NAME "HDS Group"

# Deploy
vercel --prod
```

## Testing Commands Summary

```bash
# Local testing
npm run dev

# Test email connection
curl http://localhost:3000/api/email/test-email-connection

# Test email to mohamed@owdsolutions.co.za
curl http://localhost:3000/api/email-hardcoded/quick-test

# Test with custom parameters
curl -X POST http://localhost:3000/api/email-hardcoded/test-payment-email-hardcoded \
  -H "Content-Type: application/json" \
  -d '{"quoteNumber": "OWD-001", "amount": 100.00}'
```

## Expected Results

When successfully configured, you should:
- ✅ Server starts without SMTP errors
- ✅ Email connection test passes
- ✅ Emails are sent to mohamed@owdsolutions.co.za
- ✅ Payment confirmations include invoice PDFs

## Quick Verification

1. **Server logs**: Check for SMTP connection success
2. **Email inbox**: Check mohamed@owdsolutions.co.za for test emails
3. **Connection test**: `/api/email/test-email-connection` should return success
4. **End-to-end**: PayFast payment should trigger email notifications
