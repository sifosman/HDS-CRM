const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugBranches() {
  console.log('🔍 Debugging branches table...');
  
  try {
    // List all branches
    const { data: branches, error } = await supabase
      .from('branches')
      .select('*');
    
    if (error) {
      console.error('❌ Error fetching branches:', error);
      return;
    }
    
    console.log('📋 All branches in database:');
    console.log(JSON.stringify(branches, null, 2));
    
    if (branches && branches.length > 0) {
      console.log('\n🏢 Available trading_as values:');
      branches.forEach((branch, index) => {
        console.log(`${index + 1}. "${branch.trading_as}"`);
      });
      
      // Test lookup with first branch
      const firstBranch = branches[0];
      console.log(`\n🧪 Testing lookup with first branch: "${firstBranch.trading_as}"`);
      
      const { data: testData, error: testError } = await supabase
        .from('branches')
        .select('*')
        .eq('trading_as', firstBranch.trading_as)
        .single();
        
      if (testError) {
        console.error('❌ Test lookup failed:', testError);
      } else {
        console.log('✅ Test lookup successful:', testData);
      }
    } else {
      console.log('⚠️ No branches found in database!');
      console.log('💡 You need to add branch records to the branches table.');
    }
    
  } catch (error) {
    console.error('❌ Error in debugBranches:', error);
  }
}

debugBranches();
