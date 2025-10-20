"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
// Import disabled due to TypeScript errors and replaced with Supabase integration
// import IQRetailService from '../services/iqretail.service';
/**
 * NOTE: IQ Retail integration has been paused in favor of Supabase
 * These routes are kept for reference but are disabled to avoid TypeScript build errors
 */
const router = (0, express_1.Router)();
/**
 * Placeholder empty router with no active routes
 * All IQ Retail integration endpoints have been commented out
 * The application now uses Supabase for product pricing, quotes, and invoices
 */
/*
// Original routes commented out to avoid TypeScript build errors

router.get('/test', async (req, res) => {
  return res.status(200).json({
    success: false,
    message: 'IQ Retail integration has been replaced with Supabase'
  });
});

router.get('/stock/:stockCode', async (req, res) => {
  return res.status(200).json({
    success: false,
    message: 'IQ Retail integration has been replaced with Supabase'
  });
});

router.get('/pricing/:stockCode', async (req, res) => {
  return res.status(200).json({
    success: false,
    message: 'IQ Retail integration has been replaced with Supabase'
  });
});

router.post('/quote', async (req, res) => {
  return res.status(200).json({
    success: false,
    message: 'IQ Retail integration has been replaced with Supabase'
  });
});

router.post('/order', async (req, res) => {
  return res.status(200).json({
    success: false,
    message: 'IQ Retail integration has been replaced with Supabase'
  });
});

router.post('/invoice', async (req, res) => {
  return res.status(200).json({
    success: false,
    message: 'IQ Retail integration has been replaced with Supabase'
  });
});
*/
exports.default = router;
