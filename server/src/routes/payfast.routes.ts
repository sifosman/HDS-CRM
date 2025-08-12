import express, { Request, Response, NextFunction } from 'express';
import {
  generatePaymentForm,
  handlePaymentCancel,
  handlePaymentNotification,
  processItnJob
} from '../controllers/payfast.controller';
import { debugPayFastSignature } from '../controllers/payfast-debug.controller';
import { testITN } from '../controllers/payfast-test-itn.controller';
import { simulatePayFastITN } from '../controllers/payfast-manual-itn.controller';

// Import the enhanced PayFast success controller
import payFastSuccessEnhancedController from '../controllers/payfast-success-enhanced.controller';

const router = express.Router();

// Middleware to capture raw body for PayFast notifications
const rawBodyMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (req.originalUrl.endsWith('/notify')) {
    // Capture raw body for signature validation
    let rawBody = '';
    req.on('data', (chunk: Buffer) => {
      rawBody += chunk.toString();
    });
    req.on('end', () => {
      (req as any).rawBody = rawBody;
      next();
    });
  } else {
    next();
  }
};

// Apply raw body middleware
router.use(rawBodyMiddleware);

// Generate payment form for a quote
router.get('/pay', generatePaymentForm);

// Handle payment success return (both GET and POST)
router.get('/success', (req: Request, res: Response) => payFastSuccessEnhancedController.handlePaymentSuccess(req, res));
router.post('/success', (req: Request, res: Response) => payFastSuccessEnhancedController.handlePaymentSuccess(req, res));

// Handle payment cancellation return
router.get('/cancel', handlePaymentCancel);

// Handle PayFast ITN (Instant Transaction Notification)
router.post('/notify', handlePaymentNotification);

// Internal background processing endpoint for ITN (invoice + email)
router.post('/process-itn', processItnJob);

// Debug endpoint to test signature generation
router.get('/debug', debugPayFastSignature);

// Test endpoint to manually trigger ITN and email sending
router.get('/test-itn', testITN);

// Manual test endpoint to simulate PayFast ITN for real quotes
router.get('/simulate-itn', simulatePayFastITN);

// Test endpoint for signature verification
router.get('/test-signature', (req: Request, res: Response) => {
  const testData: Record<string, string> = {
    merchant_id: '10000100',
    merchant_key: '46f0cd694581a',
    amount: '100.00',
    item_name: 'Test Item'
  };
  
  const passphrase = 'jt7NOE43FZPn';
  const crypto = require('crypto');
  
  // Generate signature with field order
  const fieldOrder = [
    'merchant_id', 'merchant_key', 'amount', 'item_name'
  ];
  
  const paramPairs: string[] = [];
  fieldOrder.forEach(key => {
    if (testData[key]) {
      paramPairs.push(`${key}=${testData[key]}`);
    }
  });
  
  const paramString = paramPairs.join('&');
  const stringToHash = `${paramString}&passphrase=${passphrase}`;
  const signature = crypto.createHash('md5').update(stringToHash).digest('hex').toLowerCase();
  
  res.json({
    testData,
    paramString,
    stringToHash,
    signature,
    expected: crypto.createHash('md5').update('merchant_id=10000100&merchant_key=46f0cd694581a&amount=100.00&item_name=Test Item&passphrase=jt7NOE43FZPn').digest('hex').toLowerCase()
  });
});

export default router;
