# Email Testing Commands for sifosman@gmail.com

## Immediate Testing (Local)

### 1. Start Server
```bash
cd server
npm run dev
```

### 2. Test Email Connection
```bash
curl http://localhost:3000/api/email/test-email-connection
```

### 3. Quick Test Email to sifosman@gmail.com
```bash
curl http://localhost:3000/api/email-hardcoded/quick-test
```

### 4. Detailed Test with Parameters
```bash
curl -X POST http://localhost:3000/api/email-hardcoded/test-payment-email-hardcoded \
  -H "Content-Type: application/json" \
  -d '{
    "quoteNumber": "TEST-QUOTE-001",
    "amount": 250.50,
    "invoicePath": "./test-invoice.pdf"
  }'
```

### 5. Test with Custom Parameters
```bash
curl -X POST http://localhost:3000/api/email-hardcoded/test-payment-email-hardcoded \
  -H "Content-Type: application/json" \
  -d '{
    "quoteNumber": "CUSTOM-123",
    "amount": 100.00
  }'
```

## Environment Variables for Local Testing

Create `.env` file in server directory:

```bash
# Copy from .env.example
cp .env.example .env

# Add your email settings
echo "SMTP_HOST=smtp.gmail.com" >> .env
echo "SMTP_PORT=587" >> .env
echo "SMTP_SECURE=false" >> .env
echo "SMTP_USER=sifosman@gmail.com" >> .env
echo "SMTP_PASS=your-app-password-here" >> .env
echo "FROM_EMAIL=sifosman@gmail.com" >> .env
echo "FROM_NAME=HDS Group" >> .env
```

## Vercel Environment Setup Commands

### 1. Install Vercel CLI
```bash
npm i -g vercel
```

### 2. Deploy with Environment Variables
```bash
vercel env add SMTP_HOST smtp.gmail.com
vercel env add SMTP_PORT 587
vercel env add SMTP_SECURE false
vercel env add SMTP_USER sifosman@gmail.com
vercel env add SMTP_PASS your-app-password-here
vercel env add FROM_EMAIL sifosman@gmail.com
vercel env add FROM_NAME "HDS Group"

# PayFast Sandbox
vercel env add PAYFAST_MERCHANT_ID 10000100
vercel env add PAYFAST_MERCHANT_KEY 46f0cd694581a
vercel env add PAYFAST_PASSPHRASE test123
vercel env add PAYFAST_SANDBOX true

# Deploy
vercel --prod
```

### 3. Test After Vercel Deployment
```bash
# Replace your-domain.vercel.app with actual domain
curl https://your-domain.vercel.app/api/email-hardcoded/quick-test
```

## Gmail App Password Setup

1. Go to: https://myaccount.google.com/security
2. Enable 2-Step Verification
3. Go to: https://myaccount.google.com/apppasswords
4. Generate app password for "Mail"
5. Use this 16-character password for SMTP_PASS

## Quick Verification Steps

1. ✅ Server starts without errors
2. ✅ Email connection test passes
3. ✅ Email received at sifosman@gmail.com
4. ✅ PayFast sandbox integration works
5. ✅ End-to-end payment flow triggers email

## Expected Email Content

When successful, you'll receive an email at sifosman@gmail.com with:
- Subject: "Payment Confirmed - Invoice TEST-QUOTE-001"
- PDF invoice attachment
- Board optimization details
- Payment confirmation

## Troubleshooting

If email fails, check:
1. Gmail app password is correct
2. Less secure apps access is enabled
3. Vercel environment variables are set
4. Server logs for any error messages
