"use strict";
// Supabase Service Modules
// This file provides a centralized export for all Supabase operations
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCutlistById = exports.saveCutlist = exports.getBestEmailForQuote = exports.getBranchEmailByQuote = exports.getBankingDetailsByBranch = exports.getBranchByTradingAs = exports.uploadInvoicePdf = exports.uploadQuotePdf = exports.createInvoiceWithPdf = exports.generateAndUploadInvoicePdf = exports.updateInvoiceStatus = exports.createInvoice = exports.getCustomerEmailFromQuote = exports.updateQuotePdfUrl = exports.fetchQuoteByNumber = exports.fetchQuoteById = exports.updateQuoteStatus = exports.createQuote = exports.getProductDescriptions = exports.getMaterialOptions = exports.getProductPricingByDescription = exports.getProductPricing = exports.getProductDetails = exports.checkConnection = exports.supabase = void 0;
// Import all functions explicitly
const config_1 = require("./config");
Object.defineProperty(exports, "supabase", { enumerable: true, get: function () { return config_1.supabase; } });
Object.defineProperty(exports, "checkConnection", { enumerable: true, get: function () { return config_1.checkConnection; } });
const products_service_1 = require("./products.service");
Object.defineProperty(exports, "getProductDetails", { enumerable: true, get: function () { return products_service_1.getProductDetails; } });
Object.defineProperty(exports, "getProductPricing", { enumerable: true, get: function () { return products_service_1.getProductPricing; } });
Object.defineProperty(exports, "getProductPricingByDescription", { enumerable: true, get: function () { return products_service_1.getProductPricingByDescription; } });
Object.defineProperty(exports, "getMaterialOptions", { enumerable: true, get: function () { return products_service_1.getMaterialOptions; } });
Object.defineProperty(exports, "getProductDescriptions", { enumerable: true, get: function () { return products_service_1.getProductDescriptions; } });
const quotes_service_1 = require("./quotes.service");
Object.defineProperty(exports, "createQuote", { enumerable: true, get: function () { return quotes_service_1.createQuote; } });
Object.defineProperty(exports, "updateQuoteStatus", { enumerable: true, get: function () { return quotes_service_1.updateQuoteStatus; } });
Object.defineProperty(exports, "fetchQuoteById", { enumerable: true, get: function () { return quotes_service_1.fetchQuoteById; } });
Object.defineProperty(exports, "fetchQuoteByNumber", { enumerable: true, get: function () { return quotes_service_1.fetchQuoteByNumber; } });
Object.defineProperty(exports, "updateQuotePdfUrl", { enumerable: true, get: function () { return quotes_service_1.updateQuotePdfUrl; } });
Object.defineProperty(exports, "getCustomerEmailFromQuote", { enumerable: true, get: function () { return quotes_service_1.getCustomerEmailFromQuote; } });
const invoices_service_1 = require("./invoices.service");
Object.defineProperty(exports, "createInvoice", { enumerable: true, get: function () { return invoices_service_1.createInvoice; } });
Object.defineProperty(exports, "updateInvoiceStatus", { enumerable: true, get: function () { return invoices_service_1.updateInvoiceStatus; } });
Object.defineProperty(exports, "generateAndUploadInvoicePdf", { enumerable: true, get: function () { return invoices_service_1.generateAndUploadInvoicePdf; } });
Object.defineProperty(exports, "createInvoiceWithPdf", { enumerable: true, get: function () { return invoices_service_1.createInvoiceWithPdf; } });
const storage_service_1 = require("./storage.service");
Object.defineProperty(exports, "uploadQuotePdf", { enumerable: true, get: function () { return storage_service_1.uploadQuotePdf; } });
Object.defineProperty(exports, "uploadInvoicePdf", { enumerable: true, get: function () { return storage_service_1.uploadInvoicePdf; } });
const branches_service_1 = require("./branches.service");
Object.defineProperty(exports, "getBranchByTradingAs", { enumerable: true, get: function () { return branches_service_1.getBranchByTradingAs; } });
Object.defineProperty(exports, "getBankingDetailsByBranch", { enumerable: true, get: function () { return branches_service_1.getBankingDetailsByBranch; } });
Object.defineProperty(exports, "getBranchEmailByQuote", { enumerable: true, get: function () { return branches_service_1.getBranchEmailByQuote; } });
Object.defineProperty(exports, "getBestEmailForQuote", { enumerable: true, get: function () { return branches_service_1.getBestEmailForQuote; } });
const cutlists_service_1 = require("./cutlists.service");
Object.defineProperty(exports, "saveCutlist", { enumerable: true, get: function () { return cutlists_service_1.saveCutlist; } });
Object.defineProperty(exports, "getCutlistById", { enumerable: true, get: function () { return cutlists_service_1.getCutlistById; } });
// Legacy compatibility - Main service object for backward compatibility
const SupabaseService = {
    // Connection
    checkConnection: config_1.checkConnection,
    // Products
    getProductDetails: products_service_1.getProductDetails,
    getProductPricing: products_service_1.getProductPricing,
    getProductPricingByDescription: products_service_1.getProductPricingByDescription,
    getMaterialOptions: products_service_1.getMaterialOptions,
    getProductDescriptions: products_service_1.getProductDescriptions,
    // Quotes
    createQuote: quotes_service_1.createQuote,
    updateQuoteStatus: quotes_service_1.updateQuoteStatus,
    fetchQuoteById: quotes_service_1.fetchQuoteById,
    fetchQuoteByNumber: quotes_service_1.fetchQuoteByNumber,
    updateQuotePdfUrl: quotes_service_1.updateQuotePdfUrl,
    getCustomerEmailFromQuote: quotes_service_1.getCustomerEmailFromQuote,
    // Invoices
    createInvoice: invoices_service_1.createInvoice,
    updateInvoiceStatus: invoices_service_1.updateInvoiceStatus,
    generateAndUploadInvoicePdf: invoices_service_1.generateAndUploadInvoicePdf,
    createInvoiceWithPdf: invoices_service_1.createInvoiceWithPdf,
    // Storage
    uploadQuotePdf: storage_service_1.uploadQuotePdf,
    uploadInvoicePdf: storage_service_1.uploadInvoicePdf,
    // Branches
    getBranchByTradingAs: branches_service_1.getBranchByTradingAs,
    getBankingDetailsByBranch: branches_service_1.getBankingDetailsByBranch,
    getBranchEmailByQuote: branches_service_1.getBranchEmailByQuote,
    getBestEmailForQuote: branches_service_1.getBestEmailForQuote,
    // Cutlists
    saveCutlist: cutlists_service_1.saveCutlist,
    getCutlistById: cutlists_service_1.getCutlistById
};
exports.default = SupabaseService;
