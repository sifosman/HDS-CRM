const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugInvoiceAmounts() {
  console.log('💰 Debugging invoice amounts for Q-20250807-6192-HDSDEDEU...');
  
  try {
    // Fetch the quote data
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
    console.log('Total:', quote.total);
    console.log('Customer Name:', quote.customer_name);
    
    // Parse and examine quote_data for amounts
    if (quote.quote_data) {
      try {
        const parsedQuoteData = JSON.parse(quote.quote_data);
        console.log('\n💰 Quote data structure:');
        console.log('Keys in quote_data:', Object.keys(parsedQuoteData));
        
        // Check items
        if (parsedQuoteData.items) {
          console.log('\n📦 Items in quote:');
          parsedQuoteData.items.forEach((item, index) => {
            console.log(`${index + 1}. ${item.description}`);
            console.log(`   Quantity: ${item.quantity}`);
            console.log(`   Unit Price: R${item.unitPrice}`);
            console.log(`   Total: R${item.total}`);
          });
        }
        
        // Check totals
        if (parsedQuoteData.totals) {
          console.log('\n💰 Totals in quote:');
          console.log('Subtotal:', parsedQuoteData.totals.subtotal);
          console.log('Tax:', parsedQuoteData.totals.tax);
          console.log('Final Total:', parsedQuoteData.totals.finalTotal);
        }
        
        // Look for sections data (used in invoice generation)
        if (parsedQuoteData.sections) {
          console.log('\n📊 Sections data found:');
          parsedQuoteData.sections.forEach((section, index) => {
            console.log(`Section ${index + 1}:`, {
              description: section.description,
              pricePerBoard: section.pricePerBoard,
              boardsNeeded: section.boardsNeeded,
              sectionTotal: section.sectionTotal
            });
          });
        } else {
          console.log('\n⚠️ No sections data found in quote_data');
        }
        
        // Show full structure (truncated)
        console.log('\n📊 Full quote_data (first 800 chars):');
        console.log(JSON.stringify(parsedQuoteData, null, 2).substring(0, 800) + '...');
        
      } catch (parseError) {
        console.error('❌ Error parsing quote_data:', parseError);
      }
    }
    
    // Also check if there's an associated invoice
    console.log('\n🧾 Checking for associated invoice...');
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*')
      .eq('quote_number', 'Q-20250807-6192-HDSDEDEU')
      .single();
    
    if (invoiceError) {
      console.log('⚠️ No invoice found or error:', invoiceError.message);
    } else {
      console.log('📄 Invoice found:');
      console.log('Invoice Number:', invoice.invoice_number);
      console.log('Total Amount:', invoice.total_amount);
      console.log('Status:', invoice.status);
    }
    
  } catch (error) {
    console.error('❌ Error in debugInvoiceAmounts:', error);
  }
}

debugInvoiceAmounts();
