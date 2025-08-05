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

      // Construct the expected PDF filename format
      const pdfFilename = `${quoteId}-quote.pdf`;
      const invoiceFilename = `${quoteId}-invoice.pdf`;

      // Try to get the quote PDF from storage first
      try {
        // Import Supabase client for storage operations
        const { createClient } = require('@supabase/supabase-js');
        const supabaseUrl = process.env.SUPABASE_URL || '';
        const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Check if invoice PDF already exists
        const { data: invoiceData, error: invoiceError } = await supabase
          .storage
          .from('hds_quotes')
          .download(invoiceFilename);

        if (invoiceData && !invoiceError) {
          console.log('Found existing invoice PDF:', invoiceFilename);
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="${invoiceFilename}"`);
          res.send(Buffer.from(await invoiceData.arrayBuffer()));
          return;
        }

        // Check if quote PDF exists
        const { data: quoteData, error: quoteError } = await supabase
          .storage
          .from('hds_quotes')
          .download(pdfFilename);

        if (quoteData && !quoteError) {
          console.log('Found quote PDF, returning as invoice:', pdfFilename);
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="${invoiceFilename}"`);
          res.send(Buffer.from(await quoteData.arrayBuffer()));
          return;
        }

        // If no PDF found, try to generate a simple invoice
        console.log('No PDF found, generating simple invoice for:', quoteId);
        
        // Create basic invoice data
        const basicInvoiceData = {
          quoteId: quoteId,
          customerName: 'Customer',
          projectName: 'Project',
          date: new Date().toISOString(),
          items: [
            { description: 'Custom Furniture Quote', quantity: 1, unitPrice: 1000, total: 1000 }
          ],
          subtotal: 1000,
          tax: 150,
          total: 1150
        };

        const invoiceResult = await generateQuotePdf(basicInvoiceData, true);
        
        if (invoiceResult && invoiceResult.buffer) {
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="${invoiceFilename}"`);
          res.send(invoiceResult.buffer);
          return;
        }

        res.status(404).json({ 
          success: false, 
          message: 'Quote PDF not found and could not generate invoice' 
        });

      } catch (storageError) {
        console.error('Storage error:', storageError);
        res.status(500).json({ 
          success: false, 
          message: 'Error accessing storage' 
        });
      }
      
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
