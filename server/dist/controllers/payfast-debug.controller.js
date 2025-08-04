"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.debugPayFastSignature = void 0;
const crypto_1 = __importDefault(require("crypto"));
// Debug endpoint to test PayFast signature generation
const debugPayFastSignature = async (req, res) => {
    try {
        console.log('=== PayFast Debug Signature Test ===');
        // Get environment variables
        const merchantId = process.env.PAYFAST_MERCHANT_ID || '10000100';
        const merchantKey = process.env.PAYFAST_MERCHANT_KEY || '46f0cd694581a';
        const passphrase = process.env.PAYFAST_PASSPHRASE || 'jt7NOE43FZPn';
        const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
        console.log('Environment Variables:');
        console.log('PAYFAST_MERCHANT_ID:', merchantId);
        console.log('PAYFAST_MERCHANT_KEY:', merchantKey);
        console.log('PAYFAST_PASSPHRASE:', passphrase);
        console.log('BASE_URL:', baseUrl);
        // Create minimal test data (only required fields)
        const testData = {
            merchant_id: merchantId,
            merchant_key: merchantKey,
            amount: '100.00',
            item_name: 'Test Item'
        };
        console.log('\nTest Data (minimal):');
        console.log(JSON.stringify(testData, null, 2));
        // Generate signature manually step by step
        const paramString = `merchant_id=${testData.merchant_id}&merchant_key=${testData.merchant_key}&amount=${testData.amount}&item_name=${testData.item_name}`;
        const stringWithPassphrase = `${paramString}&passphrase=${passphrase}`;
        console.log('\nSignature Generation:');
        console.log('Parameter string:', paramString);
        console.log('String with passphrase:', stringWithPassphrase);
        const signature = crypto_1.default.createHash('md5').update(stringWithPassphrase).digest('hex');
        console.log('Generated signature:', signature);
        // Test with more complete data
        const completeData = {
            merchant_id: merchantId,
            merchant_key: merchantKey,
            return_url: `${baseUrl}/api/payfast/success`,
            cancel_url: `${baseUrl}/api/payfast/cancel`,
            notify_url: `${baseUrl}/api/payfast/notify`,
            amount: '100.00',
            item_name: 'Test Item',
            item_description: 'Test Description',
            m_payment_id: 'TEST-123'
        };
        console.log('\nComplete Test Data:');
        console.log(JSON.stringify(completeData, null, 2));
        // Generate signature for complete data
        const completeParamString = Object.keys(completeData)
            .map(key => `${key}=${completeData[key]}`)
            .join('&');
        const completeStringWithPassphrase = `${completeParamString}&passphrase=${passphrase}`;
        console.log('\nComplete Signature Generation:');
        console.log('Parameter string:', completeParamString);
        console.log('String with passphrase:', completeStringWithPassphrase);
        const completeSignature = crypto_1.default.createHash('md5').update(completeStringWithPassphrase).digest('hex');
        console.log('Generated signature:', completeSignature);
        // Create test form HTML
        const testFormHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>PayFast Signature Debug</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .debug-section { margin: 20px 0; padding: 15px; border: 1px solid #ccc; }
            .signature { font-family: monospace; background: #f5f5f5; padding: 10px; }
            form { margin: 20px 0; }
            input[type="submit"] { background: #28a745; color: white; padding: 10px 20px; border: none; }
        </style>
    </head>
    <body>
        <h1>PayFast Signature Debug</h1>
        
        <div class="debug-section">
            <h3>Environment Variables</h3>
            <p><strong>Merchant ID:</strong> ${merchantId}</p>
            <p><strong>Merchant Key:</strong> ${merchantKey}</p>
            <p><strong>Passphrase:</strong> ${passphrase}</p>
            <p><strong>Base URL:</strong> ${baseUrl}</p>
        </div>
        
        <div class="debug-section">
            <h3>Minimal Test (Required Fields Only)</h3>
            <p><strong>Parameter String:</strong></p>
            <div class="signature">${paramString}</div>
            <p><strong>With Passphrase:</strong></p>
            <div class="signature">${stringWithPassphrase}</div>
            <p><strong>Generated Signature:</strong></p>
            <div class="signature">${signature}</div>
            
            <form action="https://sandbox.payfast.co.za/eng/process" method="post" target="_blank">
                <input type="hidden" name="merchant_id" value="${merchantId}">
                <input type="hidden" name="merchant_key" value="${merchantKey}">
                <input type="hidden" name="amount" value="100.00">
                <input type="hidden" name="item_name" value="Test Item">
                <input type="hidden" name="signature" value="${signature}">
                <input type="submit" value="Test Minimal Form">
            </form>
        </div>
        
        <div class="debug-section">
            <h3>Complete Test (All Fields)</h3>
            <p><strong>Parameter String:</strong></p>
            <div class="signature">${completeParamString}</div>
            <p><strong>With Passphrase:</strong></p>
            <div class="signature">${completeStringWithPassphrase}</div>
            <p><strong>Generated Signature:</strong></p>
            <div class="signature">${completeSignature}</div>
            
            <form action="https://sandbox.payfast.co.za/eng/process" method="post" target="_blank">
                <input type="hidden" name="merchant_id" value="${merchantId}">
                <input type="hidden" name="merchant_key" value="${merchantKey}">
                <input type="hidden" name="return_url" value="${baseUrl}/api/payfast/success">
                <input type="hidden" name="cancel_url" value="${baseUrl}/api/payfast/cancel">
                <input type="hidden" name="notify_url" value="${baseUrl}/api/payfast/notify">
                <input type="hidden" name="amount" value="100.00">
                <input type="hidden" name="item_name" value="Test Item">
                <input type="hidden" name="item_description" value="Test Description">
                <input type="hidden" name="m_payment_id" value="TEST-123">
                <input type="hidden" name="signature" value="${completeSignature}">
                <input type="submit" value="Test Complete Form">
            </form>
        </div>
        
        <div class="debug-section">
            <h3>PayFast Sandbox Test Credentials</h3>
            <p>These are the official PayFast sandbox credentials from their documentation:</p>
            <ul>
                <li><strong>Merchant ID:</strong> 10000100</li>
                <li><strong>Merchant Key:</strong> 46f0cd694581a</li>
                <li><strong>Passphrase:</strong> jt7NOE43FZPn</li>
                <li><strong>Sandbox URL:</strong> https://sandbox.payfast.co.za/eng/process</li>
            </ul>
        </div>
    </body>
    </html>`;
        res.setHeader('Content-Type', 'text/html');
        res.send(testFormHtml);
    }
    catch (error) {
        console.error('PayFast debug error:', error);
        res.status(500).json({ error: 'Debug test failed', details: error instanceof Error ? error.message : 'Unknown error' });
    }
};
exports.debugPayFastSignature = debugPayFastSignature;
