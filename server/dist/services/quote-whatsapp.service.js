"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendQuoteWhatsAppMessage = void 0;
const axios_1 = __importDefault(require("axios"));
/**
 * Send WhatsApp message for quote PDF creation
 * @param phoneNumber - Customer's phone number
 * @param quoteTotal - Total amount for the quote
 * @param branchName - Name of the branch
 * @returns Promise<any>
 */
const sendQuoteWhatsAppMessage = (phoneNumber, quoteTotal, branchName) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    if (!phoneNumber || !quoteTotal || !branchName) {
        throw new Error('Missing required parameters for WhatsApp quote message');
    }
    // Format message content
    const message = `Thank you for requesting a quote from ${branchName}!\n` +
        `Your quote total is: R${quoteTotal.toFixed(2)}\n` +
        `We appreciate your business.\n\n` +
        `- HDS Group`;
    // Format phone number for Botsailor (remove non-digits, keep country code)
    let formattedPhone = phoneNumber.replace(/[^0-9+]/g, '');
    if (!formattedPhone.startsWith('+')) {
        formattedPhone = '+' + formattedPhone;
    }
    // Botsailor API endpoint
    const apiUrl = `${process.env.BOTSAILOR_API_URL || 'https://www.botsailor.com/api/v1'}/whatsapp/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
    const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: formattedPhone,
        type: 'text',
        text: { body: message },
        preview_url: false
    };
    try {
        const response = yield axios_1.default.post(apiUrl, payload, {
            headers: {
                'Authorization': `Bearer ${process.env.BOTSAILOR_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 15000
        });
        return response.data;
    }
    catch (error) {
        console.error('Failed to send WhatsApp quote message:', ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
        throw error;
    }
});
exports.sendQuoteWhatsAppMessage = sendQuoteWhatsAppMessage;
