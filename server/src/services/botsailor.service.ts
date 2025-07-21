import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

// Get Botsailor API configuration from environment variables
const BOTSAILOR_API_URL = process.env.BOTSAILOR_API_URL || 'https://www.botsailor.com/api/v1';
const BOTSAILOR_API_KEY = process.env.BOTSAILOR_API_KEY || '';

// Create axios instance for Botsailor API
const botsailorApi = axios.create({
  baseURL: BOTSAILOR_API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${BOTSAILOR_API_KEY}`
  }
});

/**
 * Check the connection status with Botsailor
 */
export const checkConnectionStatus = async (): Promise<{ connected: boolean; message: string }> => {
  try {
    const response = await botsailorApi.get('/status');
    return {
      connected: response.status === 200,
      message: 'Connection to Botsailor established'
    };
  } catch (error) {
    console.error('Botsailor connection error:', error);
    return {
      connected: false,
      message: 'Failed to connect to Botsailor API'
    };
  }
};

/**
 * Process incoming data from Botsailor
 */
export const processIncomingData = async (data: any, type: string): Promise<any> => {
  // Validate and process incoming data based on type
  switch (type) {
    case 'project':
      return processProjectData(data);
    case 'material':
      return processMaterialData(data);
    case 'stock':
      return processStockData(data);
    case 'cutlist':
      return processCutlistData(data);
    default:
      throw new Error(`Unsupported data type: ${type}`);
  }
};

/**
 * Send data to Botsailor
 */
export const sendDataToBotsailor = async (data: any, type: string): Promise<any> => {
  try {
    // Transform data to Botsailor format if needed
    const transformedData = transformDataForBotsailor(data, type);

    // Send data to Botsailor API
    const response = await botsailorApi.post(`/${type}`, transformedData);

    return {
      success: true,
      id: response.data.id,
      message: `Data sent to Botsailor successfully`
    };
  } catch (error) {
    console.error('Error sending data to Botsailor:', error);
    throw error;
  }
};

/**
 * Sync project with Botsailor
 */
export const syncProjectWithBotsailor = async (projectId: string, direction: 'push' | 'pull' = 'push'): Promise<any> => {
  try {
    if (direction === 'push') {
      // Get project data from our database
      // This is a placeholder - implement actual project retrieval
      const projectData = { id: projectId, name: 'Sample Project' };

      // Send to Botsailor
      return await sendDataToBotsailor(projectData, 'project');
    } else {
      // Pull from Botsailor
      const response = await botsailorApi.get(`/project/${projectId}`);

      // Process and save to our database
      // This is a placeholder - implement actual project saving
      return {
        success: true,
        project: response.data,
        message: 'Project pulled from Botsailor successfully'
      };
    }
  } catch (error) {
    console.error('Error syncing project with Botsailor:', error);
    throw error;
  }
};

/**
 * Get available materials from Botsailor
 */
export const getAvailableMaterials = async (): Promise<any[]> => {
  try {
    const response = await botsailorApi.get('/materials');
    return response.data.materials || [];
  } catch (error) {
    console.error('Error fetching materials from Botsailor:', error);
    throw error;
  }
};

/**
 * Get available stock pieces from Botsailor
 */
export const getAvailableStockPieces = async (materialId: string): Promise<any[]> => {
  try {
    const response = await botsailorApi.get(`/stock?materialId=${materialId}`);
    return response.data.stockPieces || [];
  } catch (error) {
    console.error('Error fetching stock pieces from Botsailor:', error);
    throw error;
  }
};

// Helper functions for data processing

const processProjectData = (data: any): any => {
  // Process project data from Botsailor
  // This is a placeholder - implement actual processing
  return {
    id: data.id || uuidv4(),
    name: data.name,
    description: data.description,
    materials: data.materials || [],
    cutPieces: data.cutPieces || [],
    stockPieces: data.stockPieces || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
};

const processMaterialData = (data: any): any => {
  // Process material data from Botsailor
  // This is a placeholder - implement actual processing
  return {
    id: data.id || uuidv4(),
    name: data.name,
    type: data.type,
    thickness: data.thickness,
    properties: data.properties || {}
  };
};

const processStockData = (data: any): any => {
  // Process stock data from Botsailor
  // This is a placeholder - implement actual processing
  return {
    id: data.id || uuidv4(),
    materialId: data.materialId,
    width: data.width,
    length: data.length,
    quantity: data.quantity || 1,
    properties: data.properties || {}
  };
};

const processCutlistData = (data: any): any => {
  // Process cutlist data from Botsailor
  // This is a placeholder - implement actual processing
  return {
    id: data.id || uuidv4(),
    projectId: data.projectId,
    cutPieces: data.cutPieces || [],
    stockPieces: data.stockPieces || [],
    createdAt: new Date().toISOString()
  };
};

const transformDataForBotsailor = (data: any, type: string): any => {
  // Transform data to Botsailor format based on type
  // This is a placeholder - implement actual transformation
  switch (type) {
    case 'project':
      return {
        id: data.id,
        name: data.name,
        description: data.description,
        materials: data.materials,
        cutPieces: data.cutPieces,
        stockPieces: data.stockPieces
      };
    case 'cutlist':
      return {
        projectId: data.projectId,
        cutPieces: data.cutPieces,
        stockPieces: data.stockPieces
      };
    default:
      return data;
  }
};

/**
 * Process an image with OCR to extract cutting list data
 * @param imagePath Path to the uploaded image
 * @returns Extracted cutting list data
 */
export const processImageWithOCR = async (imagePath: string): Promise<any> => {
  try {
    // In a real implementation, we would use Google Cloud Vision API here
    // For now, we'll use a mock implementation that returns sample data

    // Read the image file to simulate processing
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Image file not found at path: ${imagePath}`);
    }

    // Log that we're processing the image
    console.log(`Processing image: ${imagePath}`);

    // Simulate OCR text extraction
    // In a real implementation, this would be the result from Google Cloud Vision API
    const mockText = `Cutting List
      800 x 600 2pcs
      400 x 300 4pcs
      2440 x 1220 1pc
    `;

    // Process the extracted text to identify cutting list items
    const extractedData = parseOCRText(mockText);

    return extractedData;
  } catch (error) {
    console.error('OCR processing error:', error);
    throw error;
  }
};

/**
 * Parse OCR text to extract cutting list data
 * @param text The OCR extracted text
 * @returns Structured cutting list data
 */
export const parseOCRText = (text: string): any => {
  console.log('Starting OCR text parsing...');
  console.log('Raw text received for parsing:\n', text);

  // Define types for our result structure
  type StockPiece = {
    id: string;
    width: number;
    length: number;
    quantity: number;
    material: string;
  };

  type CutPiece = {
    description?: string;
    id: string;
    width: number;
    length: number;
    quantity: number;
    name: string;
    material?: string; // Added material reference
  };

  type Material = {
    id: string;
    name: string;
    type: string;
    thickness: number;
  };

  type ResultData = {
    stockPieces: StockPiece[];
    cutPieces: CutPiece[];
    materials: Material[];
    unit: string;
  };

  // Initialize result structure
  const result: ResultData = {
    stockPieces: [],
    cutPieces: [],
    materials: [],
    unit: 'mm' // Default unit
  };

  const lines = text.split('\n').filter(line => line.trim() !== '');
  console.log(`Processing ${lines.length} lines of text...`);

  // Check if this is an HDS cutting list format (only for official HDS forms)
  const isHDSFormat = text.includes('HDS') && 
                     (text.includes('Height/Length') || text.includes('Width')) && 
                     text.includes('Edging');
  console.log(`Detected HDS format: ${isHDSFormat}`);

  if (isHDSFormat) {
    // Parse HDS table format (for official HDS forms only)
    return parseHDSTableFormat(text, result);
  } else {
    // Use handwritten format parsing (can handle both simple formats and material sections)
    return parseHandwrittenFormat(text, result);
  }
};

/**
 * Parse HDS cutting list table format
 * @param text The OCR extracted text
 * @param result The result structure to populate
 * @returns Structured cutting list data
 */
const parseHDSTableFormat = (text: string, result: any): any => {
  console.log('Parsing HDS table format...');
  
  const lines = text.split('\n').filter(line => line.trim() !== '');
  let inTableData = false;
  let tableStartIndex = -1;
  
  // Find where the table data starts (after headers)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Look for the header row or first data row
    if (line.includes('Height/Length') || line.includes('Width') || line.includes('Qty')) {
      tableStartIndex = i + 1; // Start after header
      inTableData = true;
      break;
    }
    // Alternative: look for first row with number pattern
    if (/^\d+\s+/.test(line)) {
      tableStartIndex = i;
      inTableData = true;
      break;
    }
  }
  
  console.log(`Table data starts at line ${tableStartIndex}`);
  
  if (tableStartIndex === -1) {
    console.log('Could not find table start, falling back to simple parsing');
    return parseSimpleFormat(text, result);
  }
  
  // Parse each table row
  for (let i = tableStartIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines and footer lines
    if (!line || line.includes('Date:') || line.includes('Client Signed:') || line.includes('X76')) {
      continue;
    }
    
    console.log(`Parsing table row ${i}: "${line}"`);
    
    // Extract numbers from the line - HDS format typically has:
    // No. | Height/Length | Width | Qty | Edging Length | Edging Width | Pot Holes
    const numbers = line.match(/\d+/g);
    
    if (numbers && numbers.length >= 3) {
      // Skip the row number (first number) and extract dimensions
      let rowNum, height, width, qty;
      
      // Try to identify the pattern
      if (numbers.length >= 4) {
        rowNum = parseInt(numbers[0]);
        height = parseInt(numbers[1]);
        width = parseInt(numbers[2]);
        qty = parseInt(numbers[3]);
      } else if (numbers.length === 3) {
        // Sometimes row number might be missing
        height = parseInt(numbers[0]);
        width = parseInt(numbers[1]);
        qty = parseInt(numbers[2]);
      }
      
      // Validate the extracted values
      if (height && width && qty && height > 0 && width > 0 && qty > 0) {
        // Filter out unrealistic values (likely parsing errors)
        if (height > 10000 || width > 10000 || qty > 100) {
          console.log(`Skipping unrealistic values: ${height}x${width}, qty: ${qty}`);
          continue;
        }
        
        result.cutPieces.push({
          id: uuidv4(),
          length: Math.max(height, width), // Larger dimension as length
          width: Math.min(height, width),  // Smaller dimension as width
          quantity: qty,
          name: `Piece ${result.cutPieces.length + 1}`,
          description: line.trim()
        });
        
        console.log(`Added HDS cut piece: ${Math.max(height, width)}x${Math.min(height, width)}, Qty: ${qty}`);
      } else {
        console.log(`Invalid dimensions found in line: "${line}"`);
      }
    } else {
      console.log(`Not enough numbers found in line: "${line}"`);
    }
  }
  
  console.log(`HDS parsing complete. Found ${result.cutPieces.length} cut pieces.`);
  return result;
};

/**
 * Parse simple format (existing logic)
 * @param text The OCR extracted text
 * @param result The result structure to populate
 * @returns Structured cutting list data
 */
/**
 * Parse handwritten format with support for material sections
 * @param text The OCR extracted text
 * @param result The result structure to populate
 * @returns Structured cutting list data
 */
const parseHandwrittenFormat = (text: string, result: any): any => {
  console.log('Parsing handwritten format with material section support...');
  
  const lines = text.split('\n').filter(line => line.trim() !== '');
  
  // More robust regex patterns to find dimensions and quantities
  const dimensionPatterns = [
    // Pattern 1: 1000x500=2, 1000 x 500 = 2, 1000*500=2, etc.
    /(\d+)\s*[xX×*]\s*(\d+)\s*[=\-\s]\s*(\d+)/,
    // Pattern 2: 1000x500 (2), 1000 x 500 (2)
    /(\d+)\s*[xX×*]\s*(\d+)\s*\((\d+)\)/,
    // Pattern 3: 1000x500 2pcs, 1000x500 2 pc, etc.
    /(\d+)\s*[xX×*]\s*(\d+)\s+(\d+)\s*(?:pcs?|pieces?|pce|szt|x)/i,
    // Pattern 4: 1000x500, quantity is on the same line but separated
    /(\d+)\s*[xX×*]\s*(\d+)/, // fallback no qty
  ];

  // Material section detection keywords (non-numeric words)
  const materialKeywords = ['white', 'door', 'doors', 'drawer', 'drawers', 'microwave', 'masonite', 'oak', 'wood', 'panel'];
  
  // Track current material section
  let currentMaterial = 'Default';
  let materialCounter = 0;

  // First pass: identify material sections
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim().toLowerCase();
    
    // Skip lines with just dimensions
    if (isDimensionLine(line, dimensionPatterns)) {
      continue;
    }
    
    // Check if this line might be a material section header
    // Material headers typically don't have dimension patterns but might contain material keywords
    for (const keyword of materialKeywords) {
      if (line.includes(keyword)) {
        // This is likely a material section header
        const materialName = line.charAt(0).toUpperCase() + line.slice(1);
        result.materials.push({
          id: uuidv4(),
          name: materialName,
          type: 'board',
          thickness: 16 // Default thickness
        });
        currentMaterial = materialName;
        materialCounter++;
        console.log(`Detected material section: ${materialName}`);
        break;
      }
    }
  }

  // If no materials were detected, add a default one
  if (result.materials.length === 0) {
    result.materials.push({
      id: uuidv4(),
      name: 'Default',
      type: 'board',
      thickness: 16
    });
  }

  // Reset for second pass
  currentMaterial = result.materials[0].name;
  
  // Second pass: process dimensions under each material section
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    console.log(`Parsing line ${i + 1}: "${line}"`);
    
    // Check if this line might be a material section change
    const lowerLine = line.toLowerCase();
    let isMaterialHeader = false;
    
    // Check if the line contains any material keywords
    for (const keyword of materialKeywords) {
      if (lowerLine.includes(keyword)) {
        // Find the corresponding material
        for (const material of result.materials) {
          if (material.name.toLowerCase().includes(keyword)) {
            currentMaterial = material.name;
            isMaterialHeader = true;
            console.log(`Switching to material section: ${currentMaterial}`);
            break;
          }
        }
        if (isMaterialHeader) break;
      }
    }
    
    // Skip material headers for dimension processing
    if (isMaterialHeader) continue;
    
    // Process dimension lines
    let matched = false;
    let width = 0, length = 0, quantity = 0;

    // Try each dimension pattern
    for (const pattern of dimensionPatterns) {
      const match = line.match(pattern);
      if (match) {
        // Get first two numbers as dimensions
        length = parseInt(match[1]);
        width = parseInt(match[2]);
        
        // Get quantity from third group if available
        quantity = match[3] ? parseInt(match[3]) : 0;

        if (!isNaN(width) && !isNaN(length) && width > 0 && length > 0) {
          console.log(`Pattern matched: ${pattern}. Length=${length}, Width=${width}, Quantity=${quantity}`);
          
          // If quantity is still 0, try to find it in the rest of the string
          if (quantity === 0) {
            const remainder = line.substring(match[0].length).trim();
            console.log(`No quantity in main pattern. Checking remainder: "${remainder}"`);
            
            // Look for a number followed by x or just a number
            const quantityMatch = remainder.match(/([0-9]+)\s*(?:x|pcs?|pieces?|pc|ea)?/i);
            if (quantityMatch && quantityMatch[1]) {
              quantity = parseInt(quantityMatch[1]);
              console.log(`Found quantity in remainder: ${quantity}`);
            }
          }
          matched = true;
          break;
        }
      }
    }

    // Fallback: if no pattern matched, try simple numeric extraction
    if (!matched) {
      const nums = line.match(/\d+/g)?.map(n => parseInt(n));
      if (nums && nums.length >= 2) {
        // Check if there are at least 3 numbers (likely length, width, qty)
        if (nums.length >= 3) {
          length = nums[0];
          width = nums[1];
          quantity = nums[2];
        } else {
          // Only 2 numbers - assume length and width
          length = nums[0];
          width = nums[1];
          quantity = 1; // Default quantity
          
          // Check if line has any quantity indicators
          const quantityIndicators = ['x', 'pcs', 'pc', 'pieces', 'piece'];
          for (const indicator of quantityIndicators) {
            if (line.toLowerCase().includes(indicator)) {
              const parts = line.split(indicator);
              if (parts.length > 1) {
                const potentialQty = parseInt(parts[1].trim());
                if (!isNaN(potentialQty) && potentialQty > 0) {
                  quantity = potentialQty;
                  break;
                }
              }
            }
          }
        }
        matched = true;
        console.log(`Fallback numeric parse -> length ${length}, width ${width}, quantity ${quantity}`);
      }
    }

    // Add the piece if we found valid dimensions
    if (matched && length > 0 && width > 0) {
      // If quantity is still not found, default to 1
      if (quantity === 0) {
        quantity = 1;
        console.log('Quantity not found, defaulting to 1.');
      }
      
      // Final validation: limit dimensions and quantity to reasonable values
      // This helps catch OCR errors with unrealistic numbers
      if (length > 5000) length = 1000;
      if (width > 5000) width = 500;
      if (quantity > 100) quantity = 1;

      result.cutPieces.push({
        id: uuidv4(),
        length,
        width,
        quantity,
        material: currentMaterial,
        name: `${currentMaterial} Piece ${result.cutPieces.length + 1}`,
        description: line // Store the original line for reference
      });
      console.log(`Added cut piece: ${length}x${width}, Qty: ${quantity}, Material: ${currentMaterial}`);
    } else {
      console.log(`No valid dimension found in line: "${line}"`);
    }
  }

  console.log('Handwritten format parsing complete.');
  console.log('Final extracted data:', JSON.stringify(result, null, 2));
  return result;
};

/**
 * Check if a line contains dimension patterns
 * @param line The line to check
 * @param patterns Array of regex patterns for dimensions
 * @returns True if the line contains dimensions
 */
const isDimensionLine = (line: string, patterns: RegExp[]): boolean => {
  // Check if line has dimension pattern
  for (const pattern of patterns) {
    if (pattern.test(line)) {
      return true;
    }
  }
  
  // Check if line has at least 2 numbers (possible length/width)
  const numbers = line.match(/\d+/g);
  if (numbers && numbers.length >= 2) {
    return true;
  }
  
  return false;
};

/**
 * Parse simple format (kept for backward compatibility)
 * @param text The OCR extracted text
 * @param result The result structure to populate
 * @returns Structured cutting list data
 */
const parseSimpleFormat = (text: string, result: any): any => {
  console.log('Parsing simple format (DEPRECATED - using handwritten format instead)...');
  // Call the more robust handwritten format parser instead
  return parseHandwrittenFormat(text, result);
};

/**
 * Send WhatsApp confirmation message with the extracted cutting list data
 * @param phoneNumber The customer's phone number
 * @param extractedData The extracted cutting list data
 * @param customerName The customer's name
 * @param projectName The project name
 * @returns WhatsApp message sending result
 */
export const sendWhatsAppConfirmation = async (
  phoneNumber: string,
  extractedData: any,
  customerName: string,
  projectName: string
): Promise<any> => {
  try {
    // Format the message content (for both regular and template messages)
    const formattedMessage = formatWhatsAppMessage(extractedData, customerName, projectName);

    console.log(`Preparing to send WhatsApp message to ${phoneNumber}`);
    
    // Get WhatsApp phone number ID from environment variable
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
    const templateName = process.env.WHATSAPP_TEMPLATE_NAME || 'cutlist_results';
    
    if (!phoneNumberId) {
      console.warn('WHATSAPP_PHONE_NUMBER_ID environment variable is not set');
      console.warn('Using fallback message logging instead of sending via Botsailor API');
      console.log(formattedMessage);
      
      return {
        success: false,
        message: 'WhatsApp message not sent - missing phone_number_id',
        phoneNumber,
        timestamp: new Date().toISOString()
      };
    }
    
    // For debugging - always log the message we're trying to send
    console.log('Formatted WhatsApp message to send:', formattedMessage);
    
    // Get the number of dimensions found (if available)
    const dimensionsCount = extractedData.dimensionsCount || 
                           (extractedData.dimensions ? extractedData.dimensions.length : 0);
    
    // Get the URL to the cutting list viewer (if available)
    const cutlistUrl = extractedData.cutlistUrl || '';
    
    // Create a simple template message structure with minimal content
    // This is much more likely to be approved by WhatsApp
    const templateMessage = {
      name: templateName,
      language: { code: 'en' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: customerName || 'Customer' },
            { type: 'text', text: projectName || 'Cutting List Project' },
            { type: 'text', text: dimensionsCount.toString() },
            { type: 'text', text: cutlistUrl }
          ]
        }
      ]
    };
    
    // Log template structure for debugging
    console.log('Template message structure:', JSON.stringify(templateMessage));
    
    // Try to send message - first attempt using template
    try {
      console.log('Attempting to send WhatsApp template message...');
      
      const templateResponse = await axios.post(`${BOTSAILOR_API_URL}/whatsapp/send-template`, {
        apiToken: BOTSAILOR_API_KEY,
        phone_number_id: phoneNumberId,
        template: templateMessage,
        phone_number: phoneNumber.replace(/\+/g, '') // Remove + if present (API requires only numeric characters)
      });
      
      console.log('Botsailor WhatsApp template API response:', templateResponse.data);
      
      if (templateResponse.data && templateResponse.data.status === '1') {
        return {
          success: true,
          message: 'WhatsApp template message sent successfully via Botsailor API',
          response: templateResponse.data,
          phoneNumber,
          timestamp: new Date().toISOString(),
          method: 'template'
        };
      } else {
        console.warn('Template message failed, falling back to regular message...');
        // Continue to try regular message as fallback
      }
    } catch (templateError) {
      console.error('Error sending template message:', templateError);
      console.warn('Template message failed, falling back to regular message...');
      // Continue to try regular message as fallback
    }
    
    // Fallback: try to send as regular message
    console.log('Attempting to send regular WhatsApp message...');
    const response = await axios.post(`${BOTSAILOR_API_URL}/whatsapp/send`, {
      apiToken: BOTSAILOR_API_KEY,
      phone_number_id: phoneNumberId,
      message: formattedMessage,
      phone_number: phoneNumber.replace(/\+/g, '') // Remove + if present
    });
    
    console.log('Botsailor WhatsApp API response:', response.data);
    
    if (response.data && response.data.status === '1') {
      return {
        success: true,
        message: 'WhatsApp message sent successfully via Botsailor API',
        response: response.data,
        phoneNumber,
        timestamp: new Date().toISOString(),
        method: 'regular'
      };
    } else {
      // Check for specific error conditions
      const errorMessage = response.data?.message || 'Unknown error';
      
      if (errorMessage.includes('24 hour window')) {
        console.log('WhatsApp 24-hour policy restriction encountered:');
        console.log('This is a WhatsApp Business API limitation. Outside the 24-hour window,');
        console.log('only template messages approved by WhatsApp/Meta can be sent.');
        console.log('Template message also failed. Please check:');
        console.log('1. That your template is approved in Botsailor');
        console.log('2. That WHATSAPP_TEMPLATE_NAME is set correctly in environment variables');
      }
      
      return {
        success: false,
        message: 'Failed to send WhatsApp message via Botsailor API',
        response: response.data,
        errorDetails: errorMessage,
        phoneNumber,
        timestamp: new Date().toISOString()
      };
    }
  } catch (error) {
    console.error('Error sending WhatsApp confirmation:', error);
    throw error;
  }
};

/**
 * Format a WhatsApp message with the extracted cutting list data
 * @param data The extracted cutting list data
 * @param customerName The customer's name
 * @param projectName The project name
 * @returns Formatted WhatsApp message
 */
const formatWhatsAppMessage = (data: any, customerName: string, projectName: string): string => {
  // Log the incoming data structure
  console.log('Data structure received in formatWhatsAppMessage:', JSON.stringify(data));
  
  let message = `Hello`;
  
  // Check if we have a cutlist URL (new approach with web link)
  if (data.cutlistUrl) {
    const dimensionsCount = data.dimensionsCount || (data.dimensions ? data.dimensions.length : 0);
    
    message += `We've processed your cutting list for project "${projectName}".\n\n`;
    message += `We found ${dimensionsCount} dimension${dimensionsCount !== 1 ? 's' : ''} in your image.\n\n`;
    message += `View and edit your cutting list here:\n${data.cutlistUrl}\n\n`;
    message += `The link above will show all measurements and allow you to make changes if needed.\n\n`;
  }
  // Handle data structure with dimensions array (from OCR) - used as fallback
  else if (data.dimensions && Array.isArray(data.dimensions)) {
    message += `We've received your cutting list for project "${projectName}" and processed it.\n\n`;
    message += `*Dimensions (${data.dimensions.length}):*\n`;
    
    // Limit to first 5 dimensions to keep message short
    const displayCount = Math.min(data.dimensions.length, 5);
    for (let i = 0; i < displayCount; i++) {
      const piece = data.dimensions[i];
      const quantity = piece.quantity || 1;
      const desc = piece.description ? ` ${piece.description}` : '';
      message += `${i + 1}. ${piece.width} × ${piece.length} ${data.unit || 'mm'} (Qty: ${quantity})${desc}\n`;
    }
    
    // Show a message if there are more dimensions than displayed
    if (data.dimensions.length > displayCount) {
      message += `... and ${data.dimensions.length - displayCount} more\n`;
    }
  }
  // If no recognized structure, use a simple message
  else {
    message += `We've processed your cutting list for project "${projectName}".\n\n`;
    message += `*Your cutting list has been processed*\n\n`;
  }

  message += `Thank you,\nHDS Group Cutlist Team`;

  return message;
};
