// Supabase Service Modules
// This file provides a centralized export for all Supabase operations

// Import all functions explicitly
import { supabase, checkConnection } from './config';
import {
  getProductDetails,
  getProductPricing,
  getProductPricingByDescription,
  getMaterialOptions,
  getProductDescriptions
} from './products.service';
import {
  createQuote,
  updateQuoteStatus,
  fetchQuoteById,
  fetchQuoteByNumber,
  updateQuotePdfUrl,
  getCustomerEmailFromQuote
} from './quotes.service';
import {
  createInvoice,
  updateInvoiceStatus,
  generateAndUploadInvoicePdf,
  createInvoiceWithPdf
} from './invoices.service';
import {
  uploadQuotePdf,
  uploadInvoicePdf
} from './storage.service';
import {
  getBranchByTradingAs,
  getBankingDetailsByBranch,
  getBranchEmailByQuote,
  getBestEmailForQuote
} from './branches.service';
import {
  saveCutlist,
  getCutlistById
} from './cutlists.service';

// Re-export all functions for named imports
export {
  // Core
  supabase,
  checkConnection,
  // Products
  getProductDetails,
  getProductPricing,
  getProductPricingByDescription,
  getMaterialOptions,
  getProductDescriptions,
  // Quotes
  createQuote,
  updateQuoteStatus,
  fetchQuoteById,
  fetchQuoteByNumber,
  updateQuotePdfUrl,
  getCustomerEmailFromQuote,
  // Invoices
  createInvoice,
  updateInvoiceStatus,
  generateAndUploadInvoicePdf,
  createInvoiceWithPdf,
  // Storage
  uploadQuotePdf,
  uploadInvoicePdf,
  // Branches
  getBranchByTradingAs,
  getBankingDetailsByBranch,
  getBranchEmailByQuote,
  getBestEmailForQuote,
  // Cutlists
  saveCutlist,
  getCutlistById
};

// Legacy compatibility - Main service object for backward compatibility
const SupabaseService = {
  // Connection
  checkConnection,
  
  // Products
  getProductDetails,
  getProductPricing,
  getProductPricingByDescription,
  getMaterialOptions,
  getProductDescriptions,
  
  // Quotes
  createQuote,
  updateQuoteStatus,
  fetchQuoteById,
  fetchQuoteByNumber,
  updateQuotePdfUrl,
  getCustomerEmailFromQuote,
  
  // Invoices
  createInvoice,
  updateInvoiceStatus,
  generateAndUploadInvoicePdf,
  createInvoiceWithPdf,
  
  // Storage
  uploadQuotePdf,
  uploadInvoicePdf,
  
  // Branches
  getBranchByTradingAs,
  getBankingDetailsByBranch,
  getBranchEmailByQuote,
  getBestEmailForQuote,
  
  // Cutlists
  saveCutlist,
  getCutlistById
};

export default SupabaseService;
