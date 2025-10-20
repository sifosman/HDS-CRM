import express, { Request, Response, RequestHandler } from 'express';
import axios from 'axios';
import SupabaseService from '../services/supabase.service';

const router = express.Router();

// Debug endpoint to test the n8n workflow and recipient value
router.post('/test-recipient', ((req: Request, res: Response) => {
  try {
    console.log('===== RECIPIENT DEBUG TEST =====');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    // Extract recipient value from various possible locations
    const directRecipient = req.body?.recipient;
    const phoneNumber = req.body?.phoneNumber;
    let recipientInCutlist;
    
    if (req.body?.cutlist) {
      if (typeof req.body.cutlist === 'string') {
        try {
          const parsed = JSON.parse(req.body.cutlist);
          recipientInCutlist = parsed.phoneNumber;
        } catch (e: any) {
          console.log('Failed to parse cutlist JSON:', e.message);
        }
      } else if (typeof req.body.cutlist === 'object') {
        recipientInCutlist = req.body.cutlist.phoneNumber;
      }
    }
    
    // Show all possible recipient values
    console.log('Recipient values found:');
    console.log('- req.body.recipient:', directRecipient);
    console.log('- req.body.phoneNumber:', phoneNumber);
    console.log('- From cutlist:', recipientInCutlist);
    
    // Return all possible values for comparison
    return res.status(200).json({
      success: true,
      message: 'Recipient debug test completed',
      recipientValues: {
        directRecipient,
        phoneNumber,
        recipientInCutlist,
        headers: req.headers
      },
      fullBody: req.body
    });
  } catch (error: any) {
    console.error('Error in recipient debug test:', error);
    return res.status(500).json({
      success: false,
      message: 'Error in recipient debug test',
      error: error.message
    });
  }
}) as unknown as RequestHandler);

// Debug endpoint to test Botsailor webhook with different recipient formats
router.post('/test-botsailor', ((req: Request, res: Response) => {
  (async () => {
    try {
      console.log('===== BOTSAILOR FORMAT TEST =====');
      
      const WEBHOOK_URL = 'https://botsailor.com/webhook/whatsapp-workflow/145613.241603.253062.1760952893';
      const recipient = req.body?.recipient || req.body?.phoneNumber;
      
      if (!recipient) {
        return res.status(400).json({
          success: false,
          message: 'No recipient provided'
        });
      }
      
      console.log('Testing with recipient:', recipient);
      
      // Try various formats to see which one works
      const formats = [
        {
          name: 'Standard recipient',
          payload: { recipient: recipient, message: 'Test message from Freecut debug tool' }
        },
        {
          name: 'phone_number field',
          payload: { phone_number: recipient, message: 'Test message from Freecut debug tool' }
        },
        {
          name: 'to field',
          payload: { to: recipient, message: 'Test message from Freecut debug tool' }
        },
        {
          name: 'phone field', 
          payload: { phone: recipient.replace('+', ''), message: 'Test message from Freecut debug tool' }
        }
      ];
      
      const results = [];
      
      for (const format of formats) {
        try {
          console.log(`Testing format: ${format.name}`);
          console.log('Payload:', JSON.stringify(format.payload, null, 2));
          
          const response = await axios.post(WEBHOOK_URL, format.payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
          });
          
          console.log(`Format ${format.name} succeeded with status ${response.status}`);
          console.log('Response:', response.data);
          
          results.push({
            format: format.name,
            success: true,
            status: response.status,
            data: response.data
          });
        } catch (error: any) {
          console.error(`Format ${format.name} failed:`, error.message);
          
          results.push({
            format: format.name,
            success: false,
            error: error.message,
            responseData: error.response?.data
          });
        }
      }
      
      return res.status(200).json({
        success: true,
        message: 'Botsailor format test completed',
        testRecipient: recipient,
        results: results
      });
    } catch (error: any) {
      console.error('Error in Botsailor format test:', error);
      return res.status(500).json({
        success: false,
        message: 'Error in Botsailor format test',
        error: error.message
      });
    }
  })();
}) as unknown as RequestHandler);

// Debug endpoint to test Supabase connection and cutlist creation
router.get('/test-supabase', ((req: Request, res: Response) => {
  (async () => {
    try {
      console.log('===== SUPABASE CONNECTION TEST =====');
      
      // Step 1: Test basic connection to Supabase
      const connectionResult = await SupabaseService.checkConnection();
      
      if (!connectionResult) {
        return res.status(500).json({
          success: false,
          message: 'Supabase connection test failed',
          error: 'Could not connect to Supabase'
        });
      }
      
      console.log('Basic connection test successful');
      
      // Step 2: Test material options query (existing functionality)
      const materialResult = await SupabaseService.getMaterialOptions();
      
      // Step 3: Test cutlist table by creating a test cutlist
      const testId = `test-${new Date().getTime()}`;
      const testCutlistData = {
        id: testId,
        customerName: 'Test Customer',
        phoneNumber: '+27123456789',
        ocrText: 'Test OCR Text\n800 x 400',
        cutPieces: [
          {
            length: 800,
            width: 400,
            quantity: 1,
            description: 'Test piece'
          }
        ],
        unit: 'mm'
      };
      
      console.log('Attempting to save test cutlist with ID:', testId);
      const saveResult = await SupabaseService.saveCutlist(testCutlistData);
      
      // Return all test results
      return res.status(200).json({
        success: true,
        message: 'Supabase tests completed',
        connectionTest: {
          success: connectionResult,
        },
        materialOptionsTest: {
          success: materialResult.success,
          categoriesCount: materialResult.success ? materialResult.data.categories.length : 0,
          error: !materialResult.success ? materialResult.error : null
        },
        cutlistSaveTest: {
          success: saveResult.success,
          testId: testId,
          data: saveResult.success ? saveResult.data : null,
          error: !saveResult.success ? saveResult.error : null
        },
        environment: {
          supabaseUrlConfigured: Boolean(process.env.SUPABASE_URL),
          supabaseKeyConfigured: Boolean(process.env.SUPABASE_ANON_KEY)
        }
      });
    } catch (error: any) {
      console.error('Error in Supabase test:', error);
      return res.status(500).json({
        success: false,
        message: 'Error in Supabase connection test',
        error: error.message || 'Unknown error'
      });
    }
  })();
}) as unknown as RequestHandler);

export default router;
