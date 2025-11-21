"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const axios_1 = __importDefault(require("axios"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const supabase_service_1 = __importDefault(require("../services/supabase.service"));
const router = express_1.default.Router();
// Debug endpoint to test the n8n workflow and recipient value
router.post('/test-recipient', ((req, res) => {
    var _a, _b, _c;
    try {
        console.log('===== RECIPIENT DEBUG TEST =====');
        console.log('Request body:', JSON.stringify(req.body, null, 2));
        // Extract recipient value from various possible locations
        const directRecipient = (_a = req.body) === null || _a === void 0 ? void 0 : _a.recipient;
        const phoneNumber = (_b = req.body) === null || _b === void 0 ? void 0 : _b.phoneNumber;
        let recipientInCutlist;
        if ((_c = req.body) === null || _c === void 0 ? void 0 : _c.cutlist) {
            if (typeof req.body.cutlist === 'string') {
                try {
                    const parsed = JSON.parse(req.body.cutlist);
                    recipientInCutlist = parsed.phoneNumber;
                }
                catch (e) {
                    console.log('Failed to parse cutlist JSON:', e.message);
                }
            }
            else if (typeof req.body.cutlist === 'object') {
                recipientInCutlist = req.body.cutlist.phoneNumber;
            }
        }
        // Show all possible recipient values
        console.log('Recipient values found:');
        console.log('- req.body.recipient:', directRecipient);
        console.log('- req.body.phoneNumber:', phoneNumber);
        console.log('- From cutlist:', recipientInCutlist);
        // Return all possible values for comparison
        return res.status(200).json({
            success: true,
            message: 'Recipient debug test completed',
            recipientValues: {
                directRecipient,
                phoneNumber,
                recipientInCutlist,
                headers: req.headers
            },
            fullBody: req.body
        });
    }
    catch (error) {
        console.error('Error in recipient debug test:', error);
        return res.status(500).json({
            success: false,
            message: 'Error in recipient debug test',
            error: error.message
        });
    }
}));
// Debug endpoint to test Botsailor webhook with different recipient formats
router.post('/test-botsailor', ((req, res) => {
    (async () => {
        var _a, _b, _c;
        try {
            console.log('===== BOTSAILOR FORMAT TEST =====');
            const WEBHOOK_URL = 'https://botsailor.com/webhook/whatsapp-workflow/145613.241603.253062.1760952893';
            const recipient = ((_a = req.body) === null || _a === void 0 ? void 0 : _a.recipient) || ((_b = req.body) === null || _b === void 0 ? void 0 : _b.phoneNumber);
            if (!recipient) {
                return res.status(400).json({
                    success: false,
                    message: 'No recipient provided'
                });
            }
            console.log('Testing with recipient:', recipient);
            // Try various formats to see which one works
            const formats = [
                {
                    name: 'Standard recipient',
                    payload: { recipient: recipient, message: 'Test message from Freecut debug tool' }
                },
                {
                    name: 'phone_number field',
                    payload: { phone_number: recipient, message: 'Test message from Freecut debug tool' }
                },
                {
                    name: 'to field',
                    payload: { to: recipient, message: 'Test message from Freecut debug tool' }
                },
                {
                    name: 'phone field',
                    payload: { phone: recipient.replace('+', ''), message: 'Test message from Freecut debug tool' }
                }
            ];
            const results = [];
            for (const format of formats) {
                try {
                    console.log(`Testing format: ${format.name}`);
                    console.log('Payload:', JSON.stringify(format.payload, null, 2));
                    const response = await axios_1.default.post(WEBHOOK_URL, format.payload, {
                        headers: { 'Content-Type': 'application/json' },
                        timeout: 10000
                    });
                    console.log(`Format ${format.name} succeeded with status ${response.status}`);
                    console.log('Response:', response.data);
                    results.push({
                        format: format.name,
                        success: true,
                        status: response.status,
                        data: response.data
                    });
                }
                catch (error) {
                    console.error(`Format ${format.name} failed:`, error.message);
                    results.push({
                        format: format.name,
                        success: false,
                        error: error.message,
                        responseData: (_c = error.response) === null || _c === void 0 ? void 0 : _c.data
                    });
                }
            }
            return res.status(200).json({
                success: true,
                message: 'Botsailor format test completed',
                testRecipient: recipient,
                results: results
            });
        }
        catch (error) {
            console.error('Error in Botsailor format test:', error);
            return res.status(500).json({
                success: false,
                message: 'Error in Botsailor format test',
                error: error.message
            });
        }
    })();
}));
// Debug endpoint to test Supabase connection and cutlist creation
router.get('/test-supabase', ((req, res) => {
    (async () => {
        try {
            console.log('===== SUPABASE CONNECTION TEST =====');
            // Step 1: Test basic connection to Supabase
            const connectionResult = await supabase_service_1.default.checkConnection();
            if (!connectionResult) {
                return res.status(500).json({
                    success: false,
                    message: 'Supabase connection test failed',
                    error: 'Could not connect to Supabase'
                });
            }
            console.log('Basic connection test successful');
            // Step 2: Test material options query (existing functionality)
            const materialResult = await supabase_service_1.default.getMaterialOptions();
            // Step 3: Test cutlist table by creating a test cutlist
            const testId = `test-${new Date().getTime()}`;
            const testCutlistData = {
                id: testId,
                customerName: 'Test Customer',
                phoneNumber: '+27123456789',
                ocrText: 'Test OCR Text\n800 x 400',
                cutPieces: [
                    {
                        length: 800,
                        width: 400,
                        quantity: 1,
                        description: 'Test piece'
                    }
                ],
                unit: 'mm'
            };
            console.log('Attempting to save test cutlist with ID:', testId);
            const saveResult = await supabase_service_1.default.saveCutlist(testCutlistData);
            // Return all test results
            return res.status(200).json({
                success: true,
                message: 'Supabase tests completed',
                connectionTest: {
                    success: connectionResult,
                },
                materialOptionsTest: {
                    success: materialResult.success,
                    categoriesCount: materialResult.success ? materialResult.data.categories.length : 0,
                    error: !materialResult.success ? materialResult.error : null
                },
                cutlistSaveTest: {
                    success: saveResult.success,
                    testId: testId,
                    data: saveResult.success ? saveResult.data : null,
                    error: !saveResult.success ? saveResult.error : null
                },
                environment: {
                    supabaseUrlConfigured: Boolean(process.env.SUPABASE_URL),
                    supabaseKeyConfigured: Boolean(process.env.SUPABASE_ANON_KEY)
                }
            });
        }
        catch (error) {
            console.error('Error in Supabase test:', error);
            return res.status(500).json({
                success: false,
                message: 'Error in Supabase connection test',
                error: error.message || 'Unknown error'
            });
        }
    })();
}));
exports.default = router;
// Runtime verification endpoint to check which Botsailor webhook ID is present in compiled files
// Usage (browser): GET /api/debug/check-botsailor-url
router.get('/check-botsailor-url', ((req, res) => {
    try {
        const oldId = '145613.157394.183999.1748553417';
        const newId = '145613.241603.253062.1760952893';
        // When compiled, __dirname will be server/dist/routes. We want server/dist/controllers/*
        const distRoot = path_1.default.resolve(__dirname, '..');
        const candidates = [
            path_1.default.join(distRoot, 'controllers', 'webhook-direct.controller.js'),
            path_1.default.join(distRoot, 'controllers', 'botsailor.controller.js'),
            path_1.default.join(distRoot, 'controllers', 'n8n.controller.js'),
            path_1.default.join(distRoot, 'controllers', 'cutlist.controller.js'),
            path_1.default.join(distRoot, 'routes', 'debug.routes.js')
        ];
        const results = [];
        for (const file of candidates) {
            const exists = fs_1.default.existsSync(file);
            if (!exists) {
                results.push({ file, exists, hasOld: false, hasNew: false });
                continue;
            }
            let content = '';
            try {
                content = fs_1.default.readFileSync(file, 'utf8');
            }
            catch (_) {
                // ignore read errors
            }
            const hasOld = content.includes(oldId);
            const hasNew = content.includes(newId);
            results.push({ file, exists: true, hasOld, hasNew });
        }
        const anyOld = results.some(r => r.exists && r.hasOld);
        const anyNew = results.some(r => r.exists && r.hasNew);
        return res.status(200).json({
            success: true,
            message: 'Botsailor webhook ID scan completed',
            summary: {
                anyOld,
                anyNew
            },
            details: results,
            env: {
                dir: __dirname,
                nodeEnv: process.env.NODE_ENV || null
            }
        });
    }
    catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to scan for webhook IDs',
            error: (error === null || error === void 0 ? void 0 : error.message) || 'Unknown error'
        });
    }
}));
