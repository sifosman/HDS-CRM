import { supabase } from './config';
import { fetchQuoteByNumber } from './quotes.service';
import { uploadInvoicePdf } from './storage.service';

/**
 * Create a new invoice from a quote
 */
export async function createInvoice(quoteNumber: string, paymentDetails: any): Promise<any> {
  try {
    // Generate invoice number
    const timestamp = Date.now();
    const invoiceNumber = `INV-${quoteNumber.replace('Q-', '')}-${timestamp}`;
    
    const { data, error } = await supabase
      .from('invoices')
      .insert([{
        invoice_number: invoiceNumber,
        quote_number: quoteNumber,
        amount: paymentDetails.amount,
        payment_method: paymentDetails.payment_method || 'payfast',
        payment_status: paymentDetails.payment_status || 'pending',
        payment_reference: paymentDetails.payment_reference,
        created_at: new Date().toISOString(),
        customer_name: paymentDetails.customer_name,
        customer_email: paymentDetails.customer_email,
        project_name: paymentDetails.project_name
      }])
      .select()
      .single();
    
    if (error) {
      console.error('Error creating invoice:', error);
      return { success: false, error: error.message };
    }
    
    return { 
      success: true, 
      data: {
        ...data,
        invoiceNumber: invoiceNumber
      }
    };
  } catch (error: any) {
    console.error('Error in createInvoice:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update invoice status
 */
export async function updateInvoiceStatus(invoiceNumber: string, status: 'pending' | 'paid' | 'overdue' | 'cancelled'): Promise<any> {
  try {
    const { data, error } = await supabase
      .from('invoices')
      .update({ payment_status: status })
      .eq('invoice_number', invoiceNumber)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating invoice status:', error);
      return { success: false, error: error.message };
    }
    
    return { success: true, data };
  } catch (error: any) {
    console.error('Error in updateInvoiceStatus:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Generate invoice PDF from quote data and upload to invoices bucket
 * @param quoteNumber The quote number to generate invoice for
 * @param invoiceNumber The invoice number for the PDF filename
 * @returns Promise with the public URL of the generated PDF
 */
export async function generateAndUploadInvoicePdf(quoteNumber: string, invoiceNumber: string): Promise<{ success: boolean; error?: string; publicUrl?: string }> {
  try {
    // Fetch the quote data
    const quoteResult = await fetchQuoteByNumber(quoteNumber);
    if (!quoteResult.success) {
      return { success: false, error: `Failed to fetch quote: ${quoteResult.error}` };
    }
    
    const quoteData = quoteResult.data;
    
    // Dynamically import the PDF generation function
    const { generateInvoicePdf } = require('../optimizer.service');
    
    // Generate the invoice PDF
    const pdfBuffer = await generateInvoicePdf({
      ...quoteData,
      invoiceNumber: invoiceNumber,
      invoiceDate: new Date().toISOString().split('T')[0]
    });
    
    if (!pdfBuffer) {
      return { success: false, error: 'Failed to generate PDF buffer' };
    }
    
    // Upload to invoices bucket
    const fileName = `${invoiceNumber}.pdf`;
    const uploadResult = await uploadInvoicePdf(pdfBuffer, fileName);
    
    return uploadResult;
  } catch (error: any) {
    console.error('Error in generateAndUploadInvoicePdf:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Create invoice with PDF generation and upload
 * @param quoteNumber The quote number to create invoice for
 * @param paymentDetails Payment details for the invoice
 * @returns Promise with invoice data and PDF URL
 */
export async function createInvoiceWithPdf(quoteNumber: string, paymentDetails: any): Promise<{ success: boolean; error?: string; data?: any }> {
  try {
    // First create the invoice record
    const invoiceResult = await createInvoice(quoteNumber, paymentDetails);
    
    if (!invoiceResult.success) {
      return { success: false, error: invoiceResult.error };
    }

    const invoiceNumber = invoiceResult.data.invoiceNumber;
    
    // Generate and upload the PDF
    const pdfResult = await generateAndUploadInvoicePdf(quoteNumber, invoiceNumber);
    
    if (!pdfResult.success) {
      return { success: false, error: pdfResult.error };
    }

    // Update the invoice with the PDF URL
    const { error: updateError } = await supabase
      .from('invoices')
      .update({ pdf_url: pdfResult.publicUrl })
      .eq('invoice_number', invoiceNumber);

    if (updateError) {
      console.error('Error updating invoice PDF URL:', updateError);
    }

    return {
      success: true,
      data: {
        ...invoiceResult.data,
        pdfUrl: pdfResult.publicUrl
      }
    };
  } catch (error: any) {
    console.error('Error in createInvoiceWithPdf:', error);
    return { success: false, error: error.message };
  }
}
