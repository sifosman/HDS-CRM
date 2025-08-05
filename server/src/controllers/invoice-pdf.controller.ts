import { Request, Response } from 'express';
import SupabaseService from '../services/supabase.service';

export class InvoicePdfController {
  private supabaseService: SupabaseService;

  constructor() {
    this.supabaseService = new SupabaseService();
  }

  /**
   * Generate invoice PDF from quote data
   */
  async generateInvoicePdf(req: Request, res: Response): Promise<void> {
    try {
      const { quoteNumber, invoiceNumber } = req.body;

      if (!quoteNumber || !invoiceNumber) {
        res.status(400).json({
          success: false,
          error: 'quoteNumber and invoiceNumber are required'
        });
        return;
      }

      const result = await this.supabaseService.generateAndUploadInvoicePdf(
        quoteNumber,
        invoiceNumber
      );

      if (result.success) {
        res.json({
          success: true,
          publicUrl: result.publicUrl,
          message: 'Invoice PDF generated successfully'
        });
      } else {
        res.status(400).json(result);
      }
    } catch (error: any) {
      console.error('Error generating invoice PDF:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate invoice PDF'
      });
    }
  }

  /**
   * Get invoice details including PDF URL
   */
  async getInvoice(req: Request, res: Response): Promise<void> {
    try {
      const { invoiceNumber } = req.params;

      if (!invoiceNumber) {
        res.status(400).json({
          success: false,
          error: 'invoiceNumber is required'
        });
        return;
      }

      // This would typically fetch invoice details from database
      // For now, return a placeholder response
      res.json({
        success: true,
        invoiceNumber,
        message: 'Invoice details endpoint'
      });
    } catch (error: any) {
      console.error('Error fetching invoice:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch invoice'
      });
    }
  }

  /**
   * Regenerate invoice PDF
   */
  async regenerateInvoicePdf(req: Request, res: Response): Promise<void> {
    try {
      const { invoiceNumber } = req.params;

      if (!invoiceNumber) {
        res.status(400).json({
          success: false,
          error: 'invoiceNumber is required'
        });
        return;
      }

      // Implementation would be similar to generateInvoicePdf
      // but would fetch existing invoice data first
      res.json({
        success: true,
        message: 'Invoice PDF regeneration endpoint'
      });
    } catch (error: any) {
      console.error('Error regenerating invoice PDF:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to regenerate invoice PDF'
      });
    }
  }
}
