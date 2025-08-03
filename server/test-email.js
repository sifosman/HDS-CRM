// Simple test script for email functionality
const axios = require('axios');

const testEmail = async () => {
  try {
    console.log('🚀 Testing email functionality with sifosman@gmail.com...');
    
    // Test 1: Quick email test
    console.log('📧 Sending quick test email...');
    const quickTest = await axios.post('http://localhost:3000/api/email-hardcoded/quick-test');
    console.log('✅ Quick test result:', quickTest.data);
    
    // Test 2: Detailed test with parameters
    console.log('📋 Sending detailed test email...');
    const detailedTest = await axios.post('http://localhost:3000/api/email-hardcoded/test-payment-email-hardcoded', {
      quoteNumber: 'TEST-12345',
      amount: 250.50,
      invoicePath: './test-invoice.pdf'
    });
    console.log('✅ Detailed test result:', detailedTest.data);
    
    console.log('🎉 All tests completed! Check sifosman@gmail.com for emails.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
};

// Run test if called directly
if (require.main === module) {
  testEmail();
}

module.exports = { testEmail };
