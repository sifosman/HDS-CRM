"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertOCRToCutlistData = exports.processImageWithOCR = exports.processOcrText = exports.saveImageFile = exports.extractDimensionsFromText = void 0;
/**
 * Extract dimensions from HDS table format
 * Specifically designed for HDS cutting list tables
 * Handles OCR text where row numbers and dimensions are on separate lines
 */
const extractFromHDSTable = (ocrText) => {
    const dimensions = [];
    const lines = ocrText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const dimensionMap = new Map();
    console.log('=== SERVER-SIDE HDS TABLE PARSING ===');
    console.log('Total lines:', lines.length);
    // Find the start of the table data (after "Qoy" or "Qty")
    let tableStartIndex = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes('qoy') || lines[i].toLowerCase().includes('qty')) {
            tableStartIndex = i + 1;
            break;
        }
    }
    if (tableStartIndex === -1) {
        console.log('No table start found');
        console.log('=== END SERVER-SIDE HDS TABLE PARSING ===');
        return { dimensions: [], unit: 'mm' };
    }
    console.log(`Table starts at line ${tableStartIndex}`);
    // Helper function to check if a string is numeric
    const isNumeric = (str) => {
        return !isNaN(parseFloat(str)) && isFinite(parseFloat(str));
    };
    // Parse HDS table using sequential pattern recognition
    // Look for pattern: row number (1-30) → height (50-3000) → width (50-3000) → quantity (1-20)
    const processedRows = new Set();
    for (let i = tableStartIndex; i < lines.length - 3; i++) {
        const line = lines[i];
        // Check if this line is a row number (1-30 range)
        if (/^\d+$/.test(line)) {
            const rowNum = parseInt(line);
            if (rowNum >= 1 && rowNum <= 30 && !processedRows.has(rowNum)) {
                console.log(`\n=== Processing Row ${rowNum} ===`);
                console.log(`Row ${rowNum} starts at line ${i}: "${line}"`);
                // Look for the next lines to find height, width, and quantity
                let height = null;
                let width = null;
                let quantity = 1;
                const foundNumbers = [];
                // Scan the next few lines and collect all numeric values
                for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
                    const nextLine = lines[j].trim();
                    console.log(`  Line ${j}: "${nextLine}"`);
                    if (isNumeric(nextLine)) {
                        const num = parseFloat(nextLine);
                        foundNumbers.push(num);
                        console.log(`    → Found number: ${num}`);
                    }
                    // Stop if we encounter another row number (1-30)
                    if (/^\d+$/.test(nextLine)) {
                        const nextNum = parseInt(nextLine);
                        if (nextNum >= 1 && nextNum <= 30 && foundNumbers.length >= 2) {
                            console.log(`    → Next row detected (${nextNum}), stopping scan`);
                            break;
                        }
                    }
                    // Stop if we have enough numbers and hit a non-numeric line
                    if (foundNumbers.length >= 3 && !isNumeric(nextLine)) {
                        break;
                    }
                }
                console.log(`  → All found numbers for row ${rowNum}:`, foundNumbers);
                // Analyze the found numbers using positional logic for HDS table structure
                // HDS Table: Height | Width | Qty | Edging Length | Edging Width | Pot Holes
                if (foundNumbers.length >= 3) {
                    // For HDS tables, we expect the first 3 numbers to be: Height, Width, Quantity
                    const potentialHeight = foundNumbers[0];
                    const potentialWidth = foundNumbers[1];
                    const potentialQuantity = foundNumbers[2];
                    console.log(`  → Positional analysis:`);
                    console.log(`    Position 1 (Height): ${potentialHeight}`);
                    console.log(`    Position 2 (Width): ${potentialWidth}`);
                    console.log(`    Position 3 (Qty): ${potentialQuantity}`);
                    // Validate that first two numbers are reasonable dimensions
                    if (potentialHeight >= 50 && potentialHeight <= 3000 &&
                        potentialWidth >= 50 && potentialWidth <= 3000) {
                        height = potentialHeight;
                        width = potentialWidth;
                        // For quantity, use the 3rd number if it's reasonable (1-50 range)
                        // Extended range to 50 to handle edge cases but prefer smaller values
                        if (potentialQuantity >= 1 && potentialQuantity <= 50) {
                            quantity = potentialQuantity;
                            console.log(`    → Using positional quantity (3rd number): ${quantity}`);
                        }
                        else {
                            // Fallback: look for other small numbers in the sequence
                            const reasonableQuantities = foundNumbers.filter(n => n >= 1 && n <= 20);
                            if (reasonableQuantities.length > 0) {
                                quantity = Math.min(...reasonableQuantities);
                                console.log(`    → Using fallback quantity: ${quantity}`);
                            }
                            else {
                                quantity = 1;
                                console.log(`    → Using default quantity: 1`);
                            }
                        }
                        console.log(`    → Final assignment - Height: ${height}, Width: ${width}, Quantity: ${quantity}`);
                    }
                    else {
                        console.log(`    → Positional validation failed - not valid dimensions`);
                        console.log(`    → Height ${potentialHeight} valid: ${potentialHeight >= 50 && potentialHeight <= 3000}`);
                        console.log(`    → Width ${potentialWidth} valid: ${potentialWidth >= 50 && potentialWidth <= 3000}`);
                    }
                }
                else if (foundNumbers.length >= 2) {
                    // Fallback to old logic if we don't have 3+ numbers
                    console.log(`  → Insufficient numbers for positional analysis (${foundNumbers.length}), using fallback`);
                    const dimensions = foundNumbers.filter(n => n >= 50 && n <= 3000);
                    const quantities = foundNumbers.filter(n => n >= 1 && n <= 20);
                    if (dimensions.length >= 2) {
                        height = dimensions[0];
                        width = dimensions[1];
                        if (quantities.length > 0) {
                            quantity = Math.min(...quantities);
                            console.log(`    → Using smallest quantity: ${quantity}`);
                        }
                        else {
                            quantity = 1;
                            console.log(`    → Using default quantity: 1`);
                        }
                        console.log(`    → Fallback assignment - Height: ${height}, Width: ${width}, Quantity: ${quantity}`);
                    }
                    else {
                        console.log(`    → Insufficient dimensions found (need 2, got ${dimensions.length})`);
                    }
                }
                else {
                    console.log(`    → Insufficient numbers found (need at least 2, got ${foundNumbers.length})`);
                }
                // If we found valid dimensions, add them
                if (height !== null && width !== null && height > 0 && width > 0) {
                    processedRows.add(rowNum);
                    // Create a unique key for this dimension to avoid duplicates
                    const dimensionKey = `${height}x${width}`;
                    if (dimensionMap.has(dimensionKey)) {
                        // If we already have this dimension, update the quantity
                        const existingDimension = dimensionMap.get(dimensionKey);
                        existingDimension.quantity += quantity;
                        console.log(`✅ Updated existing dimension ${dimensionKey} to qty=${existingDimension.quantity}`);
                    }
                    else {
                        // Add new dimension
                        const newDimension = {
                            id: `hds-${Date.now()}-${dimensions.length}`,
                            length: height, // Use height as length
                            width: width,
                            quantity: quantity
                        };
                        dimensionMap.set(dimensionKey, newDimension);
                        console.log(`✅ Added new dimension from row ${rowNum}: ${dimensionKey} qty=${quantity}`);
                    }
                }
                else {
                    console.log(`❌ Row ${rowNum} skipped - insufficient dimensions (height: ${height}, width: ${width})`);
                }
            }
        }
    }
    // Convert Map to Array
    const finalDimensions = Array.from(dimensionMap.values());
    console.log(`Server-side HDS parsing complete. Found ${finalDimensions.length} unique dimensions.`);
    console.log('Dimensions:', finalDimensions);
    console.log('=== END SERVER-SIDE HDS TABLE PARSING ===');
    return { dimensions: finalDimensions, unit: 'mm' };
};
/**
 * Extract dimensions from OCR text
 * This is used when we already have OCR text from n8n
 */
const extractDimensionsFromText = (ocrText) => {
    // Create an array for dimensions
    const dimensions = [];
    // Split OCR text into lines
    const lines = ocrText.split('\n');
    console.log('Total lines in OCR text:', lines.length);
    // Set default unit
    let unit = 'mm';
    // Log the full OCR text for debugging
    console.log('Full OCR text:', ocrText);
    // Define material keywords and their properties
    const MATERIAL_KEYWORDS = [
        {
            keys: ['backing board', 'masonite', 'mdf', 'white mdf'],
            id: '202',
            name: 'MEL MDF Platinum White 9x6x3 SF',
            displayName: 'White Messonite'
        }
    ];
    let currentMaterial = null;
    // Enhanced regex patterns focused on real-world OCR text formats
    const dimensionPatterns = [
        // Format: "2000x 460=2" or "918x460=4" (with equals sign, allows for noise)
        /(\d+)\s*[xX×*]\s*(\d+)[^\d\r\n]*?=\s*(\d+)/,
        // Format: "360x140-8" (with dash)
        /(\d+)\s*[xX×*]\s*(\d+)\s*-\s*(\d+)/,
        // Format: "1000x500 2" (space then quantity)
        /(\d+)\s*[xX×*]\s*(\d+)\s+(\d+)\b/,
        // Format: "500x200 (3)" (quantity in parentheses)
        /(\d+)\s*[xX×*]\s*(\d+)\s*\(\s*(\d+)\s*\)/,
        // Format: "500x200x4" (quantity after second x)
        /(\d+)\s*[xX×*]\s*(\d+)\s*[xX×*]\s*(\d+)/,
    ];
    console.log('Using enhanced dimension patterns for extraction');
    // Process each line
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // Check for material keywords first
        let isMaterialHeader = false;
        for (const { keys, id, name, displayName } of MATERIAL_KEYWORDS) {
            if (keys.some(keyword => line.toLowerCase().includes(keyword.toLowerCase()))) {
                currentMaterial = { id, name, displayName };
                console.log(`Found material header: ${line}, setting current material to ${displayName}`);
                isMaterialHeader = true;
                break;
            }
        }
        if (isMaterialHeader) {
            continue; // Skip further processing for this line
        }
        if (!line)
            continue; // Skip empty lines
        // Skip empty lines or header/category lines
        if (line.toLowerCase() === 'doors' ||
            line.toLowerCase().includes('white') && line.length < 15) {
            continue;
        }
        console.log(`Processing line ${i + 1}:`, line);
        // Try to extract dimensions using our patterns
        let matched = false;
        let width = 0, length = 0, quantity = 0; // Initialize quantity to 0
        console.log(`Line format analysis for "${line}"`);
        // First, try the specific patterns
        for (const pattern of dimensionPatterns) {
            const match = line.match(pattern);
            if (match) {
                width = parseInt(match[1]);
                length = parseInt(match[2]);
                quantity = match[3] ? parseInt(match[3]) : 0;
                // Ensure width, length, and quantity are valid numbers
                if (!isNaN(width) && !isNaN(length) && width > 0 && length > 0) {
                    console.log(`PATTERN MATCH FOUND: ${width}x${length}, qty=${quantity} using pattern ${pattern}`);
                    matched = true;
                    break;
                }
            }
        }
        // If not matched with specific patterns, try more targeted approaches
        if (!matched) {
            // 1. Extract dimensions first
            const dimensionMatch = line.match(/(\d+)\s*[xX×*-]\s*(\d+)/);
            if (dimensionMatch) {
                width = parseInt(dimensionMatch[1]);
                length = parseInt(dimensionMatch[2]);
                console.log(`  Basic dimension found: ${width}x${length}`);
                // Get the remainder of the string after the dimension match
                const remainder = line.substring(dimensionMatch[0].length).trim();
                console.log(`  Remainder for quantity search: "${remainder}"`);
                // 2. Now try to extract quantity from the remainder
                const quantityPatterns = [
                    // Format: "=2" or "= 2" at any position
                    /=\s*(\d+)/,
                    // Format: "-2" or "- 2" at any position
                    /-\s*(\d+)/,
                    // Format: a number at the end of line
                    /^(\d+)\s*$/,
                    // Format: "(2)" or "[2]" (quantity in brackets)
                    /[\(\[]\s*(\d+)\s*[\)\]]/,
                    // Format: "2pcs" or "2 pcs" or similar
                    /\b(\d+)\s*(?:pc|pcs|x|ea|each|unit|units|pieces|piece)/i,
                ];
                for (const qPattern of quantityPatterns) {
                    const qMatch = remainder.match(qPattern);
                    if (qMatch && qMatch[1]) {
                        quantity = parseInt(qMatch[1]);
                        console.log(`  Quantity found: ${quantity} using pattern ${qPattern}`);
                        matched = true;
                        break;
                    }
                }
                // If no quantity pattern matched but we have dimensions, still consider it matched
                if (!matched && width > 0 && length > 0) {
                    console.log(`  No quantity pattern matched, skipping dimension`);
                    continue;
                }
            }
        }
        // If we have valid dimensions and a valid quantity, add them to our collection
        if (matched && width > 0 && length > 0 && quantity > 0) {
            // Ensure quantity is a valid number
            if (isNaN(quantity)) {
                console.log(`  Invalid quantity detected (${quantity}), skipping dimension`);
                continue; // Skip if quantity is not a number
            }
            // Extra logging to confirm what's being added
            console.log(`ADDING DIMENSION: ${width}x${length}, qty=${quantity}`);
            dimensions.push({
                id: `dim-${Date.now()}-${dimensions.length}`,
                width,
                length,
                quantity,
                material: currentMaterial ? currentMaterial.name : undefined,
                materialId: currentMaterial ? currentMaterial.id : undefined,
                materialDisplayName: currentMaterial ? currentMaterial.displayName : undefined
            });
        }
        if (!matched) {
            console.log(`  No dimension found in line: ${line}`);
        }
    }
    // Log the total number of dimensions found
    console.log(`Total dimensions extracted: ${dimensions.length}`);
    // Only try HDS table format if ALL these conditions are met:
    // 1. Standard parsing found very few results (≤1)
    // 2. Text contains "HDS" (company identifier)
    // 3. Text contains table headers like "Height/Length" and "Width" and "Qoy" (quantity)
    // 4. Text contains numbered rows (1, 2, 3, etc.)
    const hasHDSIdentifier = ocrText.includes('HDS');
    const hasTableHeaders = ocrText.includes('Height/Length') && ocrText.includes('Width') && (ocrText.includes('Qoy') || ocrText.includes('Qty'));
    const hasNumberedRows = /^\d+\s+\d+\s+\d+\s+\d+/m.test(ocrText); // Look for numbered table rows
    if (dimensions.length <= 1 && hasHDSIdentifier && hasTableHeaders && hasNumberedRows) {
        console.log('Standard parsing found few results and this appears to be an HDS table format. Trying HDS table parsing...');
        console.log('HDS conditions met:', { hasHDSIdentifier, hasTableHeaders, hasNumberedRows });
        const hdsResult = extractFromHDSTable(ocrText);
        if (hdsResult.dimensions.length > dimensions.length) {
            console.log(`HDS table parsing found ${hdsResult.dimensions.length} dimensions vs ${dimensions.length} from standard parsing. Using HDS results.`);
            return hdsResult;
        }
        else {
            console.log(`HDS table parsing found ${hdsResult.dimensions.length} dimensions, not better than standard parsing (${dimensions.length}). Using standard results.`);
        }
    }
    else {
        console.log('HDS table parsing conditions not met:', {
            fewDimensions: dimensions.length <= 1,
            hasHDSIdentifier,
            hasTableHeaders,
            hasNumberedRows
        });
    }
    return { dimensions, unit };
};
exports.extractDimensionsFromText = extractDimensionsFromText;
/**
 * Save an image file locally (stub implementation for compatibility)
 */
const saveImageFile = (fileBuffer, filename) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('saveImageFile called - this is a stub implementation since OCR is handled by n8n');
    return 'file-path-placeholder';
});
exports.saveImageFile = saveImageFile;
/**
 * Process OCR results from text (use this for data from n8n)
 */
const processOcrText = (ocrText) => {
    console.log('Processing OCR text from n8n');
    const { dimensions, unit } = (0, exports.extractDimensionsFromText)(ocrText);
    return { dimensions, unit, rawText: ocrText };
};
exports.processOcrText = processOcrText;
/**
 * Process image with OCR (stub for compatibility)
 */
const processImageWithOCR = (imagePath) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('processImageWithOCR called - this is a stub implementation since OCR is handled by n8n');
    return {
        dimensions: [],
        unit: 'mm',
        rawText: 'OCR processing is now handled by n8n'
    };
});
exports.processImageWithOCR = processImageWithOCR;
/**
 * Convert OCR results to cutlist data format (stub for compatibility)
 */
const convertOCRToCutlistData = (ocrResults) => {
    console.log('convertOCRToCutlistData called - this is a stub implementation since OCR is handled by n8n');
    // Extract dimensions from OCR text if available
    if (ocrResults && ocrResults.rawText) {
        const { dimensions, unit } = (0, exports.extractDimensionsFromText)(ocrResults.rawText);
        return {
            dimensions,
            unit,
            rawText: ocrResults.rawText
        };
    }
    return {
        dimensions: [],
        unit: 'mm',
        rawText: ''
    };
};
exports.convertOCRToCutlistData = convertOCRToCutlistData;
