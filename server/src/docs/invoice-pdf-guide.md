# Invoice PDF Generation and Storage Guide

This guide explains how to use the new invoice PDF generation and storage functionality integrated with the HDS Group system.

## Overview

The system now automatically generates PDF invoices from quote data and stores them in a public Supabase storage bucket named "invoices". The PDF URLs are then stored in the invoice records for easy retrieval.

## Key Features

1. **Automatic PDF Generation**: Creates professional PDF invoices from quote data
2. **Supabase Storage**: Uploads PDFs to the "invoices" bucket
3. **Public URLs**: Generates publicly accessible URLs for easy sharing
4. **Database Integration**: Stores PDF URLs in invoice records
5. **Error Handling**: Comprehensive error handling and logging

## API Endpoints

### Generate Invoice PDF
```
POST /api/invoice-pdf/generate/:quoteNumber
```
Generates a new invoice with PDF for a given quote number.

**Response:**
```json
{
  "success": true,
  "message": "Invoice PDF generated successfully",
  "invoiceNumber": "INV-20250115-1234",
  "pdfUrl": "https://your-supabase-url.supabase.co/storage/v1/object/public/invoices/invoice-INV-20250115-1234-1642245678900.pdf"
}
```

### Get Invoice Details
```
GET /api/invoice-pdf/:invoiceNumber
```
Retrieves invoice details including the PDF URL.

**Response:**
```json
{
  "success": true,
  "data": {
    "invoiceNumber": "INV-20250115-1234",
    "quoteNumber": "Q-20250115-1234",
    "customerName": "John Doe",
    "total": 1250.50,
    "pdfUrl": "https://your-supabase-url.supabase.co/storage/v1/object/public/invoices/invoice-INV-20250115-1234-1642245678900.pdf",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "status": "pending"
  }
}
```

### Regenerate Invoice PDF
```
POST /api/invoice-pdf/regenerate/:invoiceNumber
```
Regenerates the PDF for an existing invoice (useful if original failed).

## Usage Examples

### 1. After Payment Success
Integrate with PayFast success handler:

```javascript
// In payfast.controller.js after successful payment
const result = await SupabaseService.createInvoiceWithPdf(quoteNumber, {
  method: 'PayFast',
  reference: paymentData.pf_payment_id,
  date: new Date().toISOString()
});

if (result.success) {
  console.log('Invoice created with PDF:', result.data.pdfUrl);
  // Send success response with PDF URL
}
```

### 2. Manual Invoice Creation
```javascript
const result = await SupabaseService.createInvoiceWithPdf(
  'Q-20250115-1234',
  {
    method: 'Credit Card',
    reference: 'MANUAL-001',
    date: new Date().toISOString()
  }
);
```

### 3. Generate PDF Only
```javascript
const pdfResult = await SupabaseService.generateAndUploadInvoicePdf(
  'Q-20250115-1234',
  'INV-20250115-1234'
);
```

## Database Schema

### Invoices Table
```sql
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  quote_id UUID REFERENCES quotes(id),
  quote_number VARCHAR(50),
  customer_name VARCHAR(255),
  customer_phone VARCHAR(50),
  customer_email VARCHAR(255),
  items JSONB,
  subtotal DECIMAL(10,2),
  tax DECIMAL(10,2),
  total DECIMAL(10,2),
  payment_method VARCHAR(50),
  payment_reference VARCHAR(255),
  payment_date TIMESTAMP,
  status VARCHAR(20) DEFAULT 'pending',
  pdf_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  due_date TIMESTAMP
);
```

## Storage Bucket Setup

### Supabase Storage Bucket: "invoices"
- **Name**: invoices
- **Public**: Yes (for easy access)
- **File Naming**: `invoice-{invoiceNumber}-{timestamp}.pdf`

## Integration Points

### 1. PayFast Success Handler
Update the PayFast success handler to automatically generate invoices with PDFs:

```javascript
// In payfast.controller.js
async function handlePaymentSuccess(req, res) {
  // ... existing payment processing ...
  
  // Generate invoice with PDF
  const invoiceResult = await SupabaseService.createInvoiceWithPdf(quoteNumber, {
    method: 'PayFast',
    reference: paymentData.pf_payment_id,
    date: new Date().toISOString()
  });
  
  if (invoiceResult.success) {
    // Include PDF URL in success response
    res.json({
      success: true,
      message: 'Payment successful',
      invoiceNumber: invoiceResult.data.invoiceNumber,
      pdfUrl: invoiceResult.data.pdfUrl
    });
  }
}
```

### 2. Frontend Integration
```javascript
// Download invoice button
function downloadInvoice(invoiceNumber) {
  window.open(`/api/invoices/download/${invoiceNumber}`, '_blank');
}

// View invoice PDF
function viewInvoicePdf(invoiceNumber) {
  window.open(`/api/invoice-pdf/${invoiceNumber}`, '_blank');
}
```

## Error Handling

The system includes comprehensive error handling:

- **Quote Not Found**: Returns appropriate error message
- **PDF Generation Failed**: Logs error and continues without failing
- **Upload Failed**: Returns error details for debugging
- **Database Errors**: Graceful handling with informative messages

## Testing

### Manual Testing
1. Create a test quote
2. Use the test endpoint: `POST /api/invoice-pdf/generate/:quoteNumber`
3. Verify PDF is generated and uploaded
4. Check the PDF URL is accessible
5. Verify invoice record is updated with PDF URL

### Automated Testing
Run the test script:
```bash
node server/src/test/invoice-pdf-test.js
```

## Troubleshooting

### Common Issues

1. **"Quote not found"**
   - Verify quote number exists in database
   - Check quote_number format matches exactly

2. **"Failed to generate PDF"**
   - Check if PDF generation service is available
   - Verify quote data has required fields

3. **"Failed to upload PDF"**
   - Verify Supabase storage bucket "invoices" exists
   - Check storage permissions
   - Verify environment variables are set

4. **PDF URL not accessible**
   - Check if bucket is public
   - Verify CORS settings
   - Test URL directly in browser

### Environment Variables
```bash
# Required for Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Optional
PORT=5000
```

## Best Practices

1. **Error Logging**: Always log errors for debugging
2. **Retry Logic**: Implement retry for failed uploads
3. **Validation**: Validate quote data before PDF generation
4. **Monitoring**: Set up alerts for failed PDF generations
5. **Backup**: Keep track of failed PDF generations for manual processing

## Next Steps

1. **Integration**: Update PayFast success handler to use new functionality
2. **Frontend**: Add download invoice buttons to UI
3. **Monitoring**: Set up alerts for failed PDF generations
4. **Optimization**: Add caching for frequently accessed PDFs
5. **Enhancement**: Add email notifications with PDF attachments
