"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendWhatsAppConfirmation = exports.runSampleTests = exports.testOCRParsing = exports.parseOCRText = exports.processImageWithOCR = exports.getAvailableStockPieces = exports.getAvailableMaterials = exports.syncProjectWithBotsailor = exports.sendDataToBotsailor = exports.processIncomingData = exports.checkConnectionStatus = void 0;
const axios_1 = __importDefault(require("axios"));
const uuid_1 = require("uuid");
const fs_1 = __importDefault(require("fs"));
// Get Botsailor API configuration from environment variables
const BOTSAILOR_API_URL = process.env.BOTSAILOR_API_URL || 'https://www.botsailor.com/api/v1';
const BOTSAILOR_API_KEY = process.env.BOTSAILOR_API_KEY || '';
// Create axios instance for Botsailor API
const botsailorApi = axios_1.default.create({
    baseURL: BOTSAILOR_API_URL,
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BOTSAILOR_API_KEY}`
    }
});
/**
 * Check the connection status with Botsailor
 */
const checkConnectionStatus = async () => {
    try {
        const response = await botsailorApi.get('/status');
        return {
            connected: response.status === 200,
            message: 'Connection to Botsailor established'
        };
    }
    catch (error) {
        console.error('Botsailor connection error:', error);
        return {
            connected: false,
            message: 'Failed to connect to Botsailor API'
        };
    }
};
exports.checkConnectionStatus = checkConnectionStatus;
/**
 * Process incoming data from Botsailor
 */
const processIncomingData = async (data, type) => {
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
exports.processIncomingData = processIncomingData;
/**
 * Send data to Botsailor
 */
const sendDataToBotsailor = async (data, type) => {
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
    }
    catch (error) {
        console.error('Error sending data to Botsailor:', error);
        throw error;
    }
};
exports.sendDataToBotsailor = sendDataToBotsailor;
/**
 * Sync project with Botsailor
 */
const syncProjectWithBotsailor = async (projectId, direction = 'push') => {
    try {
        if (direction === 'push') {
            // Get project data from our database
            // This is a placeholder - implement actual project retrieval
            const projectData = { id: projectId, name: 'Sample Project' };
            // Send to Botsailor
            return await (0, exports.sendDataToBotsailor)(projectData, 'project');
        }
        else {
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
    }
    catch (error) {
        console.error('Error syncing project with Botsailor:', error);
        throw error;
    }
};
exports.syncProjectWithBotsailor = syncProjectWithBotsailor;
/**
 * Get available materials from Botsailor
 */
const getAvailableMaterials = async () => {
    try {
        const response = await botsailorApi.get('/materials');
        return response.data.materials || [];
    }
    catch (error) {
        console.error('Error fetching materials from Botsailor:', error);
        throw error;
    }
};
exports.getAvailableMaterials = getAvailableMaterials;
/**
 * Get available stock pieces from Botsailor
 */
const getAvailableStockPieces = async (materialId) => {
    try {
        const response = await botsailorApi.get(`/stock?materialId=${materialId}`);
        return response.data.stockPieces || [];
    }
    catch (error) {
        console.error('Error fetching stock pieces from Botsailor:', error);
        throw error;
    }
};
exports.getAvailableStockPieces = getAvailableStockPieces;
// Helper functions for data processing
const processProjectData = (data) => {
    // Process project data from Botsailor
    // This is a placeholder - implement actual processing
    return {
        id: data.id || (0, uuid_1.v4)(),
        name: data.name,
        description: data.description,
        materials: data.materials || [],
        cutPieces: data.cutPieces || [],
        stockPieces: data.stockPieces || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
};
const processMaterialData = (data) => {
    // Process material data from Botsailor
    // This is a placeholder - implement actual processing
    return {
        id: data.id || (0, uuid_1.v4)(),
        name: data.name,
        type: data.type,
        thickness: data.thickness,
        properties: data.properties || {}
    };
};
const processStockData = (data) => {
    // Process stock data from Botsailor
    // This is a placeholder - implement actual processing
    return {
        id: data.id || (0, uuid_1.v4)(),
        materialId: data.materialId,
        width: data.width,
        length: data.length,
        quantity: data.quantity || 1,
        properties: data.properties || {}
    };
};
const processCutlistData = (data) => {
    // Process cutlist data from Botsailor
    // This is a placeholder - implement actual processing
    return {
        id: data.id || (0, uuid_1.v4)(),
        projectId: data.projectId,
        cutPieces: data.cutPieces || [],
        stockPieces: data.stockPieces || [],
        createdAt: new Date().toISOString()
    };
};
const transformDataForBotsailor = (data, type) => {
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
const processImageWithOCR = async (imagePath) => {
    try {
        // In a real implementation, we would use Google Cloud Vision API here
        // For now, we'll use a mock implementation that returns sample data
        // Read the image file to simulate processing
        if (!fs_1.default.existsSync(imagePath)) {
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
        const extractedData = (0, exports.parseOCRText)(mockText);
        return extractedData;
    }
    catch (error) {
        console.error('OCR processing error:', error);
        throw error;
    }
};
exports.processImageWithOCR = processImageWithOCR;
/**
 * Parse OCR text to extract cutting list data
 * @param text The OCR extracted text
 * @returns Structured cutting list data
 */
const parseOCRText = (text) => {
    console.log('Starting OCR text parsing...');
    console.log('Raw text received for parsing:\n', text);
    // Initialize result structure
    const result = {
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
    }
    else {
        // Use handwritten format parsing (can handle both simple formats and material sections)
        return parseHandwrittenFormat(text, result);
    }
};
exports.parseOCRText = parseOCRText;
/**
 * Parse HDS cutting list table format
 * @param text The OCR extracted text
 * @param result The result structure to populate
 * @returns Structured cutting list data
 */
const parseHDSTableFormat = (text, result) => {
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
            }
            else if (numbers.length === 3) {
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
                    id: (0, uuid_1.v4)(),
                    length: Math.max(height, width), // Larger dimension as length
                    width: Math.min(height, width), // Smaller dimension as width
                    quantity: qty,
                    name: `Piece ${result.cutPieces.length + 1}`,
                    description: line.trim()
                });
                console.log(`Added HDS cut piece: ${Math.max(height, width)}x${Math.min(height, width)}, Qty: ${qty}`);
            }
            else {
                console.log(`Invalid dimensions found in line: "${line}"`);
            }
        }
        else {
            console.log(`Not enough numbers found in line: "${line}"`);
        }
    }
    console.log(`HDS parsing complete. Found ${result.cutPieces.length} cut pieces.`);
    return result;
};
/**
 * Parse handwritten format with improved standardization on Length x Width = Quantity
 * @param text The OCR extracted text
 * @param result The result structure to populate
 * @returns Structured cutting list data
 */
const parseHandwrittenFormat = (text, result) => {
    console.log('=== IMPROVED OCR PARSING - STANDARD FORMAT ===');
    console.log('Parsing handwritten format with Length x Width = Quantity standardization...');
    const lines = text.split('\n').filter(line => line.trim() !== '');
    console.log(`Total lines to process: ${lines.length}`);
    // STANDARDIZED DIMENSION PATTERNS - Focus on Length x Width = Quantity
    const standardPatterns = [
        // Primary patterns - Length x Width = Quantity (most common)
        /(\d+)\s*[xX×*]\s*(\d+)\s*=\s*(\d+)/, // 1000x500=2, 1000 x 500 = 2
        /(\d+)\s*[xX×*]\s*(\d+)\s*-\s*(\d+)/, // 1000x500-2, 1000 x 500 - 2
        /(\d+)\s*[xX×*]\s*(\d+)\s*:\s*(\d+)/, // 1000x500:2 (colon separator)
        // Secondary patterns - with parentheses or text separators
        /(\d+)\s*[xX×*]\s*(\d+)\s*\(\s*(\d+)\s*\)/, // 1000x500(2), 1000 x 500 (2)
        /(\d+)\s*[xX×*]\s*(\d+)\s*\[\s*(\d+)\s*\]/, // 1000x500[2] (square brackets)
        // Tertiary patterns - with quantity keywords
        /(\d+)\s*[xX×*]\s*(\d+)\s+(\d+)\s*(?:pcs?|pieces?|pc|ea|qty|x)\b/i, // 1000x500 2pcs, 1000x500 2 pc
        // Quaternary patterns - space separated (more permissive)
        /(\d+)\s*[xX×*]\s*(\d+)\s+(\d+)(?!\d)/, // 1000x500 2 (space separated, no following digit)
        // Fallback pattern - just dimensions (quantity defaults to 1)
        /(\d+)\s*[xX×*]\s*(\d+)(?!\s*[=\-:\(\[\d])/ // 1000x500 (no quantity indicator following)
    ];
    // Material section detection keywords
    const materialKeywords = [
        'white', 'door', 'doors', 'drawer', 'drawers', 'microwave',
        'masonite', 'messonite', 'melamine', 'oak', 'wood', 'panel',
        'chipboard', 'mdf', 'plywood', 'pine', 'birch'
    ];
    // Track current material section
    let piecesFound = 0;
    // Helper function to validate dimensions
    const isValidDimension = (value) => {
        return value >= 50 && value <= 3000; // Reasonable range for cutting dimensions in mm
    };
    // Helper function to validate quantity
    const isValidQuantity = (value) => {
        return value >= 1 && value <= 50; // Reasonable range for quantities
    };
    // Helper function to normalize material names
    const normalizeMaterialName = (text) => {
        const cleanText = text.trim();
        if (cleanText.toLowerCase().includes('white') && cleanText.toLowerCase().includes('melam')) {
            return 'White Melamine';
        }
        if (cleanText.toLowerCase().includes('white') && cleanText.toLowerCase().includes('messo')) {
            return 'White Messonite';
        }
        if (cleanText.toLowerCase() === 'doors') {
            return 'Doors';
        }
        return cleanText.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
    };
    // Helper function to check if a line is a material header
    const isMaterialHeader = (line) => {
        const lowerLine = line.toLowerCase().trim();
        // STRICT RULES: Must be a clean material header, not a dimension line
        // 1. Skip if it contains any digits (dimension lines have numbers)
        if (/\d/.test(line)) {
            return false;
        }
        // 2. Skip if it contains dimension indicators (x, ×, *, =, -, :)
        if (/[xX×*=\-:]/.test(line)) {
            return false;
        }
        // 3. Skip if it's too short (less than 3 characters)
        if (line.trim().length < 3) {
            return false;
        }
        // 4. Must contain a material keyword
        const hasKeyword = materialKeywords.some(keyword => lowerLine.includes(keyword));
        // 5. Additional check: if it's just "doors" or similar single words, it's likely a header
        const isSingleMaterialWord = materialKeywords.some(keyword => lowerLine === keyword || lowerLine === keyword + 's' || lowerLine === keyword.slice(0, -1));
        return hasKeyword || isSingleMaterialWord;
    };
    let currentMaterial = 'White Melamine';
    let extractedPieces = [];
    let lineIndex = 0;
    // MULTI-LINE PARSING - Handle dimensions split across lines
    const processMultiLinePatterns = (lines, startIndex) => {
        var _a;
        if (startIndex >= lines.length - 1)
            return { piece: null, nextIndex: startIndex + 1 };
        const currentLine = lines[startIndex].trim();
        const nextLine = ((_a = lines[startIndex + 1]) === null || _a === void 0 ? void 0 : _a.trim()) || '';
        // Pattern 1: "1800 x" + "248=2" → 1800x248=2
        const splitXPattern = /^(\d+)\s*[xX×*]\s*$/;
        const followupPattern = /^(\d+)\s*[=\-:]\s*(\d+)/;
        const xMatch = currentLine.match(splitXPattern);
        const followMatch = nextLine.match(followupPattern);
        if (xMatch && followMatch) {
            const length = parseInt(xMatch[1]);
            const width = parseInt(followMatch[1]);
            const quantity = parseInt(followMatch[2]);
            if (isValidDimension(length) && isValidDimension(width) && isValidQuantity(quantity)) {
                console.log(`🔗 MULTI-LINE MATCH: ${length}x${width}=${quantity} (lines ${startIndex + 1}-${startIndex + 2})`);
                return {
                    piece: {
                        id: `${result.id}-${extractedPieces.length}`,
                        length,
                        width,
                        quantity,
                        material: currentMaterial,
                        description: `${length}x${width}`,
                        name: `${length}x${width}`,
                        lineIndex: startIndex
                    },
                    nextIndex: startIndex + 2 // Skip both lines
                };
            }
        }
        // Pattern 2: "1100 *" + "420=2" → 1100x420=2  
        const splitStarPattern = /^(\d+)\s*[*]\s*$/;
        if (currentLine.match(splitStarPattern) && followMatch) {
            const length = parseInt(currentLine.match(splitStarPattern)[1]);
            const width = parseInt(followMatch[1]);
            const quantity = parseInt(followMatch[2]);
            if (isValidDimension(length) && isValidDimension(width) && isValidQuantity(quantity)) {
                console.log(`🔗 MULTI-LINE MATCH: ${length}x${width}=${quantity} (lines ${startIndex + 1}-${startIndex + 2})`);
                return {
                    piece: {
                        id: `${result.id}-${extractedPieces.length}`,
                        length,
                        width,
                        quantity,
                        material: currentMaterial,
                        description: `${length}x${width}`,
                        name: `${length}x${width}`,
                        lineIndex: startIndex
                    },
                    nextIndex: startIndex + 2
                };
            }
        }
        return { piece: null, nextIndex: startIndex + 1 };
    };
    // Process lines with multi-line support
    while (lineIndex < lines.length) {
        const line = lines[lineIndex].trim();
        console.log(`Processing line ${lineIndex + 1}: ${line}`);
        // Check for material headers first
        if (isMaterialHeader(line)) {
            const materialName = normalizeMaterialName(line);
            console.log(`Found material header: ${line}, setting current material to ${materialName}`);
            currentMaterial = materialName;
            // Create separator piece for frontend
            extractedPieces.push({
                id: `${result.id}-separator-${extractedPieces.length}`,
                separator: true,
                name: materialName,
                material: materialName,
                description: materialName,
                lineIndex: lineIndex
            });
            lineIndex++;
            continue;
        }
        // Try multi-line patterns first
        const multiLineResult = processMultiLinePatterns(lines, lineIndex);
        if (multiLineResult.piece) {
            console.log(`ADDING MULTI-LINE DIMENSION: ${multiLineResult.piece.description}, qty=${multiLineResult.piece.quantity}`);
            extractedPieces.push(multiLineResult.piece);
            lineIndex = multiLineResult.nextIndex;
            continue;
        }
        // Fall back to single-line patterns (your existing code)
        console.log(`Line format analysis for "${line}"`);
        let dimensionFound = false;
        // Try each pattern
        for (let i = 0; i < standardPatterns.length; i++) {
            const match = line.match(standardPatterns[i]);
            if (match) {
                const length = parseInt(match[1]);
                const width = parseInt(match[2]);
                const quantity = parseInt(match[3]) || 1;
                if (isValidDimension(length) && isValidDimension(width) && isValidQuantity(quantity)) {
                    console.log(`✅ SERVER PATTERN MATCH: ${length}x${width} (Length x Width), qty=${quantity} using pattern ${i + 1} (${standardPatterns[i]})`);
                    console.log(`ADDING DIMENSION: ${length}x${width} (Length x Width), qty=${quantity}`);
                    extractedPieces.push({
                        id: `${result.id}-${extractedPieces.length}`,
                        length,
                        width,
                        quantity,
                        material: currentMaterial,
                        description: `${length}x${width}`,
                        name: `${length}x${width}`,
                        lineIndex: lineIndex
                    });
                    dimensionFound = true;
                    break;
                }
            }
        }
        if (!dimensionFound) {
            console.log(`No dimension found in line: ${line}`);
        }
        lineIndex++;
    }
    // Ensure we have at least one material
    if (result.materials.length === 0) {
        result.materials.push({
            id: (0, uuid_1.v4)(),
            name: 'Default Material',
            type: 'board',
            thickness: 16
        });
        // Update all pieces to use default material
        extractedPieces.forEach((piece) => {
            if (!piece.separator && !piece.material) {
                piece.material = 'Default Material';
            }
        });
        console.log('No materials detected, created default material');
    }
    // ADD EXTRACTED PIECES TO RESULT
    result.cutPieces = extractedPieces;
    console.log('\n=== PARSING SUMMARY ===');
    const actualPiecesCount = extractedPieces.filter((p) => !p.separator).length;
    console.log(`Total pieces found: ${actualPiecesCount}`);
    console.log(`Total materials: ${result.materials.length}`);
    console.log(`Total cut pieces (including separators): ${extractedPieces.length}`);
    // Log all found pieces for debugging
    const actualPieces = extractedPieces.filter((p) => !p.separator);
    console.log('\n=== EXTRACTED PIECES ===');
    actualPieces.forEach((piece, index) => {
        console.log(`${index + 1}. ${piece.length}x${piece.width} qty=${piece.quantity} [${piece.material}]`);
    });
    console.log('=== END IMPROVED OCR PARSING ===\n');
    return result;
};
/**
 * Test utility function for OCR parsing - helps debug different text formats
 * @param testText Sample OCR text to test
 * @returns Parsed results for debugging
 */
const testOCRParsing = (testText) => {
    console.log('\n=== OCR PARSING TEST ===');
    console.log('Input text:');
    console.log(testText);
    const result = {
        stockPieces: [],
        cutPieces: [],
        materials: [],
        unit: 'mm'
    };
    const parsedResult = parseHandwrittenFormat(testText, result);
    console.log('\n=== TEST RESULTS ===');
    const pieces = parsedResult.cutPieces.filter((p) => !p.separator);
    console.log(`Pieces extracted: ${pieces.length}`);
    pieces.forEach((piece, index) => {
        console.log(`  ${index + 1}. ${piece.length}x${piece.width} qty=${piece.quantity} [${piece.material}]`);
    });
    return parsedResult;
};
exports.testOCRParsing = testOCRParsing;
/**
 * Sample test cases for different OCR formats
 */
const runSampleTests = () => {
    console.log('🧪 Running OCR parsing sample tests...\n');
    // Test Case 1: Standard format
    (0, exports.testOCRParsing)(`
White Melamine
1000x500=2
800x600=1
1200x400=3

Doors
500x300=4
600x400=2
  `);
    // Test Case 2: Mixed separators
    (0, exports.testOCRParsing)(`
2000x460-2
918x460=4
1500x800:1
1000x500(3)
  `);
    // Test Case 3: With noise (like "1Length = 2Width")
    (0, exports.testOCRParsing)(`
1800x900=2=1Length=2Width
1000x500-3-extra text here
800x600:1:more noise
  `);
    // Test Case 4: Space separated
    (0, exports.testOCRParsing)(`
1500x800 2
1000x600 1 pcs
900x400 3 pieces
  `);
};
exports.runSampleTests = runSampleTests;
/**
 * Check if a line contains dimension patterns
 * @param line The line to check
 * @param patterns Array of regex patterns for dimensions
 * @returns True if the line contains dimensions
 */
const isDimensionLine = (line, patterns) => {
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
const parseSimpleFormat = (text, result) => {
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
const sendWhatsAppConfirmation = async (phoneNumber, extractedData, customerName, projectName) => {
    var _a;
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
            const templateResponse = await axios_1.default.post(`${BOTSAILOR_API_URL}/whatsapp/send-template`, {
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
            }
            else {
                console.warn('Template message failed, falling back to regular message...');
                // Continue to try regular message as fallback
            }
        }
        catch (templateError) {
            console.error('Error sending template message:', templateError);
            console.warn('Template message failed, falling back to regular message...');
            // Continue to try regular message as fallback
        }
        // Fallback: try to send as regular message
        console.log('Attempting to send regular WhatsApp message...');
        const response = await axios_1.default.post(`${BOTSAILOR_API_URL}/whatsapp/send`, {
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
        }
        else {
            // Check for specific error conditions
            const errorMessage = ((_a = response.data) === null || _a === void 0 ? void 0 : _a.message) || 'Unknown error';
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
    }
    catch (error) {
        console.error('Error sending WhatsApp confirmation:', error);
        throw error;
    }
};
exports.sendWhatsAppConfirmation = sendWhatsAppConfirmation;
/**
 * Format a WhatsApp message with the extracted cutting list data
 * @param data The extracted cutting list data
 * @param customerName The customer's name
 * @param projectName The project name
 * @returns Formatted WhatsApp message
 */
const formatWhatsAppMessage = (data, customerName, projectName) => {
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
