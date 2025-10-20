"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.testWithRealCredentials = exports.testPayFastSignature = void 0;
const crypto_1 = __importDefault(require("crypto"));
// Test PayFast signature generation with exact field order
const testPayFastSignature = () => {
    const testData = {
        merchant_id: '10000100',
        merchant_key: '46f0cd694581a',
        amount: '100.00',
        item_name: 'Test Item'
    };
    const passphrase = 'jt7NOE43FZPn';
    console.log('=== PayFast Signature Test ===');
    console.log('Test data:', testData);
    console.log('Passphrase:', passphrase);
    // PayFast field order (as per documentation)
    const fieldOrder = [
        'merchant_id', 'merchant_key', 'return_url', 'cancel_url', 'notify_url',
        'name_first', 'name_last', 'email_address', 'cell_number',
        'm_payment_id', 'amount', 'item_name', 'item_description',
        'custom_int1', 'custom_int2', 'custom_int3', 'custom_int4', 'custom_int5',
        'custom_str1', 'custom_str2', 'custom_str3', 'custom_str4', 'custom_str5',
        'email_confirmation', 'confirmation_address', 'payment_method'
    ];
    const paramPairs = [];
    // Add fields in the specified order - only include non-empty values
    fieldOrder.forEach(key => {
        if (testData[key] && testData[key] !== '' && testData[key] !== undefined) {
            const value = testData[key].toString().trim();
            paramPairs.push(`${key}=${value}`);
        }
    });
    // Create parameter string
    const paramString = paramPairs.join('&');
    // Add passphrase
    const stringToHash = `${paramString}&passphrase=${passphrase}`;
    console.log('Parameter string:', paramString);
    console.log('String to hash:', stringToHash);
    // Generate MD5 hash (lowercase)
    const signature = crypto_1.default.createHash('md5').update(stringToHash).digest('hex').toLowerCase();
    console.log('Generated signature:', signature);
    // Expected signature based on PayFast documentation
    const expectedSignature = crypto_1.default.createHash('md5')
        .update(`merchant_id=10000100&merchant_key=46f0cd694581a&amount=100.00&item_name=Test Item&passphrase=jt7NOE43FZPn`)
        .digest('hex')
        .toLowerCase();
    console.log('Expected signature:', expectedSignature);
    console.log('Match:', signature === expectedSignature);
    return {
        signature,
        expectedSignature,
        match: signature === expectedSignature,
        paramString
    };
};
exports.testPayFastSignature = testPayFastSignature;
// Test with actual PayFast credentials
const testWithRealCredentials = () => {
    return (0, exports.testPayFastSignature)();
};
exports.testWithRealCredentials = testWithRealCredentials;
