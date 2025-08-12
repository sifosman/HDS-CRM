"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const payfast_controller_1 = require("../controllers/payfast.controller");
const payfast_debug_controller_1 = require("../controllers/payfast-debug.controller");
const payfast_test_itn_controller_1 = require("../controllers/payfast-test-itn.controller");
const payfast_manual_itn_controller_1 = require("../controllers/payfast-manual-itn.controller");
// Import the enhanced PayFast success controller
const payfast_success_enhanced_controller_1 = __importDefault(require("../controllers/payfast-success-enhanced.controller"));
const router = express_1.default.Router();
// Middleware to capture raw body for PayFast notifications
const rawBodyMiddleware = (req, res, next) => {
    if (req.originalUrl.endsWith('/notify')) {
        // Capture raw body for signature validation
        let rawBody = '';
        req.on('data', (chunk) => {
            rawBody += chunk.toString();
        });
        req.on('end', () => {
            req.rawBody = rawBody;
            next();
        });
    }
    else {
        next();
    }
};
// Apply raw body middleware
router.use(rawBodyMiddleware);
// Generate payment form for a quote
router.get('/pay', payfast_controller_1.generatePaymentForm);
// Handle payment success return (both GET and POST)
router.get('/success', (req, res) => payfast_success_enhanced_controller_1.default.handlePaymentSuccess(req, res));
router.post('/success', (req, res) => payfast_success_enhanced_controller_1.default.handlePaymentSuccess(req, res));
// Handle payment cancellation return
router.get('/cancel', payfast_controller_1.handlePaymentCancel);
// Handle PayFast ITN (Instant Transaction Notification)
router.post('/notify', payfast_controller_1.handlePaymentNotification);
// Debug endpoint to test signature generation
router.get('/debug', payfast_debug_controller_1.debugPayFastSignature);
// Test endpoint to manually trigger ITN and email sending
router.get('/test-itn', payfast_test_itn_controller_1.testITN);
// Manual test endpoint to simulate PayFast ITN for real quotes
router.get('/simulate-itn', payfast_manual_itn_controller_1.simulatePayFastITN);
// Test endpoint for signature verification
router.get('/test-signature', (req, res) => {
    const testData = {
        merchant_id: '10000100',
        merchant_key: '46f0cd694581a',
        amount: '100.00',
        item_name: 'Test Item'
    };
    const passphrase = 'jt7NOE43FZPn';
    const crypto = require('crypto');
    // Generate signature with field order
    const fieldOrder = [
        'merchant_id', 'merchant_key', 'amount', 'item_name'
    ];
    const paramPairs = [];
    fieldOrder.forEach(key => {
        if (testData[key]) {
            paramPairs.push(`${key}=${testData[key]}`);
        }
    });
    const paramString = paramPairs.join('&');
    const stringToHash = `${paramString}&passphrase=${passphrase}`;
    const signature = crypto.createHash('md5').update(stringToHash).digest('hex').toLowerCase();
    res.json({
        testData,
        paramString,
        stringToHash,
        signature,
        expected: crypto.createHash('md5').update('merchant_id=10000100&merchant_key=46f0cd694581a&amount=100.00&item_name=Test Item&passphrase=jt7NOE43FZPn').digest('hex').toLowerCase()
    });
});
exports.default = router;
