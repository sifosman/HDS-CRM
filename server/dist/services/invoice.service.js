"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_js_1 = require("@supabase/supabase-js");
// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
class InvoiceService {
    /**
     * Upload a PDF buffer to the Supabase invoices bucket
     * @param fileBuffer The PDF file buffer
     * @param fileName The name for the uploaded file
     * @returns Promise with the public URL or an error
     */
    async uploadInvoicePdf(fileBuffer, fileName) {
        try {
            const { error: uploadError } = await supabase.storage
                .from('invoices')
                .upload(fileName, fileBuffer, {
                contentType: 'application/pdf',
                upsert: true,
            });
            if (uploadError) {
                console.error('Error uploading invoice PDF to Supabase Storage:', uploadError);
                return { success: false, error: uploadError.message };
            }
            const { data: urlData } = supabase.storage
                .from('invoices')
                .getPublicUrl(fileName);
            if (!urlData.publicUrl) {
                return { success: false, error: 'Could not retrieve public URL for invoice PDF.' };
            }
            return { success: true, publicUrl: urlData.publicUrl };
        }
        catch (error) {
            console.error('Error in uploadInvoicePdf:', error);
            return { success: false, error: error.message };
        }
    }
    /**
     * Generate invoice PDF from quote data and upload to invoices bucket
     * @param quoteNumber The quote number to generate invoice for
     * @param invoiceNumber The invoice number for the PDF filename
     * @returns Promise with the public URL of the generated PDF
     */
    async generateAndUploadInvoicePdf(quoteNumber, invoiceNumber) {
        try {
            // Import the PDF generation function dynamically
            const { generateInvoicePdf } = await Promise.resolve().then(() => __importStar(require('./optimizer.service.js')));
            // Fetch the quote data
            const quoteResult = await this.fetchQuoteByNumber(quoteNumber);
            if (!quoteResult.success || !quoteResult.data) {
                return { success: false, error: 'Quote not found' };
            }
            const quote = quoteResult.data;
            // Generate the PDF
            const pdfResult = await generateInvoicePdf(quote);
            if (!pdfResult || !pdfResult.buffer) {
                return { success: false, error: 'Failed to generate PDF' };
            }
            // Create filename with invoice number
            const fileName = `invoice-${invoiceNumber}-${Date.now()}.pdf`;
            // Upload to invoices bucket
            const uploadResult = await this.uploadInvoicePdf(pdfResult.buffer, fileName);
            if (!uploadResult.success || !uploadResult.publicUrl) {
                return { success: false, error: uploadResult.error || 'Failed to upload PDF' };
            }
            // Update the invoice record with the PDF URL
            const { error: updateError } = await supabase
                .from('invoices')
                .update({ pdf_url: uploadResult.publicUrl })
                .eq('invoice_number', invoiceNumber);
            if (updateError) {
                console.error('Error updating invoice PDF URL:', updateError);
                // Don't fail the whole operation, just log the error
            }
            return { success: true, publicUrl: uploadResult.publicUrl };
        }
        catch (error) {
            console.error('Error in generateAndUploadInvoicePdf:', error);
            return { success: false, error: error.message };
        }
    }
    /**
     * Fetch quote by quote number
     * @param quoteNumber The quote number of the quote to fetch
     * @returns Promise with quote data
     */
    async fetchQuoteByNumber(quoteNumber) {
        try {
            const { data, error } = await supabase
                .from('quotes')
                .select('*')
                .eq('quote_number', quoteNumber)
                .single();
            if (error) {
                console.error(`Error fetching quote with number ${quoteNumber}:`, error);
                return { success: false, error: error.message };
            }
            if (!data) {
                return { success: false, error: 'Quote not found' };
            }
            return { success: true, data };
        }
        catch (error) {
            console.error(`Error in fetchQuoteByNumber for ${quoteNumber}:`, error);
            return { success: false, error: error.message };
        }
    }
    /**
     * Enhanced create invoice with PDF generation
     * @param quoteNumber The quote number to create invoice for
     * @param paymentDetails Payment details for the invoice
     * @param generatePdf Whether to generate and upload PDF (default: true)
     * @returns Promise with invoice data and PDF URL
     */
    async createInvoiceWithPdf(quoteNumber, paymentDetails, generatePdf = true) {
        try {
            // First create the invoice
            const invoiceResult = await this.createInvoice(quoteNumber, paymentDetails);
            if (!invoiceResult.success) {
                return invoiceResult;
            }
            const invoiceNumber = invoiceResult.data.invoiceNumber;
            let pdfUrl = null;
            // Generate and upload PDF if requested
            if (generatePdf) {
                const pdfResult = await this.generateAndUploadInvoicePdf(quoteNumber, invoiceNumber);
                if (pdfResult.success) {
                    pdfUrl = pdfResult.publicUrl;
                }
                else {
                    console.error('Failed to generate invoice PDF:', pdfResult.error);
                }
            }
            return {
                success: true,
                data: Object.assign(Object.assign({}, invoiceResult.data), { pdfUrl: pdfUrl })
            };
        }
        catch (error) {
            console.error('Error in createInvoiceWithPdf:', error);
            return { success: false, error: error.message };
        }
    }
    /**
     * Create a new invoice from a quote
     */
    async createInvoice(quoteNumber, paymentDetails) {
        try {
            // First, get the quote
            const { data: quote, error: quoteError } = await supabase
                .from('quotes')
                .select('*')
                .eq('quote_number', quoteNumber)
                .single();
            if (quoteError || !quote) {
                console.error(`Error fetching quote ${quoteNumber}:`, quoteError);
                return { success: false, error: (quoteError === null || quoteError === void 0 ? void 0 : quoteError.message) || 'Quote not found' };
            }
            // Generate invoice number (format: INV-YYYYMMDD-XXXX)
            const today = new Date();
            const datePart = today.toISOString().slice(0, 10).replace(/-/g, '');
            const randomPart = Math.floor(1000 + Math.random() * 9000).toString();
            const invoiceNumber = `INV-${datePart}-${randomPart}`;
            // Prepare invoice object
            const invoice = {
                invoice_number: invoiceNumber,
                quote_id: quote.id,
                quote_number: quote.quote_number,
                customer_name: quote.customer_name,
                customer_phone: quote.customer_phone,
                customer_email: quote.customer_email,
                items: quote.items,
                subtotal: quote.subtotal,
                tax: quote.tax,
                total: quote.total,
                payment_method: paymentDetails.method || 'Credit Card',
                payment_reference: paymentDetails.reference || `Ref-${Date.now()}`,
                payment_date: paymentDetails.date || new Date().toISOString(),
                status: 'pending',
                created_at: new Date().toISOString(),
                due_date: new Date(today.setDate(today.getDate() + 14)).toISOString() // 14 days to pay
            };
            // Insert invoice into database
            const { data, error } = await supabase
                .from('invoices')
                .insert([invoice])
                .select()
                .single();
            if (error) {
                console.error('Error creating invoice:', error);
                return { success: false, error: error.message };
            }
            return {
                success: true,
                data: {
                    invoiceNumber: data.invoice_number,
                    invoiceId: data.id,
                    createdAt: data.created_at
                }
            };
        }
        catch (error) {
            console.error('Error in createInvoice:', error);
            return { success: false, error: error.message };
        }
    }
}
exports.default = new InvoiceService();
