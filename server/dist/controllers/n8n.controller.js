"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.n8nController = void 0;
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
// Botsailor webhook URL for sending cutting list links
const BOTSAILOR_WEBHOOK_URL = 'https://www.botsailor.com/webhook/whatsapp-workflow/145613.157394.183999.1748553417';
// Alternative URLs to try
const DIRECT_GET_URL = 'https://www.botsailor.com/webhook/whatsapp-workflow/145613.157394.183999.1748553417';
const FLOW_URL = 'https://www.botsailor.com/flow-webhook/145613.157394.183999.1748553417';
// Function to try multiple webhook methods
const tryWebhookMethods = async (phoneNumber, cutlistUrl, senderName, dimensionsCount, ocrText, originalRequestBody = {}) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    console.log('===== WEBHOOK METHODS DEBUGGING =====');
    console.log('phoneNumber received by tryWebhookMethods:', phoneNumber);
    const methods = [
        // Method 1: Standard JSON POST
        async () => {
            console.log('Trying method 1: Standard JSON POST...');
            console.log('Method 1 recipient value:', phoneNumber);
            // Preserve original values from the n8n workflow
            const response = await axios_1.default.post(BOTSAILOR_WEBHOOK_URL, {
                recipient: phoneNumber,
                customer_name: senderName || originalRequestBody.customer_name || originalRequestBody.name || 'Customer',
                cutlist_url: cutlistUrl,
                dimensions_count: dimensionsCount,
                project_name: originalRequestBody.project_name || 'Cutting List from WhatsApp'
            }, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000
            });
            return response;
        },
        // Method 2: Simple phone & message format
        async () => {
            console.log('Trying method 2: Simple phone & message format...');
            console.log('Method 2 phone_number value:', phoneNumber);
            const response = await axios_1.default.post(BOTSAILOR_WEBHOOK_URL, {
                phone_number: phoneNumber,
                message: `Your cutting list has been processed! View and edit it here: ${cutlistUrl}\n\nFound ${dimensionsCount} dimensions in your image.`
            }, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000
            });
            return response;
        },
        // Method 3: URL-encoded GET request
        async () => {
            console.log('Trying method 3: URL-encoded GET request...');
            console.log('Method 3 phone param value (will remove +):', phoneNumber);
            const params = new URLSearchParams({
                phone: phoneNumber.replace('+', ''),
                message: `Your cutting list has been processed! View and edit it here: ${cutlistUrl}. Found ${dimensionsCount} dimensions in your image.`
            });
            const response = await axios_1.default.get(`${DIRECT_GET_URL}?${params.toString()}`, {
                timeout: 10000
            });
            return response;
        },
        // Method 4: Flow webhook format
        async () => {
            console.log('Trying method 4: Flow webhook format...');
            console.log('Method 4 recipient value:', phoneNumber);
            const response = await axios_1.default.post(FLOW_URL, {
                recipient: phoneNumber,
                text: `Your cutting list has been processed! View and edit it here: ${cutlistUrl}\n\nFound ${dimensionsCount} dimensions in your image.`,
                ocr_data: ocrText
            }, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000
            });
            return response;
        }
    ];
    // Try each method in sequence until one works
    console.log('Beginning webhook method attempts with phone number:', phoneNumber);
    for (let i = 0; i < methods.length; i++) {
        try {
            const response = await methods[i]();
            console.log(`Method ${i + 1} succeeded with status ${response.status}`);
            console.log('Successful response data:', response.data);
            return { success: true, method: i + 1, response };
        }
        catch (error) {
            console.error(`Method ${i + 1} failed:`, error.message);
            if (error.response) {
                console.error(`Status: ${error.response.status}`, error.response.data);
            }
            // Log details about the error - especially helpful for recipient issues
            if (((_c = (_b = (_a = error.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.error) === null || _c === void 0 ? void 0 : _c.includes('recipient')) ||
                ((_f = (_e = (_d = error.response) === null || _d === void 0 ? void 0 : _d.data) === null || _e === void 0 ? void 0 : _e.error) === null || _f === void 0 ? void 0 : _f.includes('phone')) ||
                ((_g = error.message) === null || _g === void 0 ? void 0 : _g.includes('recipient')) ||
                ((_h = error.message) === null || _h === void 0 ? void 0 : _h.includes('phone'))) {
                console.error('POTENTIAL RECIPIENT/PHONE NUMBER ERROR DETECTED:', error.message);
                console.error('Error response data:', (_j = error.response) === null || _j === void 0 ? void 0 : _j.data);
            }
            // Continue to next method
        }
    }
    return { success: false, message: 'All webhook methods failed' };
};
// Process n8n data directly
const processN8nData = async (req, res) => {
    try {
        console.log('======= N8N DEBUGGING - START =======');
        console.log('TIMESTAMP:', new Date().toISOString());
        console.log('======= DIRECT N8N DATA =======');
        console.log('Request body:', JSON.stringify(req.body, null, 2));
        console.log('Request headers:', JSON.stringify(req.headers, null, 2));
        console.log('===============================');
        // PHONE NUMBER TRACING
        console.log('PHONE NUMBER DEBUGGING:');
        console.log('- req.body.phoneNumber:', req.body.phoneNumber);
        if (req.body.cutlist) {
            console.log('- cutlist property exists');
            if (typeof req.body.cutlist === 'string') {
                try {
                    const parsedCutlist = JSON.parse(req.body.cutlist);
                    console.log('- parsed cutlist.phoneNumber:', parsedCutlist.phoneNumber);
                }
                catch (e) {
                    console.log('- cutlist is not valid JSON');
                }
            }
            else if (typeof req.body.cutlist === 'object') {
                console.log('- cutlist is already an object');
                console.log('- cutlist.phoneNumber:', req.body.cutlist.phoneNumber);
            }
        }
        // Try to parse the data - the data might be nested in a cutlist property
        let ocrText, phoneNumber, senderName;
        // DEBUGGING: Log the raw data type
        console.log('cutlist property type:', typeof req.body.cutlist);
        console.log('cutlist value:', req.body.cutlist);
        if (req.body.cutlist) {
            try {
                // If cutlist is a JSON string, parse it
                console.log('Attempting to parse cutlist JSON...');
                const cutlistData = JSON.parse(req.body.cutlist);
                console.log('Successfully parsed cutlist JSON:', cutlistData);
                ocrText = cutlistData.ocrText;
                phoneNumber = cutlistData.phoneNumber;
                senderName = cutlistData.senderName;
                console.log('Extracted data from JSON:', { ocrText: (ocrText === null || ocrText === void 0 ? void 0 : ocrText.substring(0, 50)) + '...', phoneNumber, senderName });
            }
            catch (parseError) {
                console.error('Error parsing cutlist JSON:', parseError);
                // If parsing fails, assume cutlist is the OCR text directly
                console.log('Assuming cutlist is raw OCR text');
                ocrText = req.body.cutlist;
                phoneNumber = req.body.phoneNumber;
                senderName = req.body.senderName;
            }
        }
        else {
            // If data is not in cutlist property, look for it directly in the request body
            console.log('No cutlist property found, looking in root of request body');
            ocrText = req.body.ocrText;
            phoneNumber = req.body.phoneNumber;
            senderName = req.body.senderName;
        }
        // If we don't have OCR text, return an error
        if (!ocrText) {
            return res.status(400).json({
                success: false,
                message: 'No OCR text provided'
            });
        }
        // Format phone number - ensure it has correct format for WhatsApp
        console.log('PHONE NUMBER BEFORE FORMATTING:', phoneNumber);
        // Keep original phone number (very important!) - just ensure it's properly formatted
        const originalPhoneNumber = phoneNumber; // Store original for reference
        if (phoneNumber && !phoneNumber.startsWith('+')) {
            // Only add the + prefix if needed, don't replace the entire number
            phoneNumber = '+' + phoneNumber.replace(/[^0-9]/g, '');
            console.log('PHONE NUMBER FORMATTING (adding +):', originalPhoneNumber, '->', phoneNumber);
        }
        else if (phoneNumber === 'your_phone_number' || !phoneNumber) {
            // Only use default if it's a placeholder or missing
            const fallbackPhone = process.env.DEFAULT_TEST_PHONE || '+27123456789';
            console.log('PHONE NUMBER MISSING OR PLACEHOLDER - using fallback:', fallbackPhone);
            phoneNumber = fallbackPhone;
        }
        // Generate a unique ID for this cutlist (even though we're not saving it to DB)
        const uniqueId = Date.now().toString();
        // Generate the cutlist URL - This would be a demo URL since we're not saving to DB
        const baseUrl = process.env.BASE_URL || 'https://hds-sifosmans-projects.vercel.app';
        const cutlistUrl = `${baseUrl}/cutlist-demo?data=${encodeURIComponent(ocrText)}`;
        // Count approximate dimensions from OCR text (very basic approach)
        let dimensionsCount = 0;
        const lines = ocrText.split('\n');
        for (const line of lines) {
            // Look for patterns like "1000X 460 = 1" or "450x140=14"
            if (/\d+\s*[xX]\s*\d+\s*=?\s*\d*/.test(line)) {
                dimensionsCount++;
            }
        }
        console.log(`Found approximately ${dimensionsCount} dimensions in OCR text`);
        // IMPORTANT: We're keeping the original phone number and just ensuring it's properly formatted for WhatsApp
        // We are NOT replacing it with defaults unless absolutely necessary
        console.log('PHONE NUMBER BEFORE FINAL FORMATTING:', phoneNumber);
        if (phoneNumber) {
            if (phoneNumber === 'your_phone_number') {
                // Only replace if it's explicitly the placeholder value
                const fallbackPhone = process.env.DEFAULT_TEST_PHONE || '+27822222222';
                console.log('DETECTED PLACEHOLDER VALUE - using fallback:', fallbackPhone);
                phoneNumber = fallbackPhone;
            }
            else {
                // Just clean the formatting, but keep the actual number
                const originalPhone = phoneNumber;
                // Only remove invalid characters, but keep the core number intact
                phoneNumber = phoneNumber.replace(/[^0-9+]/g, '');
                if (!phoneNumber.startsWith('+')) {
                    phoneNumber = '+' + phoneNumber;
                }
                console.log('PHONE NUMBER FORMATTING:', originalPhone, '->', phoneNumber);
            }
        }
        else {
            // Only if absolutely no phone number was provided, use a fallback
            const fallbackPhone = process.env.DEFAULT_TEST_PHONE || '+27822222222';
            console.log('NO PHONE NUMBER PROVIDED - using fallback:', fallbackPhone);
            phoneNumber = fallbackPhone;
        }
        console.log('FINAL RECIPIENT VALUE:', phoneNumber);
        // Prepare the data to send to Botsailor webhook
        // IMPORTANT: Preserve the original values from n8n workflow
        const webhookData = {
            recipient: phoneNumber,
            customer_name: senderName || req.body.customer_name || req.body.name || 'Customer', // Try multiple possible fields before using default
            cutlist_url: cutlistUrl,
            dimensions_count: dimensionsCount,
            project_name: req.body.project_name || 'Cutting List from WhatsApp', // Preserve project name if provided
            ocr_text: ocrText // Pass the OCR text to the webhook as well
        };
        console.log('CUSTOMER NAME BEING SENT:', webhookData.customer_name);
        console.log('PROJECT NAME BEING SENT:', webhookData.project_name);
        console.log('Sending data to Botsailor webhook URL:', BOTSAILOR_WEBHOOK_URL);
        console.log('Webhook payload:', JSON.stringify(webhookData, null, 2));
        console.log('FINAL RECIPIENT VALUE BEING SENT:', webhookData.recipient);
        // Try all webhook methods to ensure at least one works
        console.log('Starting webhook communication attempts...');
        console.log('======= N8N DEBUGGING - END =======');
        // Pass the original request body to preserve values
        const webhookResult = await tryWebhookMethods(phoneNumber, cutlistUrl, senderName || 'Customer', dimensionsCount, ocrText, req.body);
        if (webhookResult === null || webhookResult === void 0 ? void 0 : webhookResult.success) {
            console.log(`Successfully sent WhatsApp message using method ${webhookResult === null || webhookResult === void 0 ? void 0 : webhookResult.method}`);
        }
        else {
            console.log('All webhook methods failed to reach Botsailor');
        }
        return res.status(200).json({
            success: true,
            message: 'Cutlist data processed and sent to WhatsApp successfully',
            data: {
                phoneNumber: phoneNumber,
                cutlistUrl: cutlistUrl,
                dimensionsCount: dimensionsCount,
                webhookSuccess: (webhookResult === null || webhookResult === void 0 ? void 0 : webhookResult.success) || false,
                webhookMethod: (webhookResult === null || webhookResult === void 0 ? void 0 : webhookResult.method) || 'none'
            }
        });
    }
    catch (error) {
        console.error('Error processing n8n data:', error);
        return res.status(500).json({
            success: false,
            message: 'Error processing n8n data',
            error: error.message
        });
    }
};
exports.n8nController = {
    processN8nData
};
