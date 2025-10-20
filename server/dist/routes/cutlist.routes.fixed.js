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
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const axios_1 = __importDefault(require("axios"));
const cutlist_model_1 = __importDefault(require("../models/cutlist.model"));
const cutlist_controller_1 = require("../controllers/cutlist.controller");
const ocr_disabled_service_1 = require("../services/ocr-disabled.service");
const router = express_1.default.Router();
// Set up multer for file uploads
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10 MB limit
    }
});
// Route to view the cutlist editor
router.get('/edit/:id', (req, res) => {
    try {
        res.redirect(`/cutlist-edit/${req.params.id}`);
    }
    catch (error) {
        console.error('Error redirecting to cutlist editor:', error);
        res.status(500).send('Error redirecting to cutlist editor');
    }
});
// Route to view a cutlist by its ID
router.get('/:id', cutlist_controller_1.cutlistController.viewCutlistById);
// Route to update a cutlist's data
router.post('/update/:id', cutlist_controller_1.cutlistController.updateCutlistById);
// Route to create a cutlist from n8n data
router.post('/n8n-data', cutlist_controller_1.cutlistController.createFromN8nData);
// API endpoint to get all cutlists
router.get('/', cutlist_controller_1.cutlistController.getAllCutlists);
// API endpoint to get cutlist data
router.get('/data/:id', cutlist_controller_1.cutlistController.getCutlistData);
// Route to handle image upload and processing
router.post('/process', upload.single('image'), ((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No image uploaded' });
        }
        // Save the image to a temp file
        const imageBuffer = req.file.buffer;
        const imageFileName = `upload_${Date.now()}.jpg`;
        const imagePath = yield (0, ocr_disabled_service_1.saveImageFile)(imageBuffer, imageFileName);
        console.log(`Image saved to: ${imagePath}`);
        // Process the image with OCR
        const ocrResult = yield (0, ocr_disabled_service_1.processImageWithOCR)(imagePath);
        if (ocrResult.success) {
            res.json({
                success: true,
                message: 'Image processed successfully',
                ocrText: ocrResult.text,
                imagePath
            });
        }
        else {
            res.status(400).json({
                success: false,
                message: 'OCR processing failed',
                error: ocrResult.error
            });
        }
    }
    catch (error) {
        console.error('Error processing sample image:', error);
        res.status(500).json({ success: false, message: 'Error processing sample image' });
    }
})));
// Route to test the cutlist feature
router.get('/test', (req, res) => {
    res.redirect('/cutlist-test.html');
});
// Route to send WhatsApp message with a cutlist link and PDF
router.post('/send-whatsapp/:id', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const { id } = req.params;
        const { phoneNumber, customerName, projectName } = req.body;
        if (!phoneNumber) {
            return res.status(400).json({ success: false, message: 'Phone number is required' });
        }
        // Find the cutlist
        const cutlist = yield cutlist_model_1.default.findById(id);
        if (!cutlist) {
            return res.status(404).json({ success: false, message: 'Cutlist not found' });
        }
        // Import the controller functions
        const { generateAndSavePdf } = require('../controllers/optimizer.controller');
        const { saveQuote } = require('../controllers/quotes.controller');
        // Generate PDF for the cutlist using the optimizer controller
        const cutlistData = {
            cutPieces: cutlist.dimensions || [],
            stockPieces: cutlist.stockPieces || [],
            materials: cutlist.materials || [],
            customerName: customerName || cutlist.customerName,
            projectName: projectName || cutlist.projectName,
            unit: cutlist.unit || 'mm'
        };
        // Generate the PDF
        const pdfResult = yield generateAndSavePdf(cutlistData);
        if (!pdfResult.success) {
            throw new Error(`Failed to generate PDF: ${pdfResult.message}`);
        }
        // Save the PDF as a persistent quote
        // Use customer name as user ID if no userId exists on the cutlist
        const userId = cutlist.userId || ((_a = cutlist.customerName) === null || _a === void 0 ? void 0 : _a.replace(/\s+/g, '_').toLowerCase()) || 'system';
        const quoteResult = yield saveQuote(pdfResult.filePath, userId);
        // Format phone number for WhatsApp
        let formattedPhone = phoneNumber.replace(/[^0-9+]/g, '');
        if (!formattedPhone.startsWith('+')) {
            formattedPhone = '+' + formattedPhone;
        }
        // Generate the persistent PDF URL
        const baseUrl = process.env.BASE_URL || 'https://hds-sifosmans-projects.vercel.app';
        const pdfUrl = `${baseUrl}/api/quotes/${quoteResult}`;
        const cutlistUrl = `${baseUrl}/cutlist-edit/${id}`;
        // Prepare the data to send to Botsailor webhook
        const BOTSAILOR_WEBHOOK_URL = 'https://www.botsailor.com/webhook/whatsapp-workflow/145613.157394.183999.1748553417';
        const webhookData = {
            recipient: formattedPhone,
            customer_name: customerName || cutlist.customerName || 'Customer',
            cutlist_url: cutlistUrl,
            pdf_url: pdfUrl,
            dimensions_count: ((_b = cutlist.dimensions) === null || _b === void 0 ? void 0 : _b.length) || 0,
            project_name: projectName || cutlist.projectName || 'Cutting List Project'
        };
        console.log('Sending cutlist and PDF links to WhatsApp:', webhookData);
        // Send the data to the Botsailor webhook
        const response = yield axios_1.default.post(BOTSAILOR_WEBHOOK_URL, webhookData, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 10000 // 10 second timeout
        });
        console.log('Botsailor webhook response:', response.data);
        return res.json({
            success: true,
            message: 'WhatsApp message sent successfully',
            pdfUrl,
            quoteId: quoteResult
        });
    }
    catch (error) {
        console.error('Error sending cutlist via WhatsApp:', error);
        res.status(500).json({
            success: false,
            message: `Error sending WhatsApp message: ${error instanceof Error ? error.message : String(error)}`
        });
    }
}));
exports.default = router;
