# PayFast Integration Testing Guide

This guide explains how to test the PayFast payment success page and invoice download functionality.

## Prerequisites

1. Ensure your server is running
2. Ensure Supabase is properly configured

## Important Note

You have already updated your database schema with all the necessary fields for complete invoice functionality. The migration has been successfully applied.

## Step 1: Insert Complete Test Data

Run the `test_quote_data_complete.sql` script to update an existing quote with complete test data:

```sql
-- Update an existing quote with complete data
-- Replace 'existing-quote-id' with an actual quote ID from your database
-- You can find an existing quote ID with: SELECT id FROM quotes LIMIT 1;

UPDATE quotes SET 
  quote_number = 'Q-20250805-0001-HDSPRO',
  customer_name = 'Test Customer',
  customer_phone = '+27123456789',
  customer_email = 'test@example.com',
  project_name = 'Test Project',
  quote_data = '{"items": [{"description": "Test Item 1", "quantity": 2, "unitPrice": 500.00, "total": 1000.00}, {"description": "Test Item 2", "quantity": 1, "unitPrice": 200.00, "total": 200.00}], "totals": {"subtotal": 1200.00, "tax": 180.00, "finalTotal": 1380.00}}'::jsonb,
  subtotal = 1200.00,
  tax = 180.00,
  total = 1380.00,
  status = 'approved',
  cutlist_url = 'https://example.com/cutlist.pdf',
  expiry_date = NOW() + INTERVAL '30 days'
WHERE id = 'existing-quote-id'; -- Replace with actual quote ID
```

## Step 2: Test Invoice Download

1. Push your changes to git and build/deploy your application
2. Open your browser and navigate to:
   ```
   http://your-deployed-url/api/invoices/download/Q-20250805-0001-HDSPRO
   ```
   
   (Replace `your-deployed-url` with your actual deployed URL)

3. You should receive a complete PDF download with all quote details

## Step 3: Test PayFast Success Page

After deploying your application, you can test the PayFast success page by simulating a success callback:

```
http://your-deployed-url/api/payfast/success?m_payment_id=QUOTE-Q-20250805-0001-HDSPRO-1754311399090&pf_payment_id=123456&amount_gross=1380.00&item_name=HDS Quote Q-20250805-0001-HDSPRO
```

This should display the success page with:
- Payment details
- Complete quote information
- Download Invoice button
- Share on WhatsApp button

## Expected Results

1. **Invoice Download**: Should successfully download a complete PDF invoice with all details
2. **Success Page**: Should display all payment and quote details correctly
3. **Download Button**: Should work and trigger invoice download
4. **WhatsApp Button**: Should work and open WhatsApp with a pre-filled message

## Troubleshooting

If you encounter issues:

1. Check server logs for error messages
2. Verify the quote exists in the database with the correct quote_number
3. Ensure all required fields are properly populated
4. Check that the Supabase connection is working

## Key Changes Made

1. **Fixed invoice.controller.ts**: Changed `fetchQuoteById` to `fetchQuoteByNumber` in the `downloadInvoice` function
2. **Verified PayFast controller**: Confirmed it uses `fetchQuoteByNumber` for fetching quote details
3. **Database Schema Enhancement**: Added all necessary fields for complete invoice functionality
4. **Maintained compatibility**: All existing functionality should continue to work

The fix ensures that human-readable quote numbers (like `Q-20250805-0001-HDSPRO`) are correctly used to fetch quotes from the database using the `quote_number` column, rather than trying to use them as UUIDs with the `id` column.
