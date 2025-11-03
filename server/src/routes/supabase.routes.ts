import express, { Request, Response } from 'express';
import multer from 'multer';
import supabaseController from '../controllers/supabase.controller';

// Configure multer for memory storage (buffer)
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, callback) => {
    if (file.mimetype === 'application/pdf') {
      callback(null, true);
    } else {
      callback(new Error('Only PDF files are allowed'));
    }
  }
});

const router = express.Router();

// Test connection to Supabase
router.get('/test', function(req: Request, res: Response) {
  supabaseController.testConnection(req, res);
});

// Product routes
router.get('/products/:productCode', function(req: Request, res: Response) {
  supabaseController.getProductDetails(req, res);
});

router.get('/products/:productCode/pricing', function(req: Request, res: Response) {
  supabaseController.getProductPricing(req, res);
});

// Quote routes
router.post('/quotes', function(req: Request, res: Response) {
  supabaseController.createQuote(req, res);
});

router.patch('/quotes/:quoteNumber/status', function(req: Request, res: Response) {
  supabaseController.updateQuoteStatus(req, res);
});

// Invoice routes
router.post('/invoices/from-quote/:quoteNumber', function(req: Request, res: Response) {
  supabaseController.createInvoice(req, res);
});

router.patch('/invoices/:invoiceNumber/status', function(req: Request, res: Response) {
  supabaseController.updateInvoiceStatus(req, res);
});

// Payment processing
router.post('/payments/process', function(req: Request, res: Response) {
  supabaseController.processPayment(req, res);
});

// Material options for cascading dropdowns
router.get('/materials/options', function(req: Request, res: Response) {
  supabaseController.getMaterialOptions(req, res);
});

// Get all product descriptions for material dropdown
router.get('/products/descriptions', function(req: Request, res: Response) {
  supabaseController.getProductDescriptions(req, res);
});

// Get product pricing by description (new endpoint for material dropdown)
router.get('/products/pricing', function(req: Request, res: Response) {
  supabaseController.getProductPricingByDescription(req, res);
});

// Get branch by trading_as value
router.get('/branches/by-trading-as/:tradingAs', function(req: Request, res: Response) {
  supabaseController.getBranchByTradingAs(req, res);
});

// List quote PDFs from storage bucket
router.get('/quotes/storage', function(req: Request, res: Response) {
  supabaseController.listQuotePdfs(req, res);
});

// Upload quote PDF to storage
router.post('/quotes/pdf', upload.single('pdf'), function(req: Request, res: Response) {
  supabaseController.uploadQuotePdf(req, res);
});

export default router;
