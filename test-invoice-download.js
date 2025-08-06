const SupabaseService = require('./server/src/services/supabase.service.js').default;

async function testInvoiceDownload() {
  try {
    console.log('Testing invoice download functionality...');
    
    // Test with a known quote ID (replace with an actual quote ID from your database)
    const testQuoteId = 'Q-20250804-4824'; // Replace with actual quote ID
    
    console.log(`Fetching invoice for quote ID: ${testQuoteId}`);
    const invoiceResult = await SupabaseService.fetchInvoiceByQuoteId(testQuoteId);
    console.log('Invoice result:', JSON.stringify(invoiceResult, null, 2));
    
    if (invoiceResult.success && invoiceResult.data) {
      console.log(`Found invoice with number: ${invoiceResult.data.invoice_number}`);
      
      console.log('Listing invoice PDFs...');
      const listResult = await SupabaseService.listInvoicePdfs(invoiceResult.data.invoice_number);
      console.log('List result:', JSON.stringify(listResult, null, 2));
      
      if (listResult.success && listResult.data && listResult.data.length > 0) {
        console.log('Found invoice PDFs in storage');
        
        console.log('Attempting to download invoice PDF...');
        const downloadResult = await SupabaseService.downloadInvoicePdf(invoiceResult.data.invoice_number);
        console.log('Download result success:', downloadResult.success);
        if (downloadResult.success) {
          console.log(`Successfully downloaded PDF: ${downloadResult.fileName}`);
          console.log(`PDF size: ${downloadResult.data.length} bytes`);
        } else {
          console.log('Failed to download PDF:', downloadResult.error);
        }
      } else {
        console.log('No invoice PDFs found in storage');
      }
    } else {
      console.log('No invoice found for quote ID');
    }
  } catch (error) {
    console.error('Test error:', error);
  }
}

testInvoiceDownload();
