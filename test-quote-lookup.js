// Test script to verify the fixed quote lookup functionality
// This simulates the same call that the invoice controller makes

const SupabaseService = require('./server/src/services/supabase.service').default;

async function testQuoteLookup() {
  const testQuoteId = 'Q-20250807-4767-HDSCHUSTR'; // Replace with your failing quote ID
  
  console.log('🧪 Testing quote lookup with fixed fetchQuoteByNumber method');
  console.log('='.repeat(60));
  console.log(`Testing quote ID: ${testQuoteId}`);
  console.log('='.repeat(60));
  
  try {
    const result = await SupabaseService.fetchQuoteByNumber(testQuoteId);
    
    console.log('\n📊 FINAL RESULT:');
    console.log('Success:', result.success);
    
    if (result.success && result.data) {
      console.log('✅ Quote found successfully!');
      console.log('Quote details:');
      console.log('- ID:', result.data.id);
      console.log('- Filename:', result.data.filename);
      console.log('- Quote Number:', result.data.quote_number);
      console.log('- Customer Name:', result.data.customer_name);
      console.log('- Total:', result.data.total);
      console.log('- Created At:', result.data.created_at);
    } else {
      console.log('❌ Quote not found');
      console.log('Error:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

// Run the test
testQuoteLookup();
