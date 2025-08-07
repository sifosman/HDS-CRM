const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testInvoiceAmounts() {
  console.log('💰 Testing invoice amounts calculation...');
  
  try {
    // Fetch the quote data to understand the structure
    const { data: quote, error } = await supabase
      .from('quotes')
      .select('*')
      .eq('quote_number', 'Q-20250807-6192-HDSDEDEU')
      .single();
    
    if (error) {
      console.error('❌ Error fetching quote:', error);
      return;
    }
    
    console.log('📋 Quote found:');
    console.log('Quote Number:', quote.quote_number);
    console.log('Total in quotes table:', quote.total);
    
    // Parse quote_data to see the structure
    if (quote.quote_data) {
      try {
        const parsedQuoteData = JSON.parse(quote.quote_data);
        
        console.log('\n📊 Quote data structure:');
        console.log('Keys:', Object.keys(parsedQuoteData));
        
        // Check items
        if (parsedQuoteData.items) {
          console.log('\n📦 Items in quote:');
          let itemsTotal = 0;
          parsedQuoteData.items.forEach((item, index) => {
            console.log(`${index + 1}. ${item.description}`);
            console.log(`   Quantity: ${item.quantity}`);
            console.log(`   Unit Price: R${item.unitPrice}`);
            console.log(`   Total: R${item.total}`);
            itemsTotal += item.total;
          });
          console.log(`\n💰 Items subtotal: R${itemsTotal.toFixed(2)}`);
        }
        
        // Check totals
        if (parsedQuoteData.totals) {
          console.log('\n💰 Totals in quote:');
          console.log('Subtotal:', parsedQuoteData.totals.subtotal);
          console.log('Tax:', parsedQuoteData.totals.tax);
          console.log('Final Total:', parsedQuoteData.totals.finalTotal);
          
          // Calculate what the invoice should show with 15.5% VAT
          const subtotal = parsedQuoteData.totals.subtotal || parsedQuoteData.totals.finalTotal;
          const vatRate = 0.155; // 15.5%
          const vatAmount = subtotal * vatRate;
          const totalIncVAT = subtotal + vatAmount;
          
          console.log('\n🧮 Invoice calculation preview:');
          console.log(`Subtotal (Excl. VAT): R${subtotal.toFixed(2)}`);
          console.log(`VAT (15.5%): R${vatAmount.toFixed(2)}`);
          console.log(`TOTAL (Incl. VAT): R${totalIncVAT.toFixed(2)}`);
        }
        
        // Look for sections data (used in invoice generation)
        if (parsedQuoteData.sections) {
          console.log('\n📊 Sections data found:');
          let sectionsTotal = 0;
          parsedQuoteData.sections.forEach((section, index) => {
            console.log(`Section ${index + 1}:`);
            console.log(`  Description: ${section.description || section.material}`);
            console.log(`  Price per board: R${section.pricePerBoard}`);
            console.log(`  Boards needed: ${section.boardsNeeded}`);
            console.log(`  Section total: R${section.sectionTotal}`);
            
            if (section.sectionTotal) {
              sectionsTotal += section.sectionTotal;
            }
          });
          console.log(`\n💰 Sections subtotal: R${sectionsTotal.toFixed(2)}`);
        }
        
      } catch (parseError) {
        console.error('❌ Error parsing quote_data:', parseError);
      }
    }
    
    // Test the branch lookup as well
    console.log('\n🏢 Testing branch lookup for this quote...');
    const filename = quote.filename || quote.quote_number;
    const parts = filename.split('-');
    if (parts.length >= 4) {
      const branchCode = parts[3];
      console.log(`Branch code from filename: ${branchCode}`);
      
      // This should resolve to "HDS De Deur" based on our previous testing
      console.log('Expected branch: HDS De Deur');
    }
    
  } catch (error) {
    console.error('❌ Error in testInvoiceAmounts:', error);
  }
}

testInvoiceAmounts();
