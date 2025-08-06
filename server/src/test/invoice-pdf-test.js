// Test script to verify invoice PDF generation and upload functionality
import SupabaseService from '../services/supabase.service';

async function testInvoicePdfGeneration() {
  console.log('🧪 Testing Invoice PDF Generation and Upload...\n');
  
  try {
    // Test quote number - replace with actual quote number from your database
    const testQuoteNumber = 'Q-20250115-1234'; // Update this with a real quote number
    
    console.log('📋 Step 1: Testing quote fetch...');
    const quoteResult = await SupabaseService.fetchQuoteByNumber(testQuoteNumber);
    
    if (!quoteResult.success) {
      console.error('❌ Quote fetch failed:', quoteResult.error);
      return;
    }
    
    console.log('✅ Quote fetched successfully');
    console.log('📄 Quote ID:', quoteResult.data.id);
    console.log('👤 Customer:', quoteResult.data.customer_name);
    console.log('💰 Total:', quoteResult.data.total);
    
    console.log('\n📋 Step 2: Testing invoice creation...');
    
    const paymentDetails = {
      method: 'Credit Card',
      reference: 'TEST-PAYMENT-123',
      date: new Date().toISOString()
    };
    
    const invoiceResult = await SupabaseService.createInvoice(testQuoteNumber, paymentDetails);
    
    if (!invoiceResult.success) {
      console.error('❌ Invoice creation failed:', invoiceResult.error);
      return;
    }
    
    console.log('✅ Invoice created successfully');
    console.log('📄 Invoice Number:', invoiceResult.data.invoiceNumber);
    
    console.log('\n📋 Step 3: Testing PDF generation and upload...');
    
    const pdfResult = await SupabaseService.generateAndUploadInvoicePdf(
      testQuoteNumber, 
      invoiceResult.data.invoiceNumber
    );
    
    if (pdfResult.success) {
      console.log('✅ PDF generated and uploaded successfully');
      console.log('🔗 PDF URL:', pdfResult.publicUrl);
      
      // Test the URL is accessible
      console.log('\n📋 Step 4: Testing PDF URL accessibility...');
      try {
        const response = await fetch(pdfResult.publicUrl);
        if (response.ok) {
          console.log('✅ PDF URL is accessible');
        } else {
          console.error('❌ PDF URL returned:', response.status);
        }
      } catch (error) {
        console.error('❌ Error accessing PDF URL:', error.message);
      }
      
    } else {
      console.error('❌ PDF generation failed:', pdfResult.error);
    }
    
    console.log('\n🎉 Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testInvoicePdfGeneration();
}
