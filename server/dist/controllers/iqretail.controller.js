"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.iqRetailController = void 0;
const iqretail_service_1 = __importDefault(require("../services/iqretail.service"));
/**
 * Controller for handling IQ Retail API related requests
 */
exports.iqRetailController = {
    /**
     * Test the connection to IQ Retail API
     */
    async testConnection(req, res) {
        try {
            const connected = await iqretail_service_1.default.checkConnection();
            if (connected) {
                return res.status(200).json({ success: true, message: 'Successfully connected to IQ Retail API' });
            }
            else {
                return res.status(500).json({ success: false, message: 'Failed to connect to IQ Retail API' });
            }
        }
        catch (error) {
            console.error('Error testing IQ Retail connection:', error);
            return res.status(500).json({ success: false, message: 'Error connecting to IQ Retail API' });
        }
    },
    /**
     * Get product attributes from IQ Retail
     */
    async getProductAttributes(req, res) {
        try {
            const { stockCode } = req.params;
            const stockData = await iqretail_service_1.default.getStockAttributes(stockCode);
            return res.status(200).json({ success: true, data: stockData });
        }
        catch (error) {
            console.error('Error fetching stock data:', error);
            return res.status(500).json({ success: false, message: 'Failed to fetch stock data' });
        }
    },
    /**
     * Get product pricing from IQ Retail
     */
    async getProductPricing(req, res) {
        try {
            const { stockCode } = req.params;
            const pricingData = await iqretail_service_1.default.getStockPricing(stockCode);
            return res.status(200).json({ success: true, data: pricingData });
        }
        catch (error) {
            console.error('Error fetching pricing data:', error);
            return res.status(500).json({ success: false, message: 'Failed to fetch pricing data' });
        }
    },
    /**
     * Create a quote in IQ Retail
     */
    async createQuote(req, res) {
        try {
            const quoteData = req.body;
            const quote = await iqretail_service_1.default.createQuote(quoteData);
            return res.status(200).json({ success: true, data: quote });
        }
        catch (error) {
            console.error('Error creating quote:', error);
            return res.status(500).json({ success: false, message: 'Failed to create quote' });
        }
    },
    /**
     * Create a sales order in IQ Retail
     */
    async createSalesOrder(req, res) {
        try {
            const orderData = req.body;
            const order = await iqretail_service_1.default.createSalesOrder(orderData);
            return res.status(200).json({ success: true, data: order });
        }
        catch (error) {
            console.error('Error creating sales order:', error);
            return res.status(500).json({ success: false, message: 'Failed to create sales order' });
        }
    },
    /**
     * Create an invoice in IQ Retail
     */
    async createInvoice(req, res) {
        try {
            const invoiceData = req.body;
            const invoice = await iqretail_service_1.default.createInvoice(invoiceData);
            return res.status(200).json({ success: true, data: invoice });
        }
        catch (error) {
            console.error('Error creating invoice:', error);
            return res.status(500).json({ success: false, message: 'Failed to create invoice' });
        }
    },
    /**
     * Process payment and create invoice
     * This endpoint handles the full payment confirmation workflow:
     * 1. Creates a sales order from the quote
     * 2. Creates an invoice from the sales order
     * 3. Updates the order status to paid
     */
    async processPayment(req, res) {
        var _a, _b;
        try {
            const { quoteId, paymentDetails } = req.body;
            if (!quoteId) {
                return res.status(400).json({
                    success: false,
                    message: 'Quote ID is required'
                });
            }
            // Step 1: Create sales order from quote
            const orderData = {
                quoteId,
                customerName: req.body.customerName,
                customerEmail: req.body.customerEmail,
                items: req.body.items || []
            };
            const orderResult = await iqretail_service_1.default.createSalesOrder(orderData);
            if (!orderResult || !orderResult.success) {
                return res.status(500).json({
                    success: false,
                    message: 'Failed to create sales order from quote'
                });
            }
            const orderId = (_a = orderResult.data) === null || _a === void 0 ? void 0 : _a.orderNumber;
            // Step 2: Create invoice from sales order
            const invoiceData = {
                orderId,
                paymentMethod: (paymentDetails === null || paymentDetails === void 0 ? void 0 : paymentDetails.method) || 'Credit Card',
                paymentReference: (paymentDetails === null || paymentDetails === void 0 ? void 0 : paymentDetails.reference) || `Ref-${Date.now()}`,
                items: req.body.items || []
            };
            const invoiceResult = await iqretail_service_1.default.createInvoice(invoiceData);
            if (!invoiceResult || !invoiceResult.success) {
                return res.status(500).json({
                    success: false,
                    message: 'Failed to create invoice from sales order'
                });
            }
            const invoiceId = (_b = invoiceResult.data) === null || _b === void 0 ? void 0 : _b.invoiceNumber;
            return res.status(200).json({
                success: true,
                message: 'Payment processed and invoice created successfully',
                data: {
                    orderId,
                    invoiceId,
                    status: 'PAID',
                    timestamp: new Date().toISOString()
                }
            });
        }
        catch (error) {
            console.error('Error processing payment:', error);
            return res.status(500).json({
                success: false,
                message: 'Failed to process payment and create invoice'
            });
        }
    }
};
exports.default = exports.iqRetailController;
