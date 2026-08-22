import express, { Router, RequestHandler } from 'express';
import * as optimizerController from '../controllers/optimizer.controller';

const router: Router = express.Router();

// POST optimize a cutting layout
router.post('/optimize', optimizerController.optimizeCutting as RequestHandler);

// POST import IQ data
router.post('/import-iq', optimizerController.importIQData as RequestHandler);

// POST generate quotes with optimization, pricing, and PDF
router.post('/quote', optimizerController.generateQuote as RequestHandler);

// POST assign a branch to an existing quote (branch resolution flow)
router.post('/assign-branch', optimizerController.assignBranch as RequestHandler);

// POST set payment method on a quote (payfast / eft / branch)
router.post('/set-payment-method', optimizerController.setPaymentMethod as RequestHandler);

// GET download a PDF result
router.get('/pdf/:id', optimizerController.downloadPdf as RequestHandler);

// POST export IQ data
router.post('/export-iq', optimizerController.exportIQData as RequestHandler);

export default router;
