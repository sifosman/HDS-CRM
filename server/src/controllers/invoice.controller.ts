import { Request, Response } from 'express';
import { generateInvoicePdf } from '../services/optimizer.service';
import SupabaseService from '../services/supabase.service';

/**
 * Generate and download invoice PDF for a quote
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

      console.log('Generating invoice for quote:', quoteId);

      // Get quote data from Supabase
      const quoteResult = await SupabaseService.fetchQuoteById(quoteId);
      
      if (!quoteResult.success || !quoteResult.data) {
        res.status(404).json({ 
          success: false, 
          message: 'Quote not found' 
        });
        return;
      }

      const quoteData = quoteResult.data;
      
      // Generate invoice PDF
      const invoiceResult = await generateInvoicePdf(quoteData);
      
      if (!invoiceResult || !invoiceResult.buffer) {
        res.status(500).json({ 
          success: false, 
          message: 'Failed to generate invoice PDF' 
        });
        return;
      }

      // Set response headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="invoice-${quoteId}.pdf"`);
      res.setHeader('Content-Length', invoiceResult.buffer.length);
      
      // Send the PDF buffer
      res.send(invoiceResult.buffer);
      
    } catch (error) {
      console.error('Error generating invoice:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Internal server error while generating invoice' 
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

      // Create invoice record in database
      const invoiceResult = await SupabaseService.createInvoice(quoteId, paymentDetails);
      
      if (!invoiceResult.success) {
        res.status(500).json({ 
          success: false, 
          message: 'Failed to create invoice record' 
        });
        return;
      }

      // Update quote status to 'approved'
      await SupabaseService.updateQuoteStatus(quoteId, 'approved');

      res.status(200).json({ 
        success: true, 
        message: 'Invoice created successfully',
        data: invoiceResult.data
      });
      
    } catch (error) {
      console.error('Error creating invoice from payment:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Internal server error while creating invoice' 
      });
    }
};
