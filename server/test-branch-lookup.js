const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testBranchLookup() {
  console.log('🔍 Testing branch lookup logic...');
  
  try {
    // Test 1: Try to find 'HDS Group' (should fail)
    console.log('\n1️⃣ Testing lookup for "HDS Group"...');
    const { data: hdsGroup, error: hdsError } = await supabase
      .from('branches')
      .select('*')
      .eq('trading_as', 'HDS Group')
      .single();
    
    if (hdsError) {
      console.log('❌ HDS Group not found (expected):', hdsError.message);
    } else {
      console.log('✅ HDS Group found:', hdsGroup);
    }
    
    // Test 2: Get first available branch (fallback)
    console.log('\n2️⃣ Testing fallback - get first available branch...');
    const { data: firstBranch, error: firstError } = await supabase
      .from('branches')
      .select('*')
      .limit(1)
      .single();
    
    if (firstError) {
      console.log('❌ No branches found:', firstError.message);
    } else {
      console.log('✅ First available branch:', {
        trading_as: firstBranch.trading_as,
        branch_address: firstBranch.branch_address,
        branch_telephone: firstBranch.branch_telephone,
        email_address: firstBranch.email_address
      });
    }
    
    // Test 3: Simulate the exact logic from invoice generation
    console.log('\n3️⃣ Simulating invoice generation branch lookup...');
    
    let branchData = { 
      name: 'HDS Group', 
      trading_as: 'HDS Group',
      branch_address: '',
      branch_telephone: '', 
      email_address: '' 
    };
    
    let branchTradingAs = 'HDS Group'; // Default fallback
    
    console.log(`Fetching branch data for: ${branchTradingAs}`);
    const branchResult = await supabase
      .from('branches')
      .select('*')
      .eq('trading_as', branchTradingAs)
      .single();
    
    if (!branchResult.error && branchResult.data) {
      const branch = branchResult.data;
      branchData = {
        name: branch.trading_as || 'HDS Group',
        trading_as: branch.trading_as || 'HDS Group',
        branch_address: branch.branch_address || '',
        branch_telephone: branch.branch_telephone || '',
        email_address: branch.email_address || ''
      };
      console.log(`✅ Fetched branch data:`, branchData);
    } else {
      console.log(`⚠️ Branch not found: ${branchTradingAs}, trying to get first available branch...`);
      
      // Fallback: Get the first available branch from the database
      const fallbackBranchResult = await supabase
        .from('branches')
        .select('*')
        .limit(1)
        .single();
      
      if (!fallbackBranchResult.error && fallbackBranchResult.data) {
        const branch = fallbackBranchResult.data;
        branchData = {
          name: branch.trading_as || 'HDS Group',
          trading_as: branch.trading_as || 'HDS Group',
          branch_address: branch.branch_address || '',
          branch_telephone: branch.branch_telephone || '',
          email_address: branch.email_address || ''
        };
        console.log(`✅ Using fallback branch data:`, branchData);
      } else {
        console.log(`⚠️ No branches found in database, using hardcoded defaults`);
      }
    }
    
    // Test 4: Show what would be displayed on invoice
    console.log('\n4️⃣ What would be displayed on invoice PDF:');
    const effectiveBranchData = branchData || {
      name: 'HDS Group',
      trading_as: 'HDS Group',
      branch_address: 'Please contact us for address details',
      branch_telephone: '011 123 4567',
      email_address: 'info@hdsgroup.co.za'
    };
    
    const companyName = effectiveBranchData.trading_as || effectiveBranchData.name || 'HDS Group';
    const address = effectiveBranchData.branch_address || 'Please contact us for address details';
    const phone = effectiveBranchData.branch_telephone || '011 123 4567';
    const email = effectiveBranchData.email_address || 'info@hdsgroup.co.za';
    
    console.log('📄 Invoice PDF would show:');
    console.log(`   Company: ${companyName}`);
    console.log(`   Address: ${address}`);
    console.log(`   Phone: Tel: ${phone}`);
    console.log(`   Email: ${email}`);
    
  } catch (error) {
    console.error('❌ Error in testBranchLookup:', error);
  }
}

testBranchLookup();
