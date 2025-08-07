const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testNewBranchLookup() {
  console.log('🧪 Testing new filename-based branch lookup...');
  
  try {
    // Simulate the new branch lookup logic
    const filename = 'Q-20250807-6192-HDSDEDEU';
    console.log(`📋 Testing with filename: ${filename}`);
    
    const parts = filename.split('-');
    let branchFound = false;
    let branchData = { 
      name: 'HDS Group', 
      trading_as: 'HDS Group',
      branch_address: '',
      branch_telephone: '', 
      email_address: '' 
    };
    
    if (parts.length >= 4) {
      const branchCode = parts[3];
      console.log(`🔍 Extracted branch code: ${branchCode}`);
      
      // Get all branches to find the best match
      const { data: allBranches, error: branchesError } = await supabase
        .from('branches')
        .select('*');
      
      if (!branchesError && allBranches && allBranches.length > 0) {
        console.log(`📊 Found ${allBranches.length} branches in database`);
        
        // Try exact match first
        let matchedBranch = allBranches.find(b => b.trading_as === branchCode);
        console.log('🔍 Exact match result:', matchedBranch ? matchedBranch.trading_as : 'None');
        
        if (!matchedBranch) {
          // Try partial matches
          matchedBranch = allBranches.find(b => 
            b.trading_as.toLowerCase().includes(branchCode.toLowerCase()) ||
            branchCode.toLowerCase().includes(b.trading_as.toLowerCase())
          );
          console.log('🔍 Partial match result:', matchedBranch ? matchedBranch.trading_as : 'None');
        }
        
        if (!matchedBranch && branchCode.startsWith('HDS')) {
          // Extract location code and try pattern matching
          const locationCode = branchCode.substring(3);
          console.log(`🔍 Trying location-based matching with: ${locationCode}`);
          
          // Special case mappings
          const locationMappings = {
            'DEDEU': 'HDS De Deur',
            'LOUIS': 'HDS Louis Trichardt',
            'BLOEM': 'HDS Bloemfontein',
            // ... other mappings
          };
          
          // Check if we have a direct mapping
          if (locationMappings[locationCode]) {
            matchedBranch = allBranches.find(b => b.trading_as === locationMappings[locationCode]);
            if (matchedBranch) {
              console.log(`✅ Found branch using location mapping: ${matchedBranch.trading_as}`);
            }
          }
          
          // If no direct mapping, try fuzzy matching
          if (!matchedBranch) {
            matchedBranch = allBranches.find(b => {
              const branchName = b.trading_as.toLowerCase().replace(/hds\s+/i, '');
              return branchName.includes(locationCode.toLowerCase()) ||
                     locationCode.toLowerCase().includes(branchName);
            });
            console.log('🔍 Fuzzy match result:', matchedBranch ? matchedBranch.trading_as : 'None');
          }
        }
        
        if (matchedBranch) {
          branchData = {
            name: matchedBranch.trading_as,
            trading_as: matchedBranch.trading_as,
            branch_address: matchedBranch.branch_address || '',
            branch_telephone: matchedBranch.branch_telephone || '',
            email_address: matchedBranch.email_address || ''
          };
          branchFound = true;
          console.log(`✅ Successfully matched branch: ${matchedBranch.trading_as}`);
          console.log(`📍 Branch details:`, {
            address: branchData.branch_address,
            phone: branchData.branch_telephone,
            email: branchData.email_address
          });
        }
      }
    }
    
    if (!branchFound) {
      console.log(`⚠️ Could not determine branch from filename: ${filename}`);
      console.log(`⚠️ Using default branch data`);
    }
    
    // Show what would be displayed on invoice
    console.log('\n📄 Invoice PDF would display:');
    console.log(`   Company: ${branchData.trading_as}`);
    console.log(`   Address: ${branchData.branch_address || 'Please contact us for address details'}`);
    console.log(`   Phone: Tel: ${branchData.branch_telephone || '011 123 4567'}`);
    console.log(`   Email: ${branchData.email_address || 'info@hdsgroup.co.za'}`);
    
  } catch (error) {
    console.error('❌ Error in testNewBranchLookup:', error);
  }
}

testNewBranchLookup();
