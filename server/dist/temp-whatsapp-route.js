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
        const cutlist = yield Cutlist.findById(id);
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
        const response = yield axios.post(BOTSAILOR_WEBHOOK_URL, webhookData, {
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
