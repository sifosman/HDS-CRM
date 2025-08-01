# PayFast Integration Setup Guide

This document provides instructions for properly configuring and using the PayFast payment integration in this application.

## Environment Variables

To configure PayFast, you need to set the following environment variables in your `.env` file:

```
PAYFAST_MERCHANT_ID=your_merchant_id
PAYFAST_MERCHANT_KEY=your_merchant_key
PAYFAST_PASSPHRASE=your_passphrase
PAYFAST_SANDBOX=true_or_false
BASE_URL=https://your-domain.com
```

## Sandbox vs Production

- For testing: Set `PAYFAST_SANDBOX=true`
- For production: Set `PAYFAST_SANDBOX=false`

## Testing

You can test the PayFast integration using the following endpoints:

- `/api/payfast/debug` - Debug signature generation
- `/api/payfast/test-signature` - Test signature verification
- `/api/payfast/pay?quoteId=123&amount=100.00` - Generate payment form

## Security Considerations

1. Never commit your `.env` file to version control
2. Use strong, unique values for your PayFast credentials
3. Ensure your `BASE_URL` is set to your production domain in production

## Troubleshooting

If you encounter issues with PayFast integration:

1. Verify all environment variables are correctly set
2. Check that your PayFast account is properly configured
3. Ensure your server can receive POST requests at the notification endpoint
4. Check server logs for error messages

For more information, refer to the [PayFast Developer Documentation](https://developers.payfast.co.za/).
