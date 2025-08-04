"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.botsailorController = void 0;
const botsailorService = __importStar(require("../services/botsailor.service"));
const ocrService = __importStar(require("../services/ocr-disabled.service"));
const axios_1 = __importDefault(require("axios"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const https_1 = __importDefault(require("https"));
const cutlist_model_1 = __importDefault(require("../models/cutlist.model"));
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
/**
 * Botsailor Controller
 * Handles interactions with the Botsailor WhatsApp API
 */
// Botsailor webhook URL for sending cutting list links
const BOTSAILOR_WEBHOOK_URL = 'https://www.botsailor.com/webhook/whatsapp-workflow/145613.157394.183999.1748553417';
exports.botsailorController = {
    /**
     * Check connection status with Botsailor
     */
    async getConnectionStatus(req, res) {
        try {
            const connectionStatus = await botsailorService.checkConnectionStatus();
            res.status(200).json({
                success: true,
                status: connectionStatus
            });
        }
        catch (error) {
            console.error('Error checking connection with Botsailor:', error);
            res.status(500).json({
                success: false,
                message: 'Error checking connection with Botsailor',
                error: error.message
            });
        }
    },
    /**
     * Process a WhatsApp image asynchronously to avoid Vercel timeout
     */
    processWhatsAppImageAsync: async (image_url, user_id, phone_number, sender_name) => {
        var _a, _b, _c, _d, _e, _f, _g;
        try {
            console.log('[DEBUG FLOW] Starting processWhatsAppImageAsync');
            // Use system tmp directory for serverless environments
            const uploadDir = os_1.default.tmpdir();
            console.log('Using temporary directory for uploads:', uploadDir);
            // Download the image
            console.log(`Downloading image from: ${image_url}`);
            const timestamp = Date.now();
            const randomSuffix = Math.floor(Math.random() * 10000);
            const imagePath = path_1.default.join(uploadDir, `whatsapp-${user_id}-${timestamp}-${randomSuffix}.jpg`);
            // Enhanced debugging for Botsailor image URLs
            console.log('Attempting to download image from Botsailor URL:', image_url);
            console.log('URL format check:', {
                protocol: image_url.startsWith('https://') ? 'https' : (image_url.startsWith('http://') ? 'http' : 'unknown'),
                containsWasabi: image_url.includes('wasabi') || image_url.includes('wasabisys'),
                containsS3: image_url.includes('bot-data.s3'),
                urlLength: image_url.length
            });
            // Simple direct download using native https module
            console.log('Attempting direct download using native https module...');
            try {
                // Create a writer stream to save the image
                const writer = fs_1.default.createWriteStream(imagePath);
                // Download the image using native https
                await new Promise((resolve, reject) => {
                    const request = https_1.default.get(image_url, {
                        timeout: 30000,
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36',
                            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                            'Accept-Language': 'en-US,en;q=0.9',
                            'Connection': 'keep-alive',
                            'Referer': 'https://hds-sifosmans-projects.vercel.app/'
                        },
                        rejectUnauthorized: false // For debugging only
                    }, (response) => {
                        console.log('Download response status code:', response.statusCode);
                        console.log('Download response headers:', JSON.stringify(response.headers));
                        if (response.statusCode !== 200) {
                            reject(new Error(`Failed to download image: HTTP status ${response.statusCode}`));
                            return;
                        }
                        response.pipe(writer);
                        writer.on('finish', () => {
                            console.log('Image download completed and file written successfully');
                            writer.close();
                            resolve();
                        });
                        writer.on('error', (err) => {
                            console.error('Error writing downloaded image to file:', err);
                            writer.close();
                            fs_1.default.unlink(imagePath, () => { }); // Attempt to clean up the file
                            reject(err);
                        });
                    });
                    request.on('error', (err) => {
                        console.error('Error during https request:', err);
                        writer.close();
                        fs_1.default.unlink(imagePath, () => { }); // Attempt to clean up the file
                        reject(err);
                    });
                    request.on('timeout', () => {
                        console.error('Request timed out');
                        request.destroy();
                        writer.close();
                        fs_1.default.unlink(imagePath, () => { }); // Attempt to clean up the file
                        reject(new Error('Request timed out'));
                    });
                    // End the request
                    request.end();
                });
                console.log('Direct download method succeeded');
            }
            catch (downloadError) {
                console.error('Error downloading image:', downloadError);
                throw new Error(`Failed to download image: ${downloadError instanceof Error ? downloadError.message : String(downloadError)}`);
            }
            console.log(`Image downloaded and saved to: ${imagePath}`);
            // Process the image with OCR
            console.log('Processing image with OCR...');
            const extractedData = await ocrService.processImageWithOCR(imagePath);
            console.log('OCR processing complete:', JSON.stringify(extractedData));
            // Save the cutting list data to the database
            const customerName = sender_name || 'Customer';
            const projectName = 'Cutting List Project';
            const newCutlist = new cutlist_model_1.default({
                rawText: extractedData.rawText || '',
                dimensions: extractedData.dimensions || [],
                unit: extractedData.unit || 'mm',
                customerName: customerName,
                projectName: projectName,
                phoneNumber: phone_number || user_id
            });
            const savedCutlist = await newCutlist.save();
            console.log('Cutting list saved to database with ID:', savedCutlist._id);
            // Generate a link to the cutting list viewer
            const baseUrl = process.env.BASE_URL || 'https://hds-sifosmans-projects.vercel.app';
            const cutlistUrl = `${baseUrl}/api/cutlist/view/${savedCutlist._id}`;
            // Get the number of dimensions found
            const dimensionsCount = ((_a = extractedData.dimensions) === null || _a === void 0 ? void 0 : _a.length) || 0;
            // Format a response message
            let responseMessage = `✅ *Your cutting list has been processed!*\n\n`;
            if (dimensionsCount > 0) {
                responseMessage += `📏 Found *${dimensionsCount} dimensions* in your image.\n\n`;
                // Add the first 5 dimensions to the message
                responseMessage += `*Dimensions (${extractedData.unit}):*\n`;
                extractedData.dimensions.slice(0, 5).forEach((dim, index) => {
                    responseMessage += `${index + 1}. ${dim.width} x ${dim.length}`;
                    if (dim.quantity > 1) {
                        responseMessage += ` (${dim.quantity}pcs)`;
                    }
                    responseMessage += '\n';
                });
                if (dimensionsCount > 5) {
                    responseMessage += `... and ${dimensionsCount - 5} more dimensions.\n`;
                }
            }
            else {
                responseMessage += `⚠️ No dimensions were found in your image. The quality might be too low or the format is not recognized.\n`;
            }
            // Add link to view the full cutting list
            responseMessage += `\n🔗 *View your complete cutting list here:*\n${cutlistUrl}\n\n`;
            responseMessage += `You can edit the dimensions and download the cutting list from this link.\n\n`;
            responseMessage += `💡 *Tip:* Save this link for future reference. You can always come back to view or edit your cutting list.`;
            // Try to send a WhatsApp message back to the user via Botsailor API
            try {
                // Check if we have the required environment variables
                const apiKey = process.env.BOTSAILOR_API_KEY;
                const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
                console.log('WhatsApp messaging configuration:', {
                    apiKeyPresent: !!apiKey,
                    phoneNumberIdPresent: !!phoneNumberId,
                    recipientPhonePresent: !!phone_number,
                    apiKeyPart: apiKey ? apiKey.substring(0, 4) + '...' : 'missing',
                    phoneNumberId: phoneNumberId || 'missing',
                    recipientPhone: phone_number || 'missing'
                });
                // Format the phone number - ensure it includes country code and no special characters
                if (phone_number && !phone_number.startsWith('+')) {
                    if (!phone_number.startsWith('1') && !phone_number.startsWith('61') && !phone_number.startsWith('27')) {
                        // Assuming US/Canada (+1) as default if no country code
                        phone_number = '1' + phone_number.replace(/[^0-9]/g, '');
                        console.log('Formatted phone number with US country code:', phone_number);
                    }
                    else {
                        // Just remove any non-numeric characters
                        phone_number = phone_number.replace(/[^0-9]/g, '');
                        console.log('Cleaned phone number format:', phone_number);
                    }
                }
                if (apiKey && phoneNumberId && phone_number) {
                    console.log(`Sending WhatsApp message to ${phone_number} via Botsailor API`);
                    console.log('Message content preview:', responseMessage.substring(0, 100) + '...');
                    // Construct the API request to Botsailor
                    const messagePayload = {
                        messaging_product: 'whatsapp',
                        recipient_type: 'individual',
                        to: phone_number,
                        type: 'text',
                        text: { body: responseMessage },
                        preview_url: true // Enable link preview
                    };
                    console.log('Message payload:', JSON.stringify(messagePayload, null, 2));
                    // Determine the correct Botsailor API endpoint
                    const apiUrl = process.env.BOTSAILOR_API_URL || 'https://api.botsailor.com/v1';
                    const botsailorEndpoint = `${apiUrl}/whatsapp/${phoneNumberId}/messages`;
                    console.log(`Sending message to Botsailor API endpoint: ${botsailorEndpoint}`);
                    // Send the message via Botsailor API
                    try {
                        const response = await axios_1.default.post(botsailorEndpoint, messagePayload, {
                            headers: {
                                'Authorization': `Bearer ${apiKey}`,
                                'Content-Type': 'application/json'
                            },
                            timeout: 15000 // 15 second timeout
                        });
                        console.log('Botsailor API response details:', {
                            status: response.status,
                            statusText: response.statusText,
                            data: response.data,
                            headers: response.headers
                        });
                        console.log('WhatsApp message sent successfully');
                    }
                    catch (apiError) {
                        console.error('Error in Botsailor API call:', {
                            message: apiError.message,
                            status: (_b = apiError.response) === null || _b === void 0 ? void 0 : _b.status,
                            statusText: (_c = apiError.response) === null || _c === void 0 ? void 0 : _c.statusText,
                            responseData: (_d = apiError.response) === null || _d === void 0 ? void 0 : _d.data,
                            requestConfig: {
                                url: (_e = apiError.config) === null || _e === void 0 ? void 0 : _e.url,
                                method: (_f = apiError.config) === null || _f === void 0 ? void 0 : _f.method,
                                headers: (_g = apiError.config) === null || _g === void 0 ? void 0 : _g.headers
                            }
                        });
                    }
                }
                else {
                    console.log('Missing required configuration for WhatsApp messaging:');
                    if (!apiKey)
                        console.log('- Missing BOTSAILOR_API_KEY');
                    if (!phoneNumberId)
                        console.log('- Missing WHATSAPP_PHONE_NUMBER_ID');
                    if (!phone_number)
                        console.log('- Missing recipient phone number');
                }
            }
            catch (sendError) {
                console.error('Error in WhatsApp message preparation:', sendError);
            }
        }
        catch (error) {
            console.error('Error in async image processing:', error);
        }
    },
    /**
     * Send cutting list link to a WhatsApp number via Botsailor webhook
     */
    async sendCutlistLink(req, res) {
        var _a;
        try {
            const { cutlistId, phoneNumber, customerName } = req.body;
            if (!cutlistId || !phoneNumber) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required parameters: cutlistId or phoneNumber'
                });
            }
            // Validate cutlistId format
            if (!mongoose_1.default.Types.ObjectId.isValid(cutlistId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid cutlist ID format'
                });
            }
            // Get the cutlist from the database
            const cutlist = await cutlist_model_1.default.findById(cutlistId);
            if (!cutlist) {
                return res.status(404).json({
                    success: false,
                    message: 'Cutlist not found'
                });
            }
            // Format phone number - ensure it has correct format for WhatsApp
            let formattedPhone = phoneNumber.replace(/[^0-9+]/g, '');
            if (!formattedPhone.startsWith('+')) {
                // Assume international format needed for WhatsApp
                formattedPhone = '+' + formattedPhone;
            }
            // Generate the cutlist URL
            const baseUrl = process.env.BASE_URL || 'https://hds-sifosmans-projects.vercel.app';
            const cutlistUrl = `${baseUrl}/cutlist-edit/${cutlistId}`;
            // Prepare the data to send to Botsailor webhook
            const webhookData = {
                recipient: formattedPhone,
                customer_name: customerName || cutlist.customerName || 'Customer',
                cutlist_url: cutlistUrl,
                dimensions_count: ((_a = cutlist.dimensions) === null || _a === void 0 ? void 0 : _a.length) || 0,
                project_name: cutlist.projectName || 'Cutting List Project'
            };
            console.log('Sending data to Botsailor webhook:', webhookData);
            // Send the data to the Botsailor webhook
            const response = await axios_1.default.post(BOTSAILOR_WEBHOOK_URL, webhookData, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 10000 // 10 second timeout
            });
            console.log('Botsailor webhook response:', response.data);
            return res.status(200).json({
                success: true,
                message: 'Cutlist link sent to WhatsApp successfully',
                data: {
                    phoneNumber: formattedPhone,
                    cutlistUrl: cutlistUrl
                }
            });
        }
        catch (error) {
            console.error('Error sending cutlist link to WhatsApp:', error);
            return res.status(500).json({
                success: false,
                message: 'Error sending cutlist link to WhatsApp',
                error: error.message
            });
        }
    },
    /**
     * Receive webhook from WhatsApp
     */
    async receiveWhatsAppWebhook(req, res) {
        console.log('======= WEBHOOK DEBUG =======');
        console.log('Received WhatsApp webhook from Botsailor');
        console.log('Request headers:', JSON.stringify(req.headers));
        console.log('Request body:', JSON.stringify(req.body));
        console.log('Request method:', req.method);
        console.log('Request URL:', req.url);
        // Log the entire webhook structure in more detail for debugging
        console.log('DETAILED WEBHOOK PAYLOAD:');
        try {
            console.log(JSON.stringify(req.body, null, 2));
        }
        catch (e) {
            console.log('Could not stringify request body:', e);
        }
        console.log('============================');
        // Handle CORS preflight
        if (req.method === 'OPTIONS') {
            res.status(200).end();
            return;
        }
        // Immediately send a 200 response to acknowledge receipt of the webhook
        // This ensures Botsailor doesn't time out waiting for a response
        res.status(200).json({
            status: 'success',
            message: 'Webhook received, processing request'
        });
        // Process the webhook in the background without blocking the response
        (async () => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
            try {
                // Extract all possible fields for debugging
                console.log('Full webhook properties:');
                for (const key of Object.keys(req.body)) {
                    console.log(`- ${key}:`, typeof req.body[key] === 'object' ? JSON.stringify(req.body[key]) : req.body[key]);
                }
                // Extract image URL and phone number from webhook payload
                let user_id = '';
                let phone_number = '';
                let sender_name = '';
                let image_url = '';
                let whatsapp_id = '';
                // Try to extract Botsailor conversation ID or other identifier
                if (req.body.conversation_id)
                    whatsapp_id = req.body.conversation_id;
                if (req.body.whatsapp_id)
                    whatsapp_id = req.body.whatsapp_id;
                if (req.body.chat_id)
                    whatsapp_id = req.body.chat_id;
                if (req.body.id)
                    whatsapp_id = req.body.id;
                console.log('WhatsApp conversation ID (if found):', whatsapp_id);
                // Check for user_input_data array in webhook payload
                if (req.body.user_input_data && Array.isArray(req.body.user_input_data)) {
                    console.log('Found user_input_data array in webhook payload');
                    console.log('user_input_data content:', JSON.stringify(req.body.user_input_data));
                    // Look for question/answer pair with an image URL
                    for (const item of req.body.user_input_data) {
                        if (item.question === 'Do you have an image?' && item.answer &&
                            (item.answer.startsWith('http://') || item.answer.startsWith('https://'))) {
                            image_url = item.answer;
                            console.log('Found image URL in user_input_data question/answer:', image_url);
                            break;
                        }
                    }
                }
                // Try to extract sender information
                if (req.body.user_id) {
                    user_id = req.body.user_id;
                }
                else if (req.body.from) {
                    user_id = req.body.from;
                }
                else {
                    // Generate a unique ID if none provided
                    user_id = `user-${Date.now()}`;
                }
                // Try multiple possible locations for phone number
                if (req.body.phone_number) {
                    phone_number = req.body.phone_number;
                }
                else if ((_a = req.body.sender) === null || _a === void 0 ? void 0 : _a.phone_number) {
                    phone_number = req.body.sender.phone_number;
                }
                else if (req.body.from) {
                    // The 'from' field often contains the phone number in WhatsApp APIs
                    phone_number = req.body.from;
                }
                else if ((_b = req.body.customer) === null || _b === void 0 ? void 0 : _b.waId) {
                    // Sometimes it's in the customer object
                    phone_number = req.body.customer.waId;
                }
                else if (req.body.messages && Array.isArray(req.body.messages) && req.body.messages.length > 0) {
                    // Meta/WhatsApp format often has a messages array with from property
                    phone_number = req.body.messages[0].from || '';
                }
                else {
                    // Use a default/fallback phone number if none provided
                    phone_number = '12025550108';
                    console.log('Using default phone number:', phone_number);
                }
                // Clean up phone number format if needed
                if (phone_number && !phone_number.startsWith('+')) {
                    if (!phone_number.startsWith('1') && !phone_number.startsWith('61') && !phone_number.startsWith('27')) {
                        // Assuming US/Canada (+1) as default if no country code
                        phone_number = '1' + phone_number.replace(/[^0-9]/g, '');
                    }
                    else {
                        // Just remove any non-numeric characters
                        phone_number = phone_number.replace(/[^0-9]/g, '');
                    }
                }
                console.log('Extracted phone number:', phone_number);
                // Try to get sender name
                if (req.body.sender_name) {
                    sender_name = req.body.sender_name;
                }
                else if ((_c = req.body.sender) === null || _c === void 0 ? void 0 : _c.name) {
                    sender_name = req.body.sender.name;
                }
                else if ((_d = req.body.customer) === null || _d === void 0 ? void 0 : _d.name) {
                    sender_name = req.body.customer.name;
                }
                else {
                    sender_name = 'WhatsApp User';
                }
                // Log the extracted data
                const extractedData = {
                    user_id,
                    phone_number,
                    sender_name,
                    whatsapp_id,
                    image_url: image_url.length > 50 ? image_url.substring(0, 50) + '...' : image_url
                };
                console.log('Extracted data from webhook:', extractedData);
                // Since we're having issues with direct image download from Wasabi S3,
                // let's send a response message to the user with a web link as a temporary workaround
                try {
                    // Check if we have the required environment variables for WhatsApp messaging
                    const apiKey = process.env.BOTSAILOR_API_KEY;
                    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
                    if (apiKey && phoneNumberId && phone_number) {
                        console.log(`Sending WhatsApp response to ${phone_number} via Botsailor API`);
                        // Create a message with a link to the web upload interface
                        const baseUrl = process.env.BASE_URL || 'https://hds-sifosmans-projects.vercel.app';
                        const uploadUrl = `${baseUrl}/upload?user=${encodeURIComponent(phone_number)}`;
                        const responseMessage = `📷 I received your image, but I'm having trouble processing it directly.\n\n` +
                            `🔗 Please use this link to upload your cutting list image via our web interface:\n${uploadUrl}\n\n` +
                            `This is a temporary solution while we fix the direct WhatsApp image processing.`;
                        // Construct the API request to Botsailor
                        const messagePayload = {
                            messaging_product: 'whatsapp',
                            recipient_type: 'individual',
                            to: phone_number,
                            type: 'text',
                            text: { body: responseMessage },
                            preview_url: true // Enable link preview
                        };
                        console.log('Message payload:', JSON.stringify(messagePayload, null, 2));
                        // Determine the correct Botsailor API endpoint
                        const apiUrl = process.env.BOTSAILOR_API_URL || 'https://api.botsailor.com/v1';
                        const botsailorEndpoint = `${apiUrl}/whatsapp/${phoneNumberId}/messages`;
                        console.log(`Sending message to Botsailor API endpoint: ${botsailorEndpoint}`);
                        console.log('About to send API request to Botsailor with the following configuration:');
                        console.log('- Endpoint:', botsailorEndpoint);
                        console.log('- API Key available:', !!apiKey);
                        console.log('- Phone Number ID:', phoneNumberId);
                        console.log('- Recipient Phone:', phone_number);
                        try {
                            // Send the message via Botsailor API
                            const response = await axios_1.default.post(botsailorEndpoint, messagePayload, {
                                headers: {
                                    'Authorization': `Bearer ${apiKey}`,
                                    'Content-Type': 'application/json'
                                },
                                timeout: 15000 // 15 second timeout
                            });
                            console.log('✅ Botsailor API response details:', {
                                status: response.status,
                                statusText: response.statusText,
                                data: response.data
                            });
                            console.log('✅ WhatsApp response message sent successfully');
                        }
                        catch (apiError) {
                            console.error('❌ Error sending message to Botsailor API:', {
                                message: apiError.message,
                                status: (_e = apiError.response) === null || _e === void 0 ? void 0 : _e.status,
                                statusText: (_f = apiError.response) === null || _f === void 0 ? void 0 : _f.statusText,
                                responseData: (_g = apiError.response) === null || _g === void 0 ? void 0 : _g.data,
                                code: apiError.code,
                                url: (_h = apiError.config) === null || _h === void 0 ? void 0 : _h.url
                            });
                            // Try alternate API URL if the default one fails
                            if (apiError.code === 'ECONNREFUSED' || apiError.code === 'ETIMEDOUT') {
                                console.log('⚠️ Attempting to use alternate Botsailor API endpoint');
                                const alternateApiUrl = 'https://app.botsailor.com/api/v1';
                                const alternateEndpoint = `${alternateApiUrl}/whatsapp/${phoneNumberId}/messages`;
                                try {
                                    const alternateResponse = await axios_1.default.post(alternateEndpoint, messagePayload, {
                                        headers: {
                                            'Authorization': `Bearer ${apiKey}`,
                                            'Content-Type': 'application/json'
                                        },
                                        timeout: 15000
                                    });
                                    console.log('✅ Alternate Botsailor API response details:', {
                                        status: alternateResponse.status,
                                        statusText: alternateResponse.statusText,
                                        data: alternateResponse.data
                                    });
                                    console.log('✅ WhatsApp message sent successfully via alternate endpoint');
                                }
                                catch (altError) {
                                    console.error('❌ Error sending message via alternate endpoint:', {
                                        message: altError.message,
                                        status: (_j = altError.response) === null || _j === void 0 ? void 0 : _j.status,
                                        responseData: (_k = altError.response) === null || _k === void 0 ? void 0 : _k.data
                                    });
                                }
                            }
                        }
                    }
                    else {
                        console.log('Missing required configuration for WhatsApp messaging:');
                        if (!apiKey)
                            console.log('- Missing BOTSAILOR_API_KEY');
                        if (!phoneNumberId)
                            console.log('- Missing WHATSAPP_PHONE_NUMBER_ID');
                        if (!phone_number)
                            console.log('- Missing recipient phone number');
                    }
                }
                catch (sendError) {
                    console.error('Error sending WhatsApp response:', sendError);
                }
            }
            catch (error) {
                // This won't affect the response since we've already sent it,
                // but we still log the error for debugging
                console.error('Error processing WhatsApp webhook (after response sent):', error);
            }
        })();
    }
};
