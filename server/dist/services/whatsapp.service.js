"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendWhatsAppConfirmation = void 0;
const axios_1 = __importDefault(require("axios"));
const uuid_1 = require("uuid");
// Get WhatsApp API configuration from environment variables
// This could be Botsailor's API or any other WhatsApp Business API provider
const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || '';
const WHATSAPP_API_KEY = process.env.WHATSAPP_API_KEY || '';
// Create axios instance for WhatsApp API
const whatsappApi = axios_1.default.create({
    baseURL: WHATSAPP_API_URL,
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${WHATSAPP_API_KEY}`
    }
});
/**
 * Send a WhatsApp message with the extracted cutting list data
 * @param phoneNumber The customer's phone number
 * @param cutlistData The extracted cutting list data
 * @param customerName The customer's name
 * @param projectName The project name
 * @returns Response from the WhatsApp API
 */
const sendWhatsAppConfirmation = async (phoneNumber, cutlistData, customerName = 'Customer', projectName = 'Cutting List Project') => {
    var _a, _b;
    try {
        // Format the message
        const message = formatWhatsAppMessage(cutlistData, customerName, projectName);
        // Prepare the request payload
        const payload = {
            recipient_type: 'individual',
            to: formatPhoneNumber(phoneNumber),
            type: 'text',
            text: {
                body: message
            }
        };
        // Send the message via WhatsApp API
        const response = await whatsappApi.post('/messages', payload);
        return {
            success: true,
            messageId: ((_b = (_a = response.data.messages) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.id) || (0, uuid_1.v4)(),
            timestamp: new Date().toISOString()
        };
    }
    catch (error) {
        console.error('Error sending WhatsApp confirmation:', error);
        // If we're in development or testing, simulate a successful response
        if (process.env.NODE_ENV !== 'production' || !WHATSAPP_API_KEY) {
            console.log('Simulating WhatsApp message in development mode');
            console.log('Message would be sent to:', phoneNumber);
            console.log('Message content:', formatWhatsAppMessage(cutlistData, customerName, projectName));
            return {
                success: true,
                messageId: (0, uuid_1.v4)(),
                timestamp: new Date().toISOString(),
                simulated: true
            };
        }
        throw error;
    }
};
exports.sendWhatsAppConfirmation = sendWhatsAppConfirmation;
/**
 * Format a WhatsApp message with the extracted cutting list data
 * @param data The extracted cutting list data
 * @param customerName The customer's name
 * @param projectName The project name
 * @returns Formatted WhatsApp message
 */
const formatWhatsAppMessage = (data, customerName, projectName) => {
    let message = `Great!`;
    message += `We've received your cutting list for project "${projectName}" and processed it. Please confirm if the following details are correct:\n\n`;
    // Add stock pieces
    message += `*Stock Pieces:*\n`;
    data.stockPieces.forEach((piece, index) => {
        message += `${index + 1}. ${piece.width} × ${piece.length} ${data.unit} (Quantity: ${piece.quantity})\n`;
    });
    message += `\n*Cut Pieces:*\n`;
    data.cutPieces.forEach((piece, index) => {
        const pieceName = piece.name ? `${piece.name}: ` : '';
        message += `${index + 1}. ${pieceName}${piece.width} × ${piece.length} ${data.unit} (Quantity: ${piece.quantity})\n`;
    });
    message += `\nTotal Stock Pieces: ${data.stockPieces.reduce((sum, p) => sum + p.quantity, 0)}\n`;
    message += `Total Cut Pieces: ${data.cutPieces.reduce((sum, p) => sum + p.quantity, 0)}\n\n`;
    message += `Thank you,\nHDS Group Cutlist Team`;
    return message;
};
/**
 * Format a phone number to the international format required by WhatsApp API
 * @param phoneNumber The phone number to format
 * @returns Formatted phone number
 */
const formatPhoneNumber = (phoneNumber) => {
    // Remove any non-digit characters
    let cleaned = phoneNumber.replace(/\D/g, '');
    // Ensure the number starts with a country code
    if (!cleaned.startsWith('1') && !cleaned.startsWith('+')) {
        // Default to US country code if none is provided
        cleaned = '1' + cleaned;
    }
    // Ensure the number starts with a plus sign
    if (!cleaned.startsWith('+')) {
        cleaned = '+' + cleaned;
    }
    return cleaned;
};
