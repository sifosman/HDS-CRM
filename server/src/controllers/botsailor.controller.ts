import { Request, Response } from 'express';
import * as botsailorService from '../services/botsailor.service';
import * as ocrService from '../services/ocr-disabled.service';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';
import https from 'https';
import Cutlist from '../models/cutlist.model';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Botsailor Controller
 * Handles interactions with the Botsailor WhatsApp API
 */
// Botsailor webhook URL for sending cutting list links
const BOTSAILOR_WEBHOOK_URL = 'https://botsailor.com/webhook/whatsapp-workflow/145613.241603.253062.1760952893';

export const botsailorController = {
  /**
   * Check connection status with Botsailor
   */
  async getConnectionStatus(req: Request, res: Response) {
    try {
      const connectionStatus = await botsailorService.checkConnectionStatus();
      res.status(200).json({
        success: true,
        status: connectionStatus
      });
    } catch (error: any) {
      console.error('Error checking connection with Botsailor:', error);
      res.status(500).json({
        success: false,
        message: 'Error checking connection with Botsailor',
        error: error.message
      });
    }
  },
  
  /**
   * Process a WhatsApp image asynchronously to avoid Vercel timeout
   */
  processWhatsAppImageAsync: async (image_url: string, user_id: string, phone_number: string, sender_name: string) => {
    try {
      console.log('[DEBUG FLOW] Starting processWhatsAppImageAsync');
      // Use system tmp directory for serverless environments
      const uploadDir = os.tmpdir();
      console.log('Using temporary directory for uploads:', uploadDir);
      
      // Download the image
      console.log(`Downloading image from: ${image_url}`);
      const timestamp = Date.now();
      const randomSuffix = Math.floor(Math.random() * 10000);
      const imagePath = path.join(uploadDir, `whatsapp-${user_id}-${timestamp}-${randomSuffix}.jpg`);
      
      // Enhanced debugging for Botsailor image URLs
      console.log('Attempting to download image from Botsailor URL:', image_url);
      console.log('URL format check:', {
        protocol: image_url.startsWith('https://') ? 'https' : (image_url.startsWith('http://') ? 'http' : 'unknown'),
        containsWasabi: image_url.includes('wasabi') || image_url.includes('wasabisys'),
        containsS3: image_url.includes('bot-data.s3'),
        urlLength: image_url.length
      });
      
      // Simple direct download using native https module
      console.log('Attempting direct download using native https module...');
      try {
        // Create a writer stream to save the image
        const writer = fs.createWriteStream(imagePath);
        
        // Download the image using native https
        await new Promise<void>((resolve, reject) => {
          const request = https.get(image_url, {
            timeout: 30000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36',
              'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
              'Connection': 'keep-alive',
              'Referer': 'https://hds-sifosmans-projects.vercel.app/'
            },
            rejectUnauthorized: false // For debugging only
          }, (response) => {
            console.log('Download response status code:', response.statusCode);
            console.log('Download response headers:', JSON.stringify(response.headers));
            
            if (response.statusCode !== 200) {
              reject(new Error(`Failed to download image: HTTP status ${response.statusCode}`));
              return;
            }
            
            response.pipe(writer);
            
            writer.on('finish', () => {
              console.log('Image download completed and file written successfully');
              writer.close();
              resolve();
            });
            
            writer.on('error', (err) => {
              console.error('Error writing downloaded image to file:', err);
              writer.close();
              fs.unlink(imagePath, () => {}); // Attempt to clean up the file
              reject(err);
            });
          });
          
          request.on('error', (err) => {
            console.error('Error during https request:', err);
            writer.close();
            fs.unlink(imagePath, () => {}); // Attempt to clean up the file
            reject(err);
          });
          
          request.on('timeout', () => {
            console.error('Request timed out');
            request.destroy();
            writer.close();
            fs.unlink(imagePath, () => {}); // Attempt to clean up the file
            reject(new Error('Request timed out'));
          });
          
          // End the request
          request.end();
        });
        
        console.log('Direct download method succeeded');
      } catch (downloadError) {
        console.error('Error downloading image:', downloadError);
        throw new Error(`Failed to download image: ${downloadError instanceof Error ? downloadError.message : String(downloadError)}`);
      }
      console.log(`Image downloaded and saved to: ${imagePath}`);
      
      // Process the image with OCR
      console.log('Processing image with OCR...');
      const extractedData = await ocrService.processImageWithOCR(imagePath);
      console.log('OCR processing complete:', JSON.stringify(extractedData));
      
      // Save the cutting list data to the database
      const customerName = sender_name || 'Customer';
      const projectName = 'Cutting List Project';
      
      const newCutlist = new Cutlist({
        rawText: extractedData.rawText || '',
        dimensions: extractedData.dimensions || [],
        unit: extractedData.unit || 'mm',
        customerName: customerName,
        projectName: projectName,
        phoneNumber: phone_number || user_id
      });
      
      const savedCutlist = await newCutlist.save();
      console.log('Cutting list saved to database with ID:', savedCutlist._id);
      
      // Generate a link to the cutting list viewer
      const baseUrl = process.env.BASE_URL || 'https://hds-sifosmans-projects.vercel.app';
      const cutlistUrl = `${baseUrl}/api/cutlist/view/${savedCutlist._id}`;
      
      // Get the number of dimensions found
      const dimensionsCount = extractedData.dimensions?.length || 0;
      
      // Format a response message
      let responseMessage = `✅ *Your cutting list has been processed!*\n\n`;
      
      if (dimensionsCount > 0) {
        responseMessage += `📏 Found *${dimensionsCount} dimensions* in your image.\n\n`;
        
        // Add the first 5 dimensions to the message
        responseMessage += `*Dimensions (${extractedData.unit}):*\n`;
        extractedData.dimensions.slice(0, 5).forEach((dim, index) => {
          responseMessage += `${index + 1}. ${dim.width} x ${dim.length}`;
          if (dim.quantity > 1) {
            responseMessage += ` (${dim.quantity}pcs)`;
          }
          responseMessage += '\n';
        });
        
        if (dimensionsCount > 5) {
          responseMessage += `... and ${dimensionsCount - 5} more dimensions.\n`;
        }
      } else {
        responseMessage += `⚠️ No dimensions were found in your image. The quality might be too low or the format is not recognized.\n`;
      }
      
      // Add link to view the full cutting list
      responseMessage += `\n🔗 *View your complete cutting list here:*\n${cutlistUrl}\n\n`;
      responseMessage += `You can edit the dimensions and download the cutting list from this link.\n\n`;
      responseMessage += `💡 *Tip:* Save this link for future reference. You can always come back to view or edit your cutting list.`;
      
      // Try to send a WhatsApp message back to the user via Botsailor API
      try {
        // Check if we have the required environment variables
        const apiKey = process.env.BOTSAILOR_API_KEY;
        const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
        
        console.log('WhatsApp messaging configuration:', { 
          apiKeyPresent: !!apiKey, 
          phoneNumberIdPresent: !!phoneNumberId, 
          recipientPhonePresent: !!phone_number,
          apiKeyPart: apiKey ? apiKey.substring(0, 4) + '...' : 'missing',
          phoneNumberId: phoneNumberId || 'missing',
          recipientPhone: phone_number || 'missing'
        });
        
        // Format the phone number - ensure it includes country code and no special characters
        if (phone_number && !phone_number.startsWith('+')) {
          if (!phone_number.startsWith('1') && !phone_number.startsWith('61') && !phone_number.startsWith('27')) {
            // Assuming US/Canada (+1) as default if no country code
            phone_number = '1' + phone_number.replace(/[^0-9]/g, '');
            console.log('Formatted phone number with US country code:', phone_number);
          } else {
            // Just remove any non-numeric characters
            phone_number = phone_number.replace(/[^0-9]/g, '');
            console.log('Cleaned phone number format:', phone_number);
          }
        }
        
        if (apiKey && phoneNumberId && phone_number) {
          console.log(`Sending WhatsApp message to ${phone_number} via Botsailor API`);
          console.log('Message content preview:', responseMessage.substring(0, 100) + '...');
          
          // Construct the API request to Botsailor
          const messagePayload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: phone_number,
            type: 'text',
            text: { body: responseMessage },
            preview_url: true  // Enable link preview
          };
          
          console.log('Message payload:', JSON.stringify(messagePayload, null, 2));
          
          // Determine the correct Botsailor API endpoint
          const apiUrl = process.env.BOTSAILOR_API_URL || 'https://api.botsailor.com/v1';
          const botsailorEndpoint = `${apiUrl}/whatsapp/${phoneNumberId}/messages`;
          
          console.log(`Sending message to Botsailor API endpoint: ${botsailorEndpoint}`);
          
          // Send the message via Botsailor API
          try {
            const response = await axios.post(
              botsailorEndpoint,
              messagePayload,
              {
                headers: {
                  'Authorization': `Bearer ${apiKey}`,
                  'Content-Type': 'application/json'
                },
                timeout: 15000 // 15 second timeout
              }
            );
            
            console.log('Botsailor API response details:', {
              status: response.status,
              statusText: response.statusText,
              data: response.data,
              headers: response.headers
            });
            
            console.log('WhatsApp message sent successfully');
          } catch (apiError: any) {
            console.error('Error in Botsailor API call:', {
              message: apiError.message,
              status: apiError.response?.status,
              statusText: apiError.response?.statusText,
              responseData: apiError.response?.data,
              requestConfig: {
                url: apiError.config?.url,
                method: apiError.config?.method,
                headers: apiError.config?.headers
              }
            });
          }
        } else {
          console.log('Missing required configuration for WhatsApp messaging:');
          if (!apiKey) console.log('- Missing BOTSAILOR_API_KEY');
          if (!phoneNumberId) console.log('- Missing WHATSAPP_PHONE_NUMBER_ID');
          if (!phone_number) console.log('- Missing recipient phone number');
        }
      } catch (sendError) {
        console.error('Error in WhatsApp message preparation:', sendError);
      }
    } catch (error) {
      console.error('Error in async image processing:', error);
    }
  },

  /**
   * Send cutting list link to a WhatsApp number via Botsailor webhook
   */
  async sendCutlistLink(req: Request, res: Response) {
    try {
      const { cutlistId, phoneNumber, customerName } = req.body;
      
      if (!cutlistId || !phoneNumber) {
        return res.status(400).json({
          success: false,
          message: 'Missing required parameters: cutlistId or phoneNumber'
        });
      }
      
      // Validate cutlistId format
      if (!mongoose.Types.ObjectId.isValid(cutlistId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid cutlist ID format'
        });
      }
      
      // Get the cutlist from the database
      const cutlist = await Cutlist.findById(cutlistId);
      
      if (!cutlist) {
        return res.status(404).json({
          success: false,
          message: 'Cutlist not found'
        });
      }
      
      // Format phone number - ensure it has correct format for WhatsApp
      let formattedPhone = phoneNumber.replace(/[^0-9+]/g, '');
      if (!formattedPhone.startsWith('+')) {
        // Assume international format needed for WhatsApp
        formattedPhone = '+' + formattedPhone;
      }
      
      // Generate the cutlist URL
      const baseUrl = process.env.BASE_URL || 'https://hds-sifosmans-projects.vercel.app';
      const cutlistUrl = `${baseUrl}/cutlist-edit/${cutlistId}`;
      
      // Prepare the data to send to Botsailor webhook
      const webhookData = {
        recipient: formattedPhone,
        customer_name: customerName || cutlist.customerName || 'Customer',
        cutlist_url: cutlistUrl,
        dimensions_count: cutlist.dimensions?.length || 0,
        project_name: cutlist.projectName || 'Cutting List Project',
        template_parameters: [
          (customerName || cutlist.customerName || '').trim(),
          cutlistUrl
        ]
      };
      
      console.log('Sending data to Botsailor webhook:', webhookData);
      
      // Send the data to the Botsailor webhook
      const response = await axios.post(BOTSAILOR_WEBHOOK_URL, webhookData, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10 second timeout
      });
      
      console.log('Botsailor webhook response:', response.data);
      
      return res.status(200).json({
        success: true,
        message: 'Cutlist link sent to WhatsApp successfully',
        data: {
          phoneNumber: formattedPhone,
          cutlistUrl: cutlistUrl
        }
      });
    } catch (error: any) {
      console.error('Error sending cutlist link to WhatsApp:', error);
      return res.status(500).json({
        success: false,
        message: 'Error sending cutlist link to WhatsApp',
        error: error.message
      });
    }
  },
  
  /**
   * Receive webhook from WhatsApp
   */
  async receiveWhatsAppWebhook(req: Request, res: Response) {
    console.log('======= WEBHOOK DEBUG =======');
    console.log('Received WhatsApp webhook from Botsailor');
    console.log('Request headers:', JSON.stringify(req.headers));
    console.log('Request body:', JSON.stringify(req.body));
    console.log('Request method:', req.method);
    console.log('Request URL:', req.url);
    
    // Log the entire webhook structure in more detail for debugging
    console.log('DETAILED WEBHOOK PAYLOAD:');
    try {
      console.log(JSON.stringify(req.body, null, 2));
    } catch (e) {
      console.log('Could not stringify request body:', e);
    }
    console.log('============================');

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    // Immediately send a 200 response to acknowledge receipt of the webhook
    // This ensures Botsailor doesn't time out waiting for a response
    res.status(200).json({ 
      status: 'success', 
      message: 'Webhook received, processing request' 
    });
    
    // Process the webhook in the background without blocking the response
    (async () => {
      try {
        // Extract all possible fields for debugging
        console.log('Full webhook properties:');
        for (const key of Object.keys(req.body)) {
          console.log(`- ${key}:`, typeof req.body[key] === 'object' ? JSON.stringify(req.body[key]) : req.body[key]);
        }
        
        // Extract image URL and phone number from webhook payload
        let user_id = '';
        let phone_number = '';
        let sender_name = '';
        let image_url = '';
        let whatsapp_id = '';
        
        // Try to extract Botsailor conversation ID or other identifier
        if (req.body.conversation_id) whatsapp_id = req.body.conversation_id;
        if (req.body.whatsapp_id) whatsapp_id = req.body.whatsapp_id;
        if (req.body.chat_id) whatsapp_id = req.body.chat_id;
        if (req.body.id) whatsapp_id = req.body.id;
        
        console.log('WhatsApp conversation ID (if found):', whatsapp_id);

        // Check for user_input_data array in webhook payload
        if (req.body.user_input_data && Array.isArray(req.body.user_input_data)) {
          console.log('Found user_input_data array in webhook payload');
          console.log('user_input_data content:', JSON.stringify(req.body.user_input_data));

          // Look for question/answer pair with an image URL
          for (const item of req.body.user_input_data) {
            if (item.question === 'Do you have an image?' && item.answer && 
                (item.answer.startsWith('http://') || item.answer.startsWith('https://'))) {
              image_url = item.answer;
              console.log('Found image URL in user_input_data question/answer:', image_url);
              break;
            }
          }
        }

        // Try to extract sender information
        if (req.body.user_id) {
          user_id = req.body.user_id;
        } else if (req.body.from) {
          user_id = req.body.from;
        } else {
          // Generate a unique ID if none provided
          user_id = `user-${Date.now()}`;
        }

        // Try multiple possible locations for phone number
        if (req.body.phone_number) {
          phone_number = req.body.phone_number;
        } else if (req.body.sender?.phone_number) {
          phone_number = req.body.sender.phone_number;
        } else if (req.body.from) {
          // The 'from' field often contains the phone number in WhatsApp APIs
          phone_number = req.body.from;
        } else if (req.body.customer?.waId) {
          // Sometimes it's in the customer object
          phone_number = req.body.customer.waId;
        } else if (req.body.messages && Array.isArray(req.body.messages) && req.body.messages.length > 0) {
          // Meta/WhatsApp format often has a messages array with from property
          phone_number = req.body.messages[0].from || '';
        } else {
          // Use a default/fallback phone number if none provided
          phone_number = '12025550108';
          console.log('Using default phone number:', phone_number);
        }

        // Clean up phone number format if needed
        if (phone_number && !phone_number.startsWith('+')) {
          if (!phone_number.startsWith('1') && !phone_number.startsWith('61') && !phone_number.startsWith('27')) {
            // Assuming US/Canada (+1) as default if no country code
            phone_number = '1' + phone_number.replace(/[^0-9]/g, '');
          } else {
            // Just remove any non-numeric characters
            phone_number = phone_number.replace(/[^0-9]/g, '');
          }
        }
        console.log('Extracted phone number:', phone_number);

        // Try to get sender name
        if (req.body.sender_name) {
          sender_name = req.body.sender_name;
        } else if (req.body.sender?.name) {
          sender_name = req.body.sender.name;
        } else if (req.body.customer?.name) {
          sender_name = req.body.customer.name;
        } else {
          sender_name = 'WhatsApp User';
        }

        // Log the extracted data
        const extractedData = {
          user_id,
          phone_number,
          sender_name,
          whatsapp_id,
          image_url: image_url.length > 50 ? image_url.substring(0, 50) + '...' : image_url
        };
        console.log('Extracted data from webhook:', extractedData);

        // Since we're having issues with direct image download from Wasabi S3,
        // let's send a response message to the user with a web link as a temporary workaround
        try {
          // Check if we have the required environment variables for WhatsApp messaging
          const apiKey = process.env.BOTSAILOR_API_KEY;
          const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
          
          if (apiKey && phoneNumberId && phone_number) {
            console.log(`Sending WhatsApp response to ${phone_number} via Botsailor API`);
            
            // Create a message with a link to the web upload interface
            const baseUrl = process.env.BASE_URL || 'https://hds-sifosmans-projects.vercel.app';
            const uploadUrl = `${baseUrl}/upload?user=${encodeURIComponent(phone_number)}`;
            
            const responseMessage = 
              `📷 I received your image, but I'm having trouble processing it directly.\n\n` +
              `🔗 Please use this link to upload your cutting list image via our web interface:\n${uploadUrl}\n\n` +
              `This is a temporary solution while we fix the direct WhatsApp image processing.`;
            
            // Construct the API request to Botsailor
            const messagePayload = {
              messaging_product: 'whatsapp',
              recipient_type: 'individual',
              to: phone_number,
              type: 'text',
              text: { body: responseMessage },
              preview_url: true  // Enable link preview
            };
            
            console.log('Message payload:', JSON.stringify(messagePayload, null, 2));
            
            // Determine the correct Botsailor API endpoint
            const apiUrl = process.env.BOTSAILOR_API_URL || 'https://api.botsailor.com/v1';
            const botsailorEndpoint = `${apiUrl}/whatsapp/${phoneNumberId}/messages`;
            
            console.log(`Sending message to Botsailor API endpoint: ${botsailorEndpoint}`);
            
            console.log('About to send API request to Botsailor with the following configuration:');
            console.log('- Endpoint:', botsailorEndpoint);
            console.log('- API Key available:', !!apiKey);
            console.log('- Phone Number ID:', phoneNumberId);
            console.log('- Recipient Phone:', phone_number);
            
            try {
              // Send the message via Botsailor API
              const response = await axios.post(
                botsailorEndpoint,
                messagePayload,
                {
                  headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                  },
                  timeout: 15000 // 15 second timeout
                }
              );
              
              console.log('✅ Botsailor API response details:', {
                status: response.status,
                statusText: response.statusText,
                data: response.data
              });
              
              console.log('✅ WhatsApp response message sent successfully');
            } catch (apiError: any) {
              console.error('❌ Error sending message to Botsailor API:', {
                message: apiError.message,
                status: apiError.response?.status,
                statusText: apiError.response?.statusText,
                responseData: apiError.response?.data,
                code: apiError.code,
                url: apiError.config?.url
              });
              
              // Try alternate API URL if the default one fails
              if (apiError.code === 'ECONNREFUSED' || apiError.code === 'ETIMEDOUT') {
                console.log('⚠️ Attempting to use alternate Botsailor API endpoint');
                const alternateApiUrl = 'https://app.botsailor.com/api/v1';
                const alternateEndpoint = `${alternateApiUrl}/whatsapp/${phoneNumberId}/messages`;
                
                try {
                  const alternateResponse = await axios.post(
                    alternateEndpoint,
                    messagePayload,
                    {
                      headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                      },
                      timeout: 15000
                    }
                  );
                  
                  console.log('✅ Alternate Botsailor API response details:', {
                    status: alternateResponse.status,
                    statusText: alternateResponse.statusText,
                    data: alternateResponse.data
                  });
                  
                  console.log('✅ WhatsApp message sent successfully via alternate endpoint');
                } catch (altError: any) {
                  console.error('❌ Error sending message via alternate endpoint:', {
                    message: altError.message,
                    status: altError.response?.status,
                    responseData: altError.response?.data
                  });
                }
              }
            }
          } else {
            console.log('Missing required configuration for WhatsApp messaging:');
            if (!apiKey) console.log('- Missing BOTSAILOR_API_KEY');
            if (!phoneNumberId) console.log('- Missing WHATSAPP_PHONE_NUMBER_ID');
            if (!phone_number) console.log('- Missing recipient phone number');
          }
        } catch (sendError) {
          console.error('Error sending WhatsApp response:', sendError);
        }

      } catch (error) {
        // This won't affect the response since we've already sent it,
        // but we still log the error for debugging
        console.error('Error processing WhatsApp webhook (after response sent):', error);
      }
    })();
  }
};
