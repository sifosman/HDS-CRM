const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeQuoteFilename() {
  console.log('🔍 Analyzing quote filename pattern...');
  
  try {
    // Get the specific quote
    const { data: quote, error } = await supabase
      .from('quotes')
      .select('*')
      .eq('quote_number', 'Q-20250807-6192-HDSDEDEU')
      .single();
    
    if (error) {
      console.error('❌ Error fetching quote:', error);
      return;
    }
    
    console.log('📋 Quote data:');
    console.log('Quote Number:', quote.quote_number);
    console.log('Filename:', quote.filename);
    console.log('Customer Name:', quote.customer_name);
    
    // Extract branch identifier from filename
    const filename = quote.filename || quote.quote_number;
    console.log('\n🔍 Analyzing filename pattern:', filename);
    
    // Pattern: Q-YYYYMMDD-NNNN-BRANCHCODE
    const parts = filename.split('-');
    if (parts.length >= 4) {
      const branchCode = parts[3];
      console.log('🏢 Extracted branch code:', branchCode);
      
      // Now let's see what branches we have and try to match
      console.log('\n🏢 Available branches:');
      const { data: branches, error: branchError } = await supabase
        .from('branches')
        .select('trading_as, branch_address, branch_telephone, email_address');
      
      if (branchError) {
        console.error('❌ Error fetching branches:', branchError);
        return;
      }
      
      branches.forEach((branch, index) => {
        console.log(`${index + 1}. ${branch.trading_as}`);
      });
      
      // Try to find a match
      console.log('\n🔍 Looking for matches with branch code:', branchCode);
      
      // Try exact match first
      const exactMatch = branches.find(b => b.trading_as === branchCode);
      if (exactMatch) {
        console.log('✅ Exact match found:', exactMatch.trading_as);
        return;
      }
      
      // Try partial matches
      const partialMatches = branches.filter(b => 
        b.trading_as.toLowerCase().includes(branchCode.toLowerCase()) ||
        branchCode.toLowerCase().includes(b.trading_as.toLowerCase()) ||
        b.trading_as.replace(/\s+/g, '').toLowerCase().includes(branchCode.toLowerCase()) ||
        branchCode.toLowerCase().includes(b.trading_as.replace(/\s+/g, '').toLowerCase())
      );
      
      if (partialMatches.length > 0) {
        console.log('🔍 Partial matches found:');
        partialMatches.forEach(match => {
          console.log(`  - ${match.trading_as}`);
        });
      } else {
        console.log('❌ No matches found for branch code:', branchCode);
      }
      
      // Let's also try some pattern matching
      console.log('\n🔍 Trying pattern matching...');
      
      // HDSDEDEU might be "HDS" + location code
      if (branchCode.startsWith('HDS')) {
        const locationCode = branchCode.substring(3);
        console.log('Location code extracted:', locationCode);
        
        const locationMatches = branches.filter(b => 
          b.trading_as.toLowerCase().includes(locationCode.toLowerCase())
        );
        
        if (locationMatches.length > 0) {
          console.log('🎯 Location-based matches:');
          locationMatches.forEach(match => {
            console.log(`  - ${match.trading_as}`);
          });
        }
      }
      
    } else {
      console.log('❌ Filename does not match expected pattern');
    }
    
  } catch (error) {
    console.error('❌ Error in analyzeQuoteFilename:', error);
  }
}

analyzeQuoteFilename();
