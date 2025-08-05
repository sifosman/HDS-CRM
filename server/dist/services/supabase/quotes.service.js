"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createQuote = createQuote;
exports.updateQuoteStatus = updateQuoteStatus;
exports.fetchQuoteById = fetchQuoteById;
exports.fetchQuoteByNumber = fetchQuoteByNumber;
exports.updateQuotePdfUrl = updateQuotePdfUrl;
exports.getCustomerEmailFromQuote = getCustomerEmailFromQuote;
const config_1 = require("./config");
/**
 * Create a new quote in the database
 *
 * Table schema:
 * - id (UUID, auto-generated)
 * - filename (text)
 * - created_at (timestamp, auto-generated)
 * - cutlist_id (text, foreign key)
 * - expires_at (timestamp, nullable)
 * - quote_number (text, nullable)
 */
async function createQuote(quoteData) {
    try {
        const { data, error } = await config_1.supabase
            .from('quotes')
            .insert([{
                filename: quoteData.filename,
                cutlist_id: quoteData.cutlist_id,
                expires_at: quoteData.expires_at,
                quote_number: quoteData.quote_number,
                customer_name: quoteData.customer_name,
                customer_email: quoteData.customer_email,
                customer_phone: quoteData.customer_phone,
                project_name: quoteData.project_name,
                total_amount: quoteData.total_amount,
                status: quoteData.status || 'pending',
                pdf_url: quoteData.pdf_url,
                branch_id: quoteData.branch_id,
                branch_name: quoteData.branch_name
            }])
            .select()
            .single();
        if (error) {
            console.error('Error creating quote:', error);
            return { success: false, error: error.message };
        }
        return { success: true, data };
    }
    catch (error) {
        console.error('Error in createQuote:', error);
        return { success: false, error: error.message };
    }
}
/**
 * Update quote status
 */
async function updateQuoteStatus(quoteNumber, status) {
    try {
        const { data, error } = await config_1.supabase
            .from('quotes')
            .update({ status })
            .eq('quote_number', quoteNumber)
            .select()
            .single();
        if (error) {
            console.error('Error updating quote status:', error);
            return { success: false, error: error.message };
        }
        return { success: true, data };
    }
    catch (error) {
        console.error('Error in updateQuoteStatus:', error);
        return { success: false, error: error.message };
    }
}
/**
 * Fetch quote by ID
 * @param quoteId The ID of the quote to fetch
 * @returns Promise with quote data
 */
async function fetchQuoteById(quoteId) {
    try {
        const { data, error } = await config_1.supabase
            .from('quotes')
            .select('*')
            .eq('id', quoteId)
            .single();
        if (error) {
            console.error('Error fetching quote by ID:', error);
            return { success: false, error: error.message };
        }
        return { success: true, data };
    }
    catch (error) {
        console.error('Error in fetchQuoteById:', error);
        return { success: false, error: error.message };
    }
}
/**
 * Fetch quote by quote number
 * @param quoteNumber The quote number of the quote to fetch
 * @returns Promise with quote data
 */
async function fetchQuoteByNumber(quoteNumber) {
    try {
        const { data, error } = await config_1.supabase
            .from('quotes')
            .select('*')
            .eq('quote_number', quoteNumber)
            .single();
        if (error) {
            console.error('Error fetching quote by number:', error);
            return { success: false, error: error.message };
        }
        return { success: true, data };
    }
    catch (error) {
        console.error('Error in fetchQuoteByNumber:', error);
        return { success: false, error: error.message };
    }
}
/**
 * Update the PDF URL for a quote
 * @param quoteId The ID of the quote to update
 * @param pdfUrl The new PDF URL
 * @returns Promise with updated quote data
 */
async function updateQuotePdfUrl(quoteId, pdfUrl) {
    try {
        const { data, error } = await config_1.supabase
            .from('quotes')
            .update({ pdf_url: pdfUrl })
            .eq('id', quoteId)
            .select()
            .single();
        if (error) {
            console.error('Error updating quote PDF URL:', error);
            return { success: false, error: error.message };
        }
        return { success: true, data };
    }
    catch (error) {
        console.error('Error in updateQuotePdfUrl:', error);
        return { success: false, error: error.message };
    }
}
/**
 * Get customer email from quote
 */
async function getCustomerEmailFromQuote(quoteId) {
    try {
        const { data, error } = await config_1.supabase
            .from('quotes')
            .select('customer_email')
            .eq('quote_number', quoteId)
            .single();
        if (error || !data) {
            console.error('Error fetching customer email:', error);
            return null;
        }
        return data.customer_email;
    }
    catch (error) {
        console.error('Error in getCustomerEmailFromQuote:', error);
        return null;
    }
}
