// Supabase Service Modules
// This file provides a centralized export for all Supabase operations

// Core configuration and connection
export { supabase, checkConnection } from './config';

// Product and pricing operations
export {
  getProductDetails,
  getProductPricing,
  getProductPricingByDescription,
  getMaterialOptions,
  getProductDescriptions
} from './products.service';

// Quote operations
export {
  createQuote,
  updateQuoteStatus,
  fetchQuoteById,
  fetchQuoteByNumber,
  updateQuotePdfUrl,
  getCustomerEmailFromQuote
} from './quotes.service';

// Invoice operations
export {
  createInvoice,
  updateInvoiceStatus,
  generateAndUploadInvoicePdf,
  createInvoiceWithPdf
} from './invoices.service';

// Storage operations
export {
  uploadQuotePdf,
  uploadInvoicePdf
} from './storage.service';

// Branch and banking operations
export {
  getBranchByTradingAs,
  getBankingDetailsByBranch,
  getBranchEmailByQuote,
  getBestEmailForQuote
} from './branches.service';

// Cutlist operations
export {
  saveCutlist,
  getCutlistById
} from './cutlists.service';

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
