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
exports.sendWhatsAppConfirmation = exports.updateCutlistData = exports.processN8nOcrData = exports.getProcessingStatus = exports.processCutlistImage = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const uuid_1 = require("uuid");
const axios_1 = __importDefault(require("axios"));
const ocrService = __importStar(require("../services/ocr-disabled.service"));
const whatsappService = __importStar(require("../services/whatsapp.service"));
// Configure multer for image uploads
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path_1.default.join(__dirname, '../../uploads');
        if (!fs_1.default.existsSync(uploadDir)) {
            fs_1.default.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path_1.default.extname(file.originalname);
        cb(null, 'cutlist-' + uniqueSuffix + ext);
    }
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        // Accept only image files
        const filetypes = /jpeg|jpg|png|gif|webp/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path_1.default.extname(file.originalname).toLowerCase());
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only image files are allowed!'));
    }
});
/**
 * Process a cutting list image using OCR
 * This endpoint accepts an image file and extracts cutting list data using OCR
 */
const processCutlistImage = async (req, res) => {
    // Use multer middleware to handle the file upload
    const uploadMiddleware = upload.single('image');
    uploadMiddleware(req, res, async (err) => {
        if (err) {
            return res.status(400).json({
                success: false,
                message: 'Error uploading file',
                error: err.message
            });
        }
        try {
            // Check if file was uploaded
            const multerReq = req;
            if (!multerReq.file) {
                return res.status(400).json({
                    success: false,
                    message: 'No image file provided'
                });
            }
            // Get additional parameters
            const { phoneNumber, customerName, projectName } = req.body;
            // Process the image with OCR
            const filePath = multerReq.file.path;
            const ocrResults = await ocrService.processImageWithOCR(filePath);
            // Convert OCR results to cutting list data
            const cutlistData = ocrService.convertOCRToCutlistData(ocrResults);
            // Send confirmation to WhatsApp if phone number is provided
            let whatsappResponse = null;
            if (phoneNumber) {
                whatsappResponse = await whatsappService.sendWhatsAppConfirmation(phoneNumber, cutlistData, customerName || 'Customer', projectName || 'Cutting List Project');
            }
            // Return the extracted data
            res.status(200).json({
                success: true,
                message: 'Cutting list image processed successfully',
                data: cutlistData,
                rawText: ocrResults.rawText,
                whatsappSent: !!whatsappResponse,
                whatsappResponse,
                imagePath: multerReq.file.path
            });
        }
        catch (error) {
            console.error('Error processing cutting list image:', error);
            res.status(500).json({
                success: false,
                message: 'Error processing cutting list image',
                error: error instanceof Error ? error.message : String(error)
            });
        }
    });
};
exports.processCutlistImage = processCutlistImage;
/**
 * Get the status of a previously processed image
 */
const getProcessingStatus = async (req, res) => {
    try {
        const { id } = req.params;
        // In a real implementation, you would check a database or cache for the status
        // For now, we'll just return a mock response
        res.status(200).json({
            success: true,
            id,
            status: 'completed',
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Error getting processing status:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting processing status',
            error: error instanceof Error ? error.message : String(error)
        });
    }
};
exports.getProcessingStatus = getProcessingStatus;
/**
 * Process OCR data from n8n workflow
 * This endpoint accepts pre-processed OCR data from n8n and stores it for editing
 */
const processN8nOcrData = async (req, res) => {
    try {
        // Log the incoming data for debugging
        console.log('Received data from n8n:', JSON.stringify(req.body, null, 2));
        const { ocrText, phoneNumber, senderName, conversationId, apiKey, // Optional: for API authentication
        imageUrl // Optional: URL to the original image
         } = req.body;
        // Basic validation
        if (!ocrText) {
            return res.status(400).json({
                success: false,
                message: 'OCR text data is required'
            });
        }
        // Optional API key validation
        const expectedApiKey = process.env.N8N_API_KEY;
        if (expectedApiKey && apiKey !== expectedApiKey) {
            return res.status(401).json({
                success: false,
                message: 'Invalid API key'
            });
        }
        // Convert OCR results to cutting list data
        // Create a properly formatted OCR result object with default values for required properties
        const ocrResult = {
            rawText: ocrText,
            textBlocks: [], // Default empty array as we don't have text blocks from n8n
            dimensions: [], // This will be extracted by the convertOCRToCutlistData function
            unit: 'mm' // Default unit, will be overridden by the function if detected
        };
        const cutlistData = ocrService.convertOCRToCutlistData(ocrResult);
        // Generate a unique ID for this cutting list (will be overridden if API call succeeds)
        let cutlistId = (0, uuid_1.v4)();
        let cutlistUrl = '';
        const baseUrl = process.env.BASE_URL || 'https://hds-sifosmans-projects.vercel.app';
        // Try to create a proper cutlist record in the database
        try {
            console.log('Attempting to create cutlist via API...');
            const response = await axios_1.default.post(`${baseUrl}/api/cutlist/n8n-data`, {
                ocrText,
                phoneNumber,
                senderName,
                conversationId
            });
            const result = response.data;
            if (result.success) {
                // Use the cutlist ID and URL from the response
                cutlistId = result.cutlistId;
                cutlistUrl = `${baseUrl}/cutlist/${cutlistId}`;
                console.log(`Created cutlist with ID ${cutlistId}, URL: ${cutlistUrl}`);
            }
            else {
                throw new Error(result.message || 'API returned error');
            }
        }
        catch (createError) {
            console.error('Error creating cutlist via API:', createError);
            // Fallback to using the generated ID if the API call fails
            cutlistUrl = `${baseUrl}/cutlist/${cutlistId}`;
            console.log(`Using fallback cutlist URL: ${cutlistUrl}`);
        }
        // Send confirmation to WhatsApp if phone number is provided
        let whatsappResponse = null;
        let botsailorResponse = null;
        if (phoneNumber) {
            try {
                // 1. First, try to send the response via Botsailor Webhook
                const botsailorWebhookUrl = process.env.BOTSAILOR_WEBHOOK_URL;
                if (botsailorWebhookUrl) {
                    console.log('Sending webhook to Botsailor with cutlist URL:', cutlistUrl);
                    // Prepare the payload according to Botsailor Webhook format
                    const botsailorPayload = {
                        phone_number: phoneNumber, // The recipient's phone number
                        template_name: 'cutting_list_processed', // Your approved template name
                        language_code: 'en', // Template language code
                        template_parameters: [
                            cutlistUrl // The URL parameter in your template
                        ]
                    };
                    // Send the webhook to Botsailor
                    const axios = require('axios'); // Make sure axios is imported at the top
                    botsailorResponse = await axios.post(botsailorWebhookUrl, botsailorPayload, {
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        timeout: 10000 // 10 second timeout
                    });
                    console.log('Botsailor webhook response:', {
                        status: botsailorResponse.status,
                        data: botsailorResponse.data
                    });
                }
                else {
                    console.warn('BOTSAILOR_WEBHOOK_URL not configured in environment variables');
                }
            }
            catch (webhookError) {
                console.error('Error sending Botsailor webhook:', webhookError);
                // If webhook fails, fallback to the existing WhatsApp service
                console.log('Falling back to legacy WhatsApp service...');
                whatsappResponse = await whatsappService.sendWhatsAppConfirmation(phoneNumber, cutlistData, senderName || 'WhatsApp User', 'Cutting List from WhatsApp');
            }
        }
        // Return the information needed
        res.status(200).json({
            success: true,
            message: 'OCR data processed successfully',
            cutlistId,
            cutlistUrl,
            data: cutlistData,
            whatsappSent: !!whatsappResponse
        });
    }
    catch (error) {
        console.error('Error processing n8n OCR data:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing OCR data',
            error: error instanceof Error ? error.message : String(error)
        });
    }
};
exports.processN8nOcrData = processN8nOcrData;
/**
 * Update cutting list data after OCR processing
 */
const updateCutlistData = async (req, res) => {
    try {
        const { cutlistData } = req.body;
        if (!cutlistData) {
            return res.status(400).json({
                success: false,
                message: 'No cutlist data provided'
            });
        }
        // In a real implementation, you would save the updated data to a database
        // For now, we'll just return the data as received
        res.status(200).json({
            success: true,
            message: 'Cutlist data updated successfully',
            data: cutlistData
        });
    }
    catch (error) {
        console.error('Error updating cutlist data:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating cutlist data',
            error: error instanceof Error ? error.message : String(error)
        });
    }
};
exports.updateCutlistData = updateCutlistData;
/**
 * Send WhatsApp confirmation for a cutting list
 */
const sendWhatsAppConfirmation = async (req, res) => {
    try {
        const { phoneNumber, cutlistData, customerName, projectName } = req.body;
        if (!phoneNumber || !cutlistData) {
            return res.status(400).json({
                success: false,
                message: 'Phone number and cutlist data are required'
            });
        }
        // Send WhatsApp confirmation
        const whatsappResponse = await whatsappService.sendWhatsAppConfirmation(phoneNumber, cutlistData, customerName || 'Customer', projectName || 'Cutting List Project');
        res.status(200).json({
            success: true,
            message: 'WhatsApp confirmation sent successfully',
            whatsappResponse
        });
    }
    catch (error) {
        console.error('Error sending WhatsApp confirmation:', error);
        res.status(500).json({
            success: false,
            message: 'Error sending WhatsApp confirmation',
            error: error instanceof Error ? error.message : String(error)
        });
    }
};
exports.sendWhatsAppConfirmation = sendWhatsAppConfirmation;
