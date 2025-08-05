# PayFast Integration Testing Guide

This guide explains how to test the PayFast payment success page and invoice download functionality.

## Prerequisites

1. Ensure your server is running
2. Ensure Supabase is properly configured

## Important Note

You have already updated your database schema with all the necessary fields for complete invoice functionality. The migration has been successfully applied.

## Step 1: Insert Complete Test Data

Run the `test_data_complete.sql` script to create both a test cutlist and a test quote with all required fields:

```sql
-- This script creates both a test cutlist and a test quote with all required fields

-- Create a test cutlist (if you don't have any existing ones)
INSERT INTO cutlists (id, unit) 
VALUES ('test-cutlist-001', 'mm')
ON CONFLICT (id) DO NOTHING; -- Prevents error if it already exists

-- Create a complete test quote referencing the test cutlist
INSERT INTO quotes (
  filename, 
  cutlist_id, 
  quote_number,
  customer_name,
  customer_phone,
  customer_email,
  project_name,
  quote_data,
  subtotal,
  tax,
  total,
  status,
  cutlist_url,
  expiry_date
) VALUES (
  'test-quote.pdf',
  'test-cutlist-001', -- References the cutlist we just created
  'Q-20250805-0001-HDSPRO',
  'Test Customer',
  '+27123456789',
  'test@example.com',
  'Test Project',
  '{"items": [{"description": "Test Item 1", "quantity": 2, "unitPrice": 500.00, "total": 1000.00}, {"description": "Test Item 2", "quantity": 1, "unitPrice": 200.00, "total": 200.00}], "totals": {"subtotal": 1200.00, "tax": 180.00, "finalTotal": 1380.00}}'::jsonb,
  1200.00,
  180.00,
  1380.00,
  'approved',
  'https://example.com/cutlist.pdf',
  NOW() + INTERVAL '30 days'
)
ON CONFLICT DO NOTHING; -- Prevents error if quote already exists
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
