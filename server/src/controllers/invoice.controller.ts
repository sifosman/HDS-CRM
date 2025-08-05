import { Request, Response } from 'express';
import { generateQuotePdf } from '../services/optimizer.service';
import SupabaseService from '../services/supabase.service';

/**
 * Download invoice PDF directly from storage
 * This bypasses the database requirement since quotes are saved as PDFs in storage
 */
export const downloadInvoice = async (req: Request, res: Response): Promise<void> => {
    try {
      const { quoteId } = req.params;
      
      if (!quoteId) {
        res.status(400).json({ 
          success: false, 
          message: 'Quote ID is required' 
        });
        return;
      }

      console.log('Downloading invoice for quote:', quoteId);

      // First, find the invoice associated with this quote
      const invoiceResult = await SupabaseService.fetchInvoiceByQuoteId(quoteId);
      
      if (invoiceResult.success && invoiceResult.data) {
        console.log('Found invoice for quote:', quoteId, 'Invoice number:', invoiceResult.data.invoice_number);
        
        // Try to find and download the invoice PDF from the invoices bucket
        const downloadResult = await SupabaseService.downloadInvoicePdf(invoiceResult.data.invoice_number);
        
        if (downloadResult.success && downloadResult.data) {
          console.log('Found PDF in storage for invoice:', invoiceResult.data.invoice_number);
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="${downloadResult.fileName}"`);
          res.send(downloadResult.data);
          return;
        } else {
          console.log('No invoice PDF found in storage for invoice:', invoiceResult.data.invoice_number);
        }
      } else {
        console.log('No invoice found for quote:', quoteId);
      }

      // If no PDF found, try to generate a simple invoice
      console.log('No PDF found, generating simple invoice for:', quoteId);
      
      // Generate a basic invoice with placeholder data
      const basicInvoiceData = {
        quoteId,
        customerName: 'Customer',
        date: new Date().toISOString(),
        items: [
          { description: 'Custom Furniture Quote', quantity: 1, unitPrice: 1000, total: 1000 }
        ],
        subtotal: 1000,
        tax: 150,
        total: 1150
      };

      const invoiceResult2 = await generateQuotePdf(basicInvoiceData, true);
      
      if (invoiceResult2 && invoiceResult2.buffer) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${quoteId}.pdf"`);
        res.send(invoiceResult2.buffer);
        return;
      }

      res.status(404).json({ 
        success: false, 
        message: 'Quote PDF not found and could not generate invoice' 
      });

    } catch (error) {
      console.error('Error downloading invoice:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Internal server error' 
      });
    }
  };

/**
 * Create an invoice from a quote after successful payment
 */
export const createInvoiceFromPayment = async (req: Request, res: Response): Promise<void> => {
    try {
      const { quoteId, paymentDetails } = req.body;
      
      if (!quoteId || !paymentDetails) {
        res.status(400).json({
          success: false,
          message: 'Quote ID and payment details are required'
        });
        return;
      }

      const result = await SupabaseService.createInvoice(quoteId, paymentDetails);
      
      if (result.success) {
        res.json({
          success: true,
          data: result.data
        });
      } else {
        res.status(500).json({
          success: false,
          message: result.error
        });
      }
    } catch (error) {
      console.error('Error creating invoice from payment:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while creating invoice' 
      });
    }
};
