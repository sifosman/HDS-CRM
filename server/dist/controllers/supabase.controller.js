"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_service_1 = __importDefault(require("../services/supabase.service"));
/**
 * Controller for handling Supabase database operations
 */
const supabaseController = {
    /**
     * Test connection to Supabase
     */
    async testConnection(req, res) {
        try {
            const connected = await supabase_service_1.default.checkConnection();
            if (connected) {
                return res.status(200).json({ success: true, message: 'Successfully connected to Supabase' });
            }
            else {
                return res.status(500).json({ success: false, message: 'Failed to connect to Supabase' });
            }
        }
        catch (error) {
            console.error('Error testing Supabase connection:', error);
            return res.status(500).json({ success: false, message: 'Error connecting to Supabase' });
        }
    },
    /**
     * Get product details from Supabase
     */
    async getProductDetails(req, res) {
        try {
            const { productCode } = req.params;
            if (!productCode) {
                return res.status(400).json({ success: false, message: 'Product code is required' });
            }
            const result = await supabase_service_1.default.getProductDetails(productCode);
            if (!result.success) {
                return res.status(404).json({ success: false, message: result.error || 'Product not found' });
            }
            return res.status(200).json({ success: true, data: result.data });
        }
        catch (error) {
            console.error('Error fetching product details:', error);
            return res.status(500).json({ success: false, message: error.message });
        }
    },
    /**
     * Get product pricing from Supabase
     */
    async getProductPricing(req, res) {
        try {
            const { productCode } = req.params;
            if (!productCode) {
                return res.status(400).json({ success: false, message: 'Product code is required' });
            }
            const result = await supabase_service_1.default.getProductPricing(productCode);
            if (!result.success) {
                return res.status(404).json({ success: false, message: result.error || 'Product pricing not found' });
            }
            return res.status(200).json({ success: true, data: result.data });
        }
        catch (error) {
            console.error('Error fetching product pricing:', error);
            return res.status(500).json({ success: false, message: error.message });
        }
    },
    /**
     * Create a quote in Supabase
     */
    async createQuote(req, res) {
        try {
            const quoteData = req.body;
            // Validate required fields
            if (!quoteData.customerName || !quoteData.customerTelephone || !quoteData.items || quoteData.items.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: customerName, customerTelephone, items'
                });
            }
            const result = await supabase_service_1.default.createQuote(quoteData);
            if (!result.success) {
                return res.status(500).json({ success: false, message: result.error || 'Failed to create quote' });
            }
            return res.status(201).json({ success: true, data: result.data });
        }
        catch (error) {
            console.error('Error creating quote:', error);
            return res.status(500).json({ success: false, message: error.message });
        }
    },
    /**
     * Update quote status
     */
    async updateQuoteStatus(req, res) {
        try {
            const { quoteNumber } = req.params;
            const { status } = req.body;
            if (!quoteNumber) {
                return res.status(400).json({ success: false, message: 'Quote number is required' });
            }
            if (!status || !['sent', 'pending', 'approved', 'rejected'].includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: 'Valid status is required: sent, pending, approved, rejected'
                });
            }
            const result = await supabase_service_1.default.updateQuoteStatus(quoteNumber, status);
            if (!result.success) {
                return res.status(500).json({ success: false, message: result.error || 'Failed to update quote status' });
            }
            return res.status(200).json({ success: true, data: result.data });
        }
        catch (error) {
            console.error('Error updating quote status:', error);
            return res.status(500).json({ success: false, message: error.message });
        }
    },
    /**
     * Create an invoice from a quote
     */
    async createInvoice(req, res) {
        try {
            const { quoteNumber } = req.params;
            const paymentDetails = req.body;
            if (!quoteNumber) {
                return res.status(400).json({ success: false, message: 'Quote number is required' });
            }
            const result = await supabase_service_1.default.createInvoice(quoteNumber, paymentDetails);
            if (!result.success) {
                return res.status(500).json({ success: false, message: result.error || 'Failed to create invoice' });
            }
            return res.status(201).json({ success: true, data: result.data });
        }
        catch (error) {
            console.error('Error creating invoice:', error);
            return res.status(500).json({ success: false, message: error.message });
        }
    },
    /**
     * Update invoice status
     */
    async updateInvoiceStatus(req, res) {
        try {
            const { invoiceNumber } = req.params;
            const { status } = req.body;
            if (!invoiceNumber) {
                return res.status(400).json({ success: false, message: 'Invoice number is required' });
            }
            if (!status || !['pending', 'paid', 'overdue', 'cancelled'].includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: 'Valid status is required: pending, paid, overdue, cancelled'
                });
            }
            const result = await supabase_service_1.default.updateInvoiceStatus(invoiceNumber, status);
            if (!result.success) {
                return res.status(500).json({ success: false, message: result.error || 'Failed to update invoice status' });
            }
            return res.status(200).json({ success: true, data: result.data });
        }
        catch (error) {
            console.error('Error updating invoice status:', error);
            return res.status(500).json({ success: false, message: error.message });
        }
    },
    /**
     * Process payment and create invoice
     */
    async processPayment(req, res) {
        try {
            const { quoteNumber, paymentDetails } = req.body;
            if (!quoteNumber) {
                return res.status(400).json({ success: false, message: 'Quote number is required' });
            }
            // Create invoice from quote
            const result = await supabase_service_1.default.createInvoice(quoteNumber, paymentDetails || {});
            if (!result.success) {
                return res.status(500).json({ success: false, message: result.error || 'Failed to create invoice' });
            }
            // Mark invoice as paid if payment was successful
            const invoiceNumber = result.data.invoiceNumber;
            await supabase_service_1.default.updateInvoiceStatus(invoiceNumber, 'paid');
            return res.status(200).json({
                success: true,
                message: 'Payment processed and invoice created successfully',
                data: {
                    invoiceNumber,
                    status: 'paid',
                    timestamp: new Date().toISOString()
                }
            });
        }
        catch (error) {
            console.error('Error processing payment:', error);
            return res.status(500).json({ success: false, message: error.message });
        }
    },
    /**
     * Get material options for cascading dropdowns
     */
    async getMaterialOptions(req, res) {
        try {
            const result = await supabase_service_1.default.getMaterialOptions();
            if (!result.success) {
                return res.status(404).json({ success: false, message: result.error || 'Material options not found' });
            }
            return res.status(200).json({ success: true, data: result.data });
        }
        catch (error) {
            console.error('Error fetching material options:', error);
            return res.status(500).json({ success: false, message: error.message || 'Server error' });
        }
    },
    /**
     * Get all product descriptions
     */
    async getProductDescriptions(req, res) {
        try {
            const result = await supabase_service_1.default.getProductDescriptions();
            if (!result.success) {
                return res.status(404).json({ success: false, message: result.error || 'Product descriptions not found' });
            }
            return res.status(200).json({ success: true, data: result.data });
        }
        catch (error) {
            console.error('Error fetching product descriptions:', error);
            return res.status(500).json({ success: false, message: error.message });
        }
    },
    /**
     * Get product pricing by description from Supabase
     */
    async getProductPricingByDescription(req, res) {
        try {
            const { description } = req.query;
            const includeSizes = req.query.includeSizes === 'true';
            if (!description) {
                return res.status(400).json({ success: false, message: 'Product description is required' });
            }
            const result = await supabase_service_1.default.getProductPricingByDescription(description.toString(), includeSizes);
            if (!result.success) {
                return res.status(404).json({ success: false, message: result.error || 'Product pricing not found' });
            }
            return res.status(200).json({ success: true, data: result.data });
        }
        catch (error) {
            console.error('Error fetching product pricing by description:', error);
            return res.status(500).json({ success: false, message: error.message });
        }
    },
    /**
     * Get branch by trading_as value
     */
    getBranchByTradingAs: async (req, res) => {
        try {
            const { tradingAs } = req.params;
            if (!tradingAs) {
                return res.status(400).json({ success: false, message: 'tradingAs parameter is required' });
            }
            const result = await supabase_service_1.default.getBranchByTradingAs(tradingAs);
            if (!result.success) {
                return res.status(404).json({ success: false, message: result.error || 'Branch not found' });
            }
            return res.status(200).json({ success: true, data: result.data });
        }
        catch (error) {
            console.error('Error fetching branch by trading_as:', error);
            return res.status(500).json({ success: false, message: error.message });
        }
    },
    /**
     * Upload a quote PDF to the hdsquotes bucket
     */
    uploadQuotePdf: async (req, res) => {
        try {
            // Check if file exists in the request
            if (!req.file) {
                return res.status(400).json({ success: false, message: 'No PDF file provided' });
            }
            const fileBuffer = req.file.buffer;
            const fileName = `quote-${Date.now()}-${req.file.originalname}`;
            // Upload file to Supabase storage
            const result = await supabase_service_1.default.uploadQuotePdf(fileBuffer, fileName);
            if (!result.success) {
                return res.status(500).json({
                    success: false,
                    message: result.error || 'Failed to upload PDF to storage'
                });
            }
            // If quoteid is provided, update the quote with the pdf url
            if (req.body.quoteId) {
                await supabase_service_1.default.updateQuotePdfUrl(req.body.quoteId, result.publicUrl || '');
            }
            return res.status(200).json({
                success: true,
                message: 'PDF uploaded successfully',
                data: {
                    fileName,
                    url: result.publicUrl
                }
            });
        }
        catch (error) {
            console.error('Error uploading quote PDF:', error);
            return res.status(500).json({ success: false, message: error.message });
        }
    }
};
exports.default = supabaseController;
