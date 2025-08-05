"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadQuotePdf = uploadQuotePdf;
exports.uploadInvoicePdf = uploadInvoicePdf;
const config_1 = require("./config");
/**
 * Upload a PDF buffer to the Supabase hdsquotes bucket
 * @param fileBuffer The PDF file buffer
 * @param fileName The name for the uploaded file
 * @returns Promise with the public URL or an error
 */
async function uploadQuotePdf(fileBuffer, fileName) {
    try {
        const { data, error } = await config_1.supabase.storage
            .from('hdsquotes')
            .upload(fileName, fileBuffer, {
            contentType: 'application/pdf',
            upsert: true
        });
        if (error) {
            console.error('Error uploading quote PDF:', error);
            return { success: false, error: error.message };
        }
        // Get the public URL
        const { data: publicUrlData } = config_1.supabase.storage
            .from('hdsquotes')
            .getPublicUrl(fileName);
        return {
            success: true,
            publicUrl: publicUrlData.publicUrl
        };
    }
    catch (error) {
        console.error('Error in uploadQuotePdf:', error);
        return { success: false, error: error.message };
    }
}
/**
 * Upload invoice PDF to Supabase storage
 * @param fileBuffer The PDF file buffer
 * @param fileName The name for the uploaded file
 * @returns Promise with the public URL or an error
 */
async function uploadInvoicePdf(fileBuffer, fileName) {
    try {
        const { data, error } = await config_1.supabase.storage
            .from('invoices')
            .upload(fileName, fileBuffer, {
            contentType: 'application/pdf',
            upsert: true
        });
        if (error) {
            console.error('Error uploading invoice PDF:', error);
            return { success: false, error: error.message };
        }
        // Get the public URL
        const { data: publicUrlData } = config_1.supabase.storage
            .from('invoices')
            .getPublicUrl(fileName);
        return {
            success: true,
            publicUrl: publicUrlData.publicUrl
        };
    }
    catch (error) {
        console.error('Error in uploadInvoicePdf:', error);
        return { success: false, error: error.message };
    }
}
