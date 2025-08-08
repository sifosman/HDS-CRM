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

      console.log('🔍 [DEBUG] Downloading invoice for quote:', quoteId);
      console.log('🔍 [DEBUG] Quote ID type:', typeof quoteId);
      console.log('🔍 [DEBUG] Quote ID length:', quoteId.length);
      console.log('🔍 [DEBUG] Quote ID (URL decoded):', decodeURIComponent(quoteId));

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

      // If no PDF found, try to generate an invoice based on the actual quote data
      console.log('No PDF found, fetching quote data for:', quoteId);
      
      // First, get the quote details to use the same data structure as the quote PDF
      console.log('🔍 [DEBUG] Attempting to fetch quote with fetchQuoteByNumber:', quoteId);
      const quoteResult = await SupabaseService.fetchQuoteByNumber(quoteId);
      
      console.log('🔍 [DEBUG] fetchQuoteByNumber result:', {
        success: quoteResult.success,
        hasData: !!quoteResult.data,
        error: quoteResult.error
      });
      
      if (!quoteResult.success || !quoteResult.data) {
        console.error('❌ [ERROR] Could not fetch quote data for invoice generation:', quoteId);
        console.error('❌ [ERROR] fetchQuoteByNumber response:', quoteResult);
        
        // Try to get all quotes to see what's available
        console.log('🔍 [DEBUG] Attempting to fetch all quotes to debug...');
        try {
          // Let's try to fetch a few quotes to see what quote numbers exist
          const debugQuoteResult = await SupabaseService.fetchQuoteById('any'); // This will fail but might give us info
          console.log('🔍 [DEBUG] Debug quote fetch result:', debugQuoteResult);
        } catch (debugError) {
          console.error('❌ [ERROR] Could not fetch sample quotes:', debugError);
        }
        
        res.status(404).json({
          success: false,
          message: `Could not find quote data for ID: ${quoteId}. Please check that the quote exists in the database.`
        });
        return;
      }
      
      console.log(`Successfully fetched quote data for ${quoteId}`);
      
      // Extract the quote data including sections, items, totals
      const quoteData = quoteResult.data;
      
      // Fetch branch data dynamically from branches table
      let branchData = { name: 'HDS Group', phone: '', address: '', email: '' };
      let bankingDetails = { bank: '', account: '', branch: '' };
      
      // Try to determine branch from quote data or use default
      let branchTradingAs = 'HDS Group'; // Default fallback
      
      // Check if quote has branch information in quote_data
      try {
        const parsedQuoteData = JSON.parse(quoteData.quote_data || '{}');
        if (parsedQuoteData.branchData && parsedQuoteData.branchData.trading_as) {
          branchTradingAs = parsedQuoteData.branchData.trading_as;
          console.log(`Found branch in quote data: ${branchTradingAs}`);
        }
      } catch (e) {
        console.log('No branch data found in quote_data, using default');
      }
      
      // Fetch branch details from branches table
      console.log(`Fetching branch data for: ${branchTradingAs}`);
      const branchResult = await SupabaseService.getBranchByTradingAs(branchTradingAs);
      
      if (branchResult.success && branchResult.data) {
        const branch = branchResult.data;
        branchData = {
          name: branch.trading_as || 'HDS Group',
          phone: branch.branch_telephone || '',
          address: branch.branch_address || '',
          email: branch.email_address || ''
        };
        console.log(`✅ Fetched branch data:`, branchData);
        
        // Try to fetch banking details for this branch
        const bankingResult = await SupabaseService.getBankingDetailsByBranch(branchTradingAs);
        if (bankingResult.success && bankingResult.data) {
          bankingDetails = {
            bank: bankingResult.data.bank_name || '',
            account: bankingResult.data.account_number || '',
            branch: bankingResult.data.branch_code || ''
          };
          console.log(`✅ Fetched banking details:`, bankingDetails);
        } else {
          console.log(`⚠️ Banking details not found for branch: ${branchTradingAs}`);
        }
      } else {
        console.log(`⚠️ Branch not found: ${branchTradingAs}, using defaults`);
      }

      // Try to parse sections and items
      let sections = [];
      let items = [];
      
      try {
        sections = JSON.parse(quoteData.sections || '[]');
      } catch (e) {
        console.error('Failed to parse sections:', e);
        sections = [{
          name: 'Custom Furniture',
          items: [{ description: 'Custom Furniture', quantity: 1, unitPrice: quoteData.subtotal || 0, total: quoteData.subtotal || 0 }],
          subtotal: quoteData.subtotal || 0,
          sectionTotal: quoteData.subtotal || 0
        }];
      }
      
      try {
        items = JSON.parse(quoteData.items || '[]');
      } catch (e) {
        console.error('Failed to parse items:', e);
        items = [{ description: 'Custom Furniture', quantity: 1, unitPrice: quoteData.subtotal || 0, total: quoteData.subtotal || 0 }];
      }

      // Construct invoice data using the actual quote data
      const invoiceData = {
        quoteId: quoteData.quote_number,
        customerName: quoteData.customer_name || 'Customer',
        customerEmail: quoteData.customer_email || '',
        customerPhone: quoteData.customer_phone || '',
        date: new Date().toISOString(),
        projectName: quoteData.project_name || 'Custom Furniture',
        sections,
        items,
        subtotal: quoteData.subtotal || 0,
        tax: quoteData.tax || 0,
        total: quoteData.total || 0,
        grandTotal: quoteData.total || 0,
        branchData,
        bankingDetails,
        edgingLength: quoteData.edging_length || 0,
        edgingCost: quoteData.edging_cost || 0
      };

      console.log('Generated invoice data from quote:', invoiceData.quoteId);
      
      // Generate PDF with isPaid=true to mark it as an invoice
      const invoiceResult2 = await generateQuotePdf(invoiceData, true);
      
      if (invoiceResult2 && invoiceResult2.buffer) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${quoteId}.pdf"`);
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
