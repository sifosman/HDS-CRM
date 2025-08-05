// Test script to verify invoice download functionality
// This script checks if PDFs exist in Supabase storage

const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'your-anon-key';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testInvoiceDownload(quoteId) {
  console.log(`Testing invoice download for quote: ${quoteId}`);
  
  const pdfFilename = `${quoteId}-quote.pdf`;
  const invoiceFilename = `${quoteId}-invoice.pdf`;
  
  try {
    // Check if quote PDF exists
    const { data: quoteData, error: quoteError } = await supabase
      .storage
      .from('hds_quotes')
      .download(pdfFilename);
    
    if (quoteData && !quoteError) {
      console.log(`✅ Quote PDF found: ${pdfFilename}`);
      return true;
    } else {
      console.log(`❌ Quote PDF not found: ${pdfFilename}`);
    }
    
    // Check if invoice PDF exists
    const { data: invoiceData, error: invoiceError } = await supabase
      .storage
      .from('hds_quotes')
      .download(invoiceFilename);
    
    if (invoiceData && !invoiceError) {
      console.log(`✅ Invoice PDF found: ${invoiceFilename}`);
      return true;
    } else {
      console.log(`❌ Invoice PDF not found: ${invoiceFilename}`);
    }
    
    console.log(`❌ No PDF found for quote: ${quoteId}`);
    return false;
    
  } catch (error) {
    console.error('Error testing invoice download:', error);
    return false;
  }
}

// Test with the current quote ID
const quoteId = 'Q-20250805-4218-HDSCHUSTR';
testInvoiceDownload(quoteId);
