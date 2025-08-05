#!/usr/bin/env node

/**
 * Simple test runner for invoice PDF functionality
 * Tests the complete flow from quote to invoice PDF
 */

const path = require('path');
const { execSync } = require('child_process');

// Simple test configuration
const TEST_CONFIG = {
  quoteNumber: 'Q-20250805-TEST-1234',
  customerName: 'Test Customer',
  customerEmail: 'test@example.com',
  projectName: 'Test Project',
  totalAmount: 1250.50,
  branchName: 'HDS Products'
};

// Test functions
async function runSimpleTest() {
  console.log('🚀 Starting Invoice PDF Test\n');
  
  try {
    // Test 1: Check if services are available
    console.log('1️⃣ Checking service availability...');
    await checkServiceAvailability();
    
    // Test 2: Test quote creation
    console.log('2️⃣ Testing quote creation...');
    await testQuoteCreation();
    
    // Test 3: Test PDF generation
    console.log('3️⃣ Testing PDF generation...');
    await testPdfGeneration();
    
    // Test 4: Test URL accessibility
    console.log('4️⃣ Testing URL accessibility...');
    await testUrlAccessibility();
    
    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n💡 Troubleshooting:');
    console.log('   - Check if Supabase is running');
    console.log('   - Verify storage bucket "invoices" exists');
    console.log('   - Check environment variables');
    console.log('   - Ensure PDF generation service is available');
  }
}

async function checkServiceAvailability() {
  try {
    const SupabaseService = require('../services/supabase.service.js');
    console.log('✅ SupabaseService is available');
    
    // Test connection
    const { data, error } = await SupabaseService.supabase
      .from('quotes')
      .select('count');
    
    if (error) {
      throw new Error(`Supabase connection failed: ${error.message}`);
    }
    
    console.log('✅ Supabase connection successful');
    
  } catch (error) {
    throw new Error(`Service check failed: ${error.message}`);
  }
}

async function testQuoteCreation() {
  try {
    const SupabaseService = require('../services/supabase.service.js');
    
    const quoteData = {
      quote_number: TEST_CONFIG.quoteNumber,
      customer_name: TEST_CONFIG.customerName,
      customer_email: TEST_CONFIG.customerEmail,
      customer_phone: '0821234567',
      project_name: TEST_CONFIG.projectName,
      items: [
        {
          description: 'White Melamine Shelving',
          quantity: 2,
          price: 250.25,
          total: 500.50
        },
        {
          description: 'Installation Service',
          quantity: 1,
          price: 750.00,
          total: 750.00
        }
      ],
      subtotal: 1250.50,
      tax: 0,
      total: TEST_CONFIG.totalAmount,
      branch_name: TEST_CONFIG.branchName,
      status: 'pending'
    };

    const result = await SupabaseService.createQuote(quoteData);
    
    if (result.success) {
      console.log('✅ Quote created successfully');
      console.log('📋 Quote ID:', result.data.quoteId);
    } else {
      throw new Error(`Quote creation failed: ${result.error}`);
    }
    
  } catch (error) {
    throw new Error(`Quote creation test failed: ${error.message}`);
  }
}

async function testPdfGeneration() {
  try {
    const SupabaseService = require('../services/supabase.service.js');
    
    const paymentData = {
      method: 'PayFast',
      reference: `TEST-${Date.now()}`,
      date: new Date().toISOString(),
      amount: TEST_CONFIG.totalAmount
    };

    const result = await SupabaseService.createInvoiceWithPdf(
      TEST_CONFIG.quoteNumber,
      paymentData
    );

    if (result.success) {
      console.log('✅ Invoice created with PDF');
      console.log('📄 Invoice Number:', result.data.invoiceNumber);
      console.log('🔗 PDF URL:', result.data.pdfUrl);
      
      // Store for URL test
      global.testPdfUrl = result.data.pdfUrl;
      global.testInvoiceNumber = result.data.invoiceNumber;
      
    } else {
      throw new Error(`PDF generation failed: ${result.error}`);
    }
    
  } catch (error) {
    throw new Error(`PDF generation test failed: ${error.message}`);
  }
}

async function testUrlAccessibility() {
  try {
    if (!global.testPdfUrl) {
      throw new Error('No PDF URL to test');
    }

    const https = require('https');
    
    return new Promise((resolve, reject) => {
      const url = new URL(global.testPdfUrl);
      
      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'HEAD'
      };

      const req = https.request(options, (res) => {
        if (res.statusCode === 200) {
          console.log('✅ PDF URL is accessible');
          resolve();
        } else {
          reject(new Error(`PDF URL returned status: ${res.statusCode}`));
        }
      });

      req.on('error', (error) => {
        reject(new Error(`URL accessibility test failed: ${error.message}`));
      });

      req.end();
    });
    
  } catch (error) {
    throw new Error(`URL accessibility test failed: ${error.message}`);
  }
}

// Quick test function
function quickTest() {
  console.log('🚀 Quick Invoice PDF Test\n');
  
  // Check environment
  console.log('🔍 Environment Check:');
  console.log('   NODE_ENV:', process.env.NODE_ENV || 'development');
  console.log('   PORT:', process.env.PORT || 5000);
  console.log('   SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ Set' : '❌ Missing');
  console.log('   SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing');
  
  // Check if services exist
  try {
    require('../services/supabase.service.js');
    console.log('   SupabaseService: ✅ Available');
  } catch (e) {
    console.log('   SupabaseService: ❌ Not found');
  }
  
  try {
    require('../services/optimizer.service.js');
    console.log('   OptimizerService: ✅ Available');
  } catch (e) {
    console.log('   OptimizerService: ❌ Not found');
  }
  
  console.log('\n📋 To run full test:');
  console.log('   node run-invoice-pdf-test.js');
  console.log('   or');
  console.log('   npm run test:invoice-pdf');
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--quick') || args.includes('-q')) {
    quickTest();
  } else {
    runSimpleTest();
  }
}

// Export for use in other scripts
module.exports = {
  runSimpleTest,
  quickTest,
  TEST_CONFIG
};
