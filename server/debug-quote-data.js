const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugQuoteData() {
  console.log('🔍 Debugging quote data for Q-20250807-6192-HDSDEDEU...');
  
  try {
    // Fetch the specific quote
    const { data: quote, error } = await supabase
      .from('quotes')
      .select('*')
      .eq('quote_number', 'Q-20250807-6192-HDSDEDEU')
      .single();
    
    if (error) {
      console.error('❌ Error fetching quote:', error);
      return;
    }
    
    if (!quote) {
      console.log('❌ Quote not found');
      return;
    }
    
    console.log('📋 Quote found:');
    console.log('Quote ID:', quote.id);
    console.log('Quote Number:', quote.quote_number);
    console.log('Customer Name:', quote.customer_name);
    console.log('Created At:', quote.created_at);
    
    // Parse and examine quote_data
    if (quote.quote_data) {
      try {
        const parsedQuoteData = JSON.parse(quote.quote_data);
        console.log('\n📊 Parsed quote_data structure:');
        console.log('Keys in quote_data:', Object.keys(parsedQuoteData));
        
        // Look for branch data
        if (parsedQuoteData.branchData) {
          console.log('\n🏢 Branch data found in quote_data:');
          console.log(JSON.stringify(parsedQuoteData.branchData, null, 2));
        } else {
          console.log('\n⚠️ No branchData found in quote_data');
        }
        
        // Look for other branch-related fields
        const branchFields = ['branch', 'trading_as', 'branchSelection', 'selectedBranch'];
        branchFields.forEach(field => {
          if (parsedQuoteData[field]) {
            console.log(`\n🏢 Found ${field}:`, parsedQuoteData[field]);
          }
        });
        
        // Show full structure (truncated)
        console.log('\n📊 Full quote_data structure (first 500 chars):');
        console.log(JSON.stringify(parsedQuoteData, null, 2).substring(0, 500) + '...');
        
      } catch (parseError) {
        console.error('❌ Error parsing quote_data:', parseError);
        console.log('Raw quote_data:', quote.quote_data.substring(0, 200) + '...');
      }
    } else {
      console.log('\n⚠️ No quote_data field found');
    }
    
  } catch (error) {
    console.error('❌ Error in debugQuoteData:', error);
  }
}

debugQuoteData();
