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
exports.getQuoteById = exports.saveQuote = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
// Define the storage directory for quote PDFs
const QUOTES_DIR = path_1.default.join(__dirname, '../../storage/quotes');
// Ensure the quotes directory exists
if (!fs_1.default.existsSync(QUOTES_DIR)) {
    fs_1.default.mkdirSync(QUOTES_DIR, { recursive: true });
}
/**
 * Save a PDF as a persistent quote
 * @param sourceFilePath Path to the source PDF file
 * @param userId ID of the user/customer associated with the quote
 * @param expiresAt Optional expiry date for the quote
 * @returns The ID of the saved quote
 */
const saveQuote = (sourceFilePath, userId, expiresAt) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Generate a unique ID for this quote
        const quoteId = (0, uuid_1.v4)();
        const filename = `quote_${quoteId}.pdf`;
        const destFilePath = path_1.default.join(QUOTES_DIR, filename);
        // Copy the PDF to the quotes directory
        fs_1.default.copyFileSync(sourceFilePath, destFilePath);
        // Insert record into the quotes table
        const { data, error } = yield global.supabase
            .from('quotes')
            .insert({
            id: quoteId,
            filename,
            user_id: userId,
            created_at: new Date(),
            expires_at: expiresAt || null
        });
        if (error)
            throw error;
        return quoteId;
    }
    catch (error) {
        console.error('Error saving quote:', error);
        throw error;
    }
});
exports.saveQuote = saveQuote;
/**
 * Get a quote by ID and serve it
 */
const getQuoteById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        // Query the quotes table for this ID
        const { data: quote, error } = yield global.supabase
            .from('quotes')
            .select('*')
            .eq('id', id)
            .single();
        if (error || !quote) {
            return res.status(404).json({ message: 'Quote not found' });
        }
        // Check if the quote has expired
        if (quote.expires_at && new Date(quote.expires_at) < new Date()) {
            return res.status(410).json({ message: 'Quote has expired' });
        }
        // Construct the full path to the PDF file
        const filePath = path_1.default.join(QUOTES_DIR, quote.filename);
        // Check if the file exists
        if (!fs_1.default.existsSync(filePath)) {
            return res.status(404).json({ message: 'Quote file not found' });
        }
        // Serve the file
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=${quote.filename}`);
        // Stream the file to the client
        const fileStream = fs_1.default.createReadStream(filePath);
        fileStream.pipe(res);
    }
    catch (error) {
        console.error('Error retrieving quote:', error);
        res.status(500).json({ message: 'Error retrieving quote', error });
    }
});
exports.getQuoteById = getQuoteById;
