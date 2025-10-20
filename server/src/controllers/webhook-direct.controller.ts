import { Request, Response } from 'express';
import axios from 'axios';
import SupabaseService from '../services/supabase.service';
import { extractDimensionsFromText } from '../services/ocr-disabled.service';

// Hard-coded webhook URL for direct testing (updated)
const WEBHOOK_URL = 'https://botsailor.com/webhook/whatsapp-workflow/145613.241603.253062.1760952893';

/**
 * A simplified controller that contains only what's needed to 
 * directly test webhook communication, without any OCR or database dependencies
 */
export const webhookDirectController = {
  /**
   * Test the webhook with a direct payload
   */
  async testWebhook(req: Request, res: Response) {
    try {
      console.log('==== WEBHOOK DIRECT TEST ====');
      console.log('Testing webhook with direct payload to URL:', WEBHOOK_URL);
      
      // Send payload matching the Botsailor template webhook (variable 1 = name, 2 = URL)
      const testPayload = {
        recipient: '+27822222222',
        customer_name: 'Test User',
        cutlist_url: 'https://hds-nine.vercel.app/cutlist-edit/TEST-123',
        dimensions_count: 1,
        project_name: 'Cutting List Project',
        template_parameters: [
          'Test User',
          'https://hds-nine.vercel.app/cutlist-edit/TEST-123'
        ]
      };
      
      console.log('Sending test webhook with exact format:', testPayload);
      const response = await axios.post(WEBHOOK_URL, testPayload, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000,
        // Prevent axios from converting POST to GET on redirect; surface Location header instead
        maxRedirects: 0
      });
      
      console.log('Webhook test response:', response.status, response.statusText);
      console.log('Response data:', response.data);
      
      return res.status(200).json({
        success: true,
        message: 'Webhook test succeeded',
        response: {
          status: response.status,
          statusText: response.statusText,
          data: response.data
        }
      });
    } catch (error: any) {
      console.error('Webhook test error:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
        if (error.response.status >= 300 && error.response.status < 400) {
          console.error('Redirect Location:', error.response.headers?.location);
        }
      }
      
      return res.status(500).json({
        success: false,
        message: 'Webhook test failed',
        error: error.message
      });
    }
  },
  
  /**
   * Process n8n data with a super simplified approach
   */
  async processN8n(req: Request, res: Response) {
    try {
      console.log('==== DIRECT N8N PROCESSING ====');
      console.log('Request body:', JSON.stringify(req.body, null, 2));
      
      // Parse data from n8n
      let ocrText, phoneNumber, senderName;
      
      // Try to parse the cutlist JSON
      if (req.body.cutlist) {
        try {
          const cutlistData = JSON.parse(req.body.cutlist);
          ocrText = cutlistData.ocrText;
          phoneNumber = cutlistData.phoneNumber;
          senderName = cutlistData.senderName;
          console.log('Successfully parsed cutlist JSON');
        } catch (e) {
          console.error('Error parsing cutlist JSON, using raw value');
          ocrText = req.body.cutlist;
          phoneNumber = req.body.phoneNumber || '+27822222222';
          senderName = req.body.senderName || 'Test User';
        }
      } else {
        ocrText = req.body.ocrText;
        phoneNumber = req.body.phoneNumber || '+27822222222';
        senderName = req.body.senderName || 'Test User';
      }
      
      // Sanitize phone number
      if (phoneNumber) {
        // Remove any trailing newline characters
        phoneNumber = phoneNumber.replace(/\r?\n/g, '');
        
        // Ensure phone number starts with + for international format
        if (!phoneNumber.startsWith('+')) {
          phoneNumber = '+' + phoneNumber;
        }
        
        // Trim any whitespace
        phoneNumber = phoneNumber.trim();
        
        console.log(`Sanitized phone number: ${phoneNumber}`);
      }
      
      // Use a test phone number if the one provided is a placeholder
      if (phoneNumber === 'your_phone_number') {
        phoneNumber = '+27822222222';
      }
      
      // Generate a unique ID for this cutlist
      const uniqueId = new Date().getTime().toString();
      const baseUrl = process.env.BASE_URL || 'https://hds-sifosmans-projects.vercel.app';
      
      // Extract cut pieces using proper OCR parsing logic
      interface CutPiece {
        id: string;
        length: number;
        width: number;
        quantity: number;
        material: string;
        description: string;
        name: string;
      }
      
      let cutPieces: CutPiece[] = [];
      let dimensionsCount = 0;
      
      if (ocrText) {
        console.log('🔍 WEBHOOK: Starting OCR dimension extraction...');
        console.log('OCR Text preview:', ocrText.substring(0, 200) + '...');
        
        try {
          // Use the robust OCR parsing logic that handles HDS tables
          const extractionResult = extractDimensionsFromText(ocrText);
          
          if (extractionResult && extractionResult.dimensions && extractionResult.dimensions.length > 0) {
            console.log(`✅ WEBHOOK: Successfully extracted ${extractionResult.dimensions.length} dimensions using OCR service`);
            
            // Convert dimensions to cut pieces format expected by Supabase
            cutPieces = extractionResult.dimensions.map((dim: any, index: number) => {
              // Handle separator pieces differently
              if (dim.separator) {
                console.log(`🔗 WEBHOOK: Processing separator piece: ${dim.name}`);
                return {
                  id: `${uniqueId}-${index}`,
                  separator: true,
                  name: dim.name,
                  material: dim.material,
                  description: dim.description || dim.name,
                  length: 0,
                  width: 0,
                  quantity: 0
                };
              }
              
              // Handle regular dimension pieces
              return {
                id: `${uniqueId}-${index}`,
                length: dim.length,
                width: dim.width, 
                quantity: dim.quantity,
                material: dim.material || 'White Melamine',
                description: dim.description || `${dim.length}x${dim.width}`,
                name: dim.description || `${dim.length}x${dim.width}`
              };
            });
            
            dimensionsCount = extractionResult.dimensions.length;
            
            console.log('📊 WEBHOOK: Cut pieces prepared for Supabase:', cutPieces.map((cp: any) => 
              `${cp.length}x${cp.width} (qty: ${cp.quantity})`
            ).join(', '));
          } else {
            console.log('⚠️ WEBHOOK: OCR service returned no dimensions, falling back to basic regex');
            
            // Fallback to basic regex for non-HDS formats
            const lines = ocrText.split('\n');
            for (const line of lines) {
              if (/\d+\s*[xX]\s*\d+/.test(line)) {
                const match = line.match(/(\d+)\s*[xX]\s*(\d+)/);
                if (match) {
                  const [_, length, width] = match;
                  cutPieces.push({
                    id: `${uniqueId}-${cutPieces.length}`,
                    length: parseInt(length),
                    width: parseInt(width),
                    quantity: 1,
                    material: 'White Melamine',
                    description: line.trim(),
                    name: line.trim()
                  });
                }
              }
            }
            dimensionsCount = cutPieces.length;
          }
        } catch (error) {
          console.error('❌ WEBHOOK: Error in OCR dimension extraction:', error);
          
          // Fallback to basic regex on error
          const lines = ocrText.split('\n');
          for (const line of lines) {
            if (/\d+\s*[xX]\s*\d+/.test(line)) {
              const match = line.match(/(\d+)\s*[xX]\s*(\d+)/);
              if (match) {
                const [_, length, width] = match;
                cutPieces.push({
                  id: `${uniqueId}-${cutPieces.length}`,
                  length: parseInt(length),
                  width: parseInt(width),
                  quantity: 1,
                  material: 'White Melamine',
                  description: line.trim(),
                  name: line.trim()
                });
              }
            }
          }
          dimensionsCount = cutPieces.length;
        }
      }
      
      console.log(`📈 WEBHOOK: Final cut pieces count: ${cutPieces.length}`);
      console.log('📋 WEBHOOK: Cut pieces summary:', cutPieces.map((cp: any) => `${cp.length}x${cp.width}(${cp.quantity})`).join(', '));
      
      // Save cutlist data to Supabase
      const cutlistData = {
        id: uniqueId,
        customerName: senderName,
        phoneNumber: phoneNumber,
        ocrText: ocrText,
        cutPieces: cutPieces,
        unit: 'mm' // Default unit
      };
      
      // First check if Supabase is connected
      console.log('Checking Supabase connection...');
      const connectionResult = await SupabaseService.checkConnection();
      
      if (!connectionResult) {
        console.error('Supabase connection check failed');
        return res.status(500).json({
          success: false,
          message: 'Failed to connect to database',
          error: 'Supabase connection error'
        });
      }
      
      console.log('Supabase connection OK, attempting to save cutlist:', JSON.stringify(cutlistData, null, 2));
      
      // Try to save cutlist to Supabase with detailed error logging
      try {
        const saveResult = await SupabaseService.saveCutlist(cutlistData);
        
        if (!saveResult.success) {
          console.error('Failed to save cutlist - explicit error:', saveResult.error);
          return res.status(500).json({
            success: false,
            message: 'Failed to save cutlist data',
            error: saveResult.error || 'Unknown database error'
          });
        }
      } catch (error: any) {
        console.error('Exception during cutlist save operation:', error);
        return res.status(500).json({
          success: false,
          message: 'Exception occurred while saving cutlist data',
          error: error?.message || 'Unknown error'
        });
      }
      
      console.log('Cutlist saved successfully with ID:', uniqueId);
      
      // Use the cutlist-edit URL with the unique ID
      const cutlistUrl = `${baseUrl}/cutlist-edit/${uniqueId}`;
      
      // Extract potential product codes from OCR text
      // This is a simplified example - in production you'd need proper parsing based on your specific format
      const productCodesRegex = /(?:product|item)\s*(?:code|id)?[:\s]*(\w+)/gi;
      const productCodes: string[] = [];
      let match;
      
      while ((match = productCodesRegex.exec(ocrText)) !== null) {
        productCodes.push(match[1]);
      }
      
      // If no product codes found from regex, use some default test codes
      if (productCodes.length === 0) {
        // Add some sample product codes for testing
        productCodes.push('BOARD001');
        productCodes.push('EDGE002');
      }
      
      console.log('Extracted product codes:', productCodes);
      
      // Attempt to get pricing from Supabase
      let pricingData = [];
      let quoteUrl = '';
      let quoteId = '';
      
      try {
        // Get pricing for each product code
        for (const code of productCodes) {
          try {
            const pricing = await SupabaseService.getProductPricing(code);
            if (pricing && pricing.success) {
              pricingData.push({
                productCode: code,
                price: pricing.data, // This would need parsing based on the actual response structure
              });
            }
          } catch (pricingError) {
            console.error(`Error getting pricing for product ${code}:`, pricingError);
          }
        }
        
        // If pricing data was successfully retrieved, create a quote
        if (pricingData.length > 0) {
          try {
            // Sample quote creation - in production, you'd construct this from the actual data
            const quoteData = {
              customerName: senderName,
              customerEmail: req.body.email || 'customer@example.com',
              customerTelephone: phoneNumber,
              cutlistUrl: cutlistUrl,
              items: pricingData.map(item => ({
                stockCode: item.price.productCode,
                description: item.price.description || `Product ${item.productCode}`,
                quantity: 1,
                priceExclusive: item.price?.price || 100, // Default price if not found
                lineTotal: item.price?.price || 100,
              })),
              total: pricingData.reduce((sum, item) => sum + (item.price?.price || 100), 0),
            };
            
            const quoteResult = await SupabaseService.createQuote(quoteData);
            if (quoteResult && quoteResult.success) {
              quoteId = quoteResult.data?.quoteNumber || 'Q' + uniqueId;
              quoteUrl = `${baseUrl}/quote/${quoteId}`;
              console.log('Quote created successfully:', quoteId);
            }
          } catch (quoteError) {
            console.error('Error creating quote:', quoteError);
          }
        }
      } catch (supabaseError) {
        console.error('Error interacting with Supabase:', supabaseError);
      }
      
      console.log('Sending webhook with data:', {
        phoneNumber,
        cutlistUrl,
        dimensionsCount,
        senderName,
        pricingFound: pricingData.length > 0,
        quoteCreated: !!quoteId
      });
      
      // Send using the Botsailor webhook template payload
      try {
        const payload = {
          recipient: phoneNumber,
          customer_name: senderName || 'Customer',
          cutlist_url: cutlistUrl,
          dimensions_count: dimensionsCount,
          project_name: 'Cutting List Project',
          template_parameters: [
            (senderName || 'Customer').trim(),
            cutlistUrl
          ]
        };

        console.log('WEBHOOK DEBUG: Sending Botsailor template payload:', payload);

        const response = await axios.post(WEBHOOK_URL, payload, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000,
          // Avoid following redirects that could switch POST to GET
          maxRedirects: 0
        });
        
        console.log('Webhook sent successfully:', response.status);
        return res.status(200).json({
          success: true,
          message: 'Webhook sent successfully',
          payload: payload,
          response: {
            status: response.status,
            data: response.data
          },
          additionalData: {
            quoteId: quoteId || null,
            quoteUrl: quoteUrl || null,
            customerName: senderName,
            dimensionsCount: dimensionsCount,
            pricingFound: pricingData.length > 0
          }
        });
      } catch (error: any) {
        console.error('Webhook sending failed:', error.message);
        if (error.response) {
          console.error('Response status:', error.response.status);
          console.error('Response data:', error.response.data);
          if (error.response.status >= 300 && error.response.status < 400) {
            console.error('Redirect Location:', error.response.headers?.location);
          }
        }
        
        return res.status(500).json({
          success: false,
          message: 'Webhook sending failed',
          error: error.message,
          errorResponse: error.response?.data
        });
      }
    } catch (error: any) {
      console.error('Error processing n8n data:', error.message);
      return res.status(500).json({
        success: false,
        message: 'Error processing n8n data',
        error: error.message
      });
    }
  }
};
