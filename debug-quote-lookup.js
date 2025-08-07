// Debug script to check if quote exists in database
// Run with: node debug-quote-lookup.js

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugQuoteLookup() {
  const quoteId = 'Q-20250807-4767-HDSCHUSTR'; // Replace with your failing quote ID
  
  console.log('🔍 Debugging quote lookup for:', quoteId);
  console.log('=====================================');
  
  try {
    // 1. Check if quote exists by filename (exact match)
    console.log('\n1. Checking exact filename match...');
    let { data, error } = await supabase
      .from('quotes')
      .select('*')
      .eq('filename', quoteId);
    
    console.log('Result:', { count: data?.length || 0, error: error?.message });
    if (data && data.length > 0) {
      console.log('Found quotes:', data.map(q => ({ 
        id: q.id, 
        filename: q.filename, 
        quote_number: q.quote_number 
      })));
    }
    
    // 2. Check if quote exists by filename with .pdf extension
    console.log('\n2. Checking filename with .pdf extension...');
    ({ data, error } = await supabase
      .from('quotes')
      .select('*')
      .eq('filename', `${quoteId}.pdf`));
    
    console.log('Result:', { count: data?.length || 0, error: error?.message });
    if (data && data.length > 0) {
      console.log('Found quotes:', data.map(q => ({ 
        id: q.id, 
        filename: q.filename, 
        quote_number: q.quote_number 
      })));
    }
    
    // 3. Check if quote exists by quote_number field
    console.log('\n3. Checking quote_number field...');
    ({ data, error } = await supabase
      .from('quotes')
      .select('*')
      .eq('quote_number', quoteId));
    
    console.log('Result:', { count: data?.length || 0, error: error?.message });
    if (data && data.length > 0) {
      console.log('Found quotes:', data.map(q => ({ 
        id: q.id, 
        filename: q.filename, 
        quote_number: q.quote_number 
      })));
    }
    
    // 4. Search for any quotes with similar patterns
    console.log('\n4. Searching for similar quote patterns...');
    ({ data, error } = await supabase
      .from('quotes')
      .select('*')
      .or(`filename.ilike.%${quoteId}%,quote_number.ilike.%${quoteId}%`));
    
    console.log('Result:', { count: data?.length || 0, error: error?.message });
    if (data && data.length > 0) {
      console.log('Found similar quotes:', data.map(q => ({ 
        id: q.id, 
        filename: q.filename, 
        quote_number: q.quote_number 
      })));
    }
    
    // 5. Get recent quotes to see what's in the database
    console.log('\n5. Getting recent quotes for reference...');
    ({ data, error } = await supabase
      .from('quotes')
      .select('id, filename, quote_number, created_at')
      .order('created_at', { ascending: false })
      .limit(10));
    
    console.log('Recent quotes:', data?.map(q => ({ 
      id: q.id, 
      filename: q.filename, 
      quote_number: q.quote_number,
      created_at: q.created_at
    })));
    
  } catch (error) {
    console.error('❌ Error during debugging:', error);
  }
}

debugQuoteLookup();
