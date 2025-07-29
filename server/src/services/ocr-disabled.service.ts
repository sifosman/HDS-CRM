/**
 * OCR Service - Disabled Version
 * 
 * This version is designed to work with n8n integration where OCR is handled externally.
 * It provides minimal stubs for compatibility with existing code.
 */
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Simple interface for dimension data
interface Dimension {
  id: string;   // Unique identifier for the dimension
  width: number;
  length: number;
  quantity: number;
  material?: string; // Optional reference to a material
  materialId?: string; // New field
  materialDisplayName?: string; // New field
}

/**
 * Extract dimensions from HDS table format
 * Specifically designed for HDS cutting list tables
 * Handles OCR text where row numbers and dimensions are on separate lines
 */
const extractFromHDSTable = (ocrText: string): { dimensions: Dimension[], unit: string } => {
  const dimensions: Dimension[] = [];
  const lines = ocrText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const dimensionMap = new Map<string, Dimension>();
  
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
  const isNumeric = (str: string): boolean => {
    return !isNaN(parseFloat(str)) && isFinite(parseFloat(str));
  };
  
  // Parse HDS table using sequential pattern recognition
  // Look for pattern: row number (1-30) → height (50-3000) → width (50-3000) → quantity (1-20)
  const processedRows = new Set<number>();
  
  for (let i = tableStartIndex; i < lines.length - 3; i++) {
    const line = lines[i];
    
    // Check if this line is a row number (1-30 range)
    if (/^\d+$/.test(line)) {
      const rowNum = parseInt(line);
      
      if (rowNum >= 1 && rowNum <= 30 && !processedRows.has(rowNum)) {
        console.log(`\n=== Processing Row ${rowNum} ===`);
        console.log(`Row ${rowNum} starts at line ${i}: "${line}"`);
        
        // Look for the next lines to find height, width, and quantity
        let height: number | null = null;
        let width: number | null = null;
        let quantity = 1;
        const foundNumbers: number[] = [];
        
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
            } else {
              // Fallback: look for other small numbers in the sequence
              const reasonableQuantities = foundNumbers.filter(n => n >= 1 && n <= 20);
              if (reasonableQuantities.length > 0) {
                quantity = Math.min(...reasonableQuantities);
                console.log(`    → Using fallback quantity: ${quantity}`);
              } else {
                quantity = 1;
                console.log(`    → Using default quantity: 1`);
              }
            }
            
            console.log(`    → Final assignment - Height: ${height}, Width: ${width}, Quantity: ${quantity}`);
          } else {
            console.log(`    → Positional validation failed - not valid dimensions`);
            console.log(`    → Height ${potentialHeight} valid: ${potentialHeight >= 50 && potentialHeight <= 3000}`);
            console.log(`    → Width ${potentialWidth} valid: ${potentialWidth >= 50 && potentialWidth <= 3000}`);
          }
        } else if (foundNumbers.length >= 2) {
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
            } else {
              quantity = 1;
              console.log(`    → Using default quantity: 1`);
            }
            
            console.log(`    → Fallback assignment - Height: ${height}, Width: ${width}, Quantity: ${quantity}`);
          } else {
            console.log(`    → Insufficient dimensions found (need 2, got ${dimensions.length})`);
          }
        } else {
          console.log(`    → Insufficient numbers found (need at least 2, got ${foundNumbers.length})`);
        }
        
        // If we found valid dimensions, add them
        if (height !== null && width !== null && height > 0 && width > 0) {
          processedRows.add(rowNum);
          
          // Create a unique key for this dimension to avoid duplicates
          const dimensionKey = `${height}x${width}`;
          
          if (dimensionMap.has(dimensionKey)) {
            // If we already have this dimension, update the quantity
            const existingDimension = dimensionMap.get(dimensionKey)!;
            existingDimension.quantity += quantity;
            console.log(`✅ Updated existing dimension ${dimensionKey} to qty=${existingDimension.quantity}`);
          } else {
            // Add new dimension
            const newDimension: Dimension = {
              id: `hds-${Date.now()}-${dimensions.length}`,
              length: width, // Fix: Use width as length (Length x Width format)
              width: height, // Fix: Use height as width (Length x Width format)
              quantity: quantity
            };
            dimensionMap.set(dimensionKey, newDimension);
            console.log(`✅ Added new dimension from row ${rowNum}: ${dimensionKey} qty=${quantity}`);
          }
        } else {
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
export const extractDimensionsFromText = (ocrText: string): { dimensions: Dimension[], unit: string } => {
  // Create an array for dimensions
  const dimensions: Dimension[] = [];
  
  // Split OCR text into lines
  const lines = ocrText.split('\n');
  console.log('Total lines in OCR text:', lines.length);
  
  // Set default unit
  let unit = 'mm';
  
  // Log the full OCR text for debugging
  console.log('Full OCR text:', ocrText);
  
  // Define material keywords and their properties - matching frontend triggers
  const MATERIAL_KEYWORDS = [
    { 
      keys: ['white melamine', 'white melamme', 'melamine'],
      id: '201',
      name: 'White Melamine',
      displayName: 'White Melamine'
    },
    { 
      keys: ['doors', 'door'],
      id: '203',
      name: 'Doors',
      displayName: 'Doors'
    },
    { 
      keys: ['white messonite', 'messonite', 'backing board', 'masonite', 'mdf', 'white mdf'],
      id: '202',
      name: 'MEL MDF Platinum White 9x6x3 SF',
      displayName: 'White Messonite'
    },
    { 
      keys: ['color melamine', 'colour melamine', 'color', 'colour'],
      id: '204',
      name: 'Color Melamine',
      displayName: 'Color Melamine'
    }
  ];
  
  let currentMaterial = null;
  let extractedPieces: any[] = [];
  let lineIndex = 0;
  
  // Helper function to validate dimensions
  const isValidDimension = (value: number): boolean => {
    return value >= 50 && value <= 3000; // Reasonable range for cutting dimensions in mm
  };
  
  // Helper function to validate quantity
  const isValidQuantity = (value: number): boolean => {
    return value >= 1 && value <= 50; // Reasonable range for quantities
  };
  
  // Helper function to check if a line is a material header
  const isMaterialHeader = (line: string): boolean => {
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
    const materialKeywords = ['white', 'door', 'doors', 'drawer', 'drawers', 'microwave', 
                             'masonite', 'messonite', 'melamine', 'oak', 'wood', 'panel', 
                             'chipboard', 'mdf', 'plywood', 'pine', 'birch'];
    const hasKeyword = materialKeywords.some(keyword => lowerLine.includes(keyword));
    
    // 5. Additional check: if it's just "doors" or similar single words, it's likely a header
    const isSingleMaterialWord = materialKeywords.some(keyword => 
      lowerLine === keyword || lowerLine === keyword + 's' || lowerLine === keyword.slice(0, -1)
    );
    
    return hasKeyword || isSingleMaterialWord;
  };
  
  // Enhanced regex patterns focused on real-world OCR text formats
  const dimensionPatterns = [
    // Format: "10/ 1700 x 450" (quantity-first format with slash)
    /(\d+)\s*\/\s*(\d+)\s*[xX×*]\s*(\d+)/,

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
  
  // MULTI-LINE PARSING - Handle dimensions split across lines
  const processMultiLinePatterns = (lines: string[], startIndex: number): { piece: any | null, nextIndex: number } => {
    if (startIndex >= lines.length - 1) return { piece: null, nextIndex: startIndex + 1 };
    
    const currentLine = lines[startIndex].trim();
    const nextLine = lines[startIndex + 1]?.trim() || '';
    
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
        console.log(`🔗 MULTI-LINE MATCH: ${length}x${width}=${quantity} (lines ${startIndex+1}-${startIndex+2})`);
        return {
          piece: {
            id: `piece-${extractedPieces.length}`,
            length,
            width,
            quantity,
            material: currentMaterial?.displayName || 'Default Material',
            materialId: currentMaterial?.id || '201',
            materialDisplayName: currentMaterial?.displayName || 'Default Material'
          },
          nextIndex: startIndex + 2 // Skip both lines
        };
      }
    }
    
    // Pattern 2: "1100 *" + "420=2" → 1100x420=2  
    const splitStarPattern = /^(\d+)\s*[*]\s*$/;
    if (currentLine.match(splitStarPattern) && followMatch) {
      const length = parseInt(currentLine.match(splitStarPattern)![1]);
      const width = parseInt(followMatch[1]);
      const quantity = parseInt(followMatch[2]);
      
      if (isValidDimension(length) && isValidDimension(width) && isValidQuantity(quantity)) {
        console.log(`🔗 MULTI-LINE MATCH: ${length}x${width}=${quantity} (lines ${startIndex+1}-${startIndex+2})`);
        return {
          piece: {
            id: `piece-${extractedPieces.length}`,
            length,
            width,
            quantity,
            material: currentMaterial?.displayName || 'Default Material',
            materialId: currentMaterial?.id || '201',
            materialDisplayName: currentMaterial?.displayName || 'Default Material'
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
      for (const { keys, id, name, displayName } of MATERIAL_KEYWORDS) {
        if (keys.some(keyword => line.toLowerCase().includes(keyword.toLowerCase()))) {
          currentMaterial = { id, name, displayName };
          console.log(`Found material header: ${line}, setting current material to ${displayName}`);
          
          // Create a separator piece for this material
          extractedPieces.push({
            id: `separator-${extractedPieces.length}`,
            width: 0,
            length: 0,
            quantity: 0,
            material: displayName,
            separator: true,
            name: displayName,
            description: line.trim()
          });
          
          break;
        }
      }
      
      lineIndex++;
      continue;
    }
    
    // Try multi-line patterns first
    const multiLineResult = processMultiLinePatterns(lines, lineIndex);
    if (multiLineResult.piece) {
      console.log(`ADDING MULTI-LINE DIMENSION: ${multiLineResult.piece.length}x${multiLineResult.piece.width}, qty=${multiLineResult.piece.quantity}`);
      extractedPieces.push(multiLineResult.piece);
      lineIndex = multiLineResult.nextIndex;
      continue;
    }
    
    if (!line) {
      lineIndex++;
      continue; // Skip empty lines
    }
    
    console.log(`Line format analysis for "${line}"`);
    
    // Try to extract dimensions using our patterns
    let matched = false;
    let width = 0, length = 0, quantity = 0; // Initialize quantity to 0
    
    // First, try the specific patterns
    for (let patternIndex = 0; patternIndex < dimensionPatterns.length; patternIndex++) {
      const pattern = dimensionPatterns[patternIndex];
      const match = line.match(pattern);
      if (match) {
        // Handle quantity-first format (pattern index 0: "10/ 1700 x 450")
        if (patternIndex === 0) {
          quantity = parseInt(match[1]);
          length = parseInt(match[2]); // Fix: First dimension is length
          width = parseInt(match[3]);  // Fix: Second dimension is width
        } else {
          // All other patterns follow (length, width, quantity) order - Length x Width format
          length = parseInt(match[1]); // Fix: First captured group is length
          width = parseInt(match[2]);  // Fix: Second captured group is width
          quantity = match[3] ? parseInt(match[3]) : 0;
        }
        
        // Validate using our helper functions
        if (isValidDimension(length) && isValidDimension(width) && isValidQuantity(quantity)) {
          console.log(`✅ SERVER PATTERN MATCH: ${length}x${width} (Length x Width), qty=${quantity} using pattern ${patternIndex} (${pattern})`);
          console.log(`ADDING DIMENSION: ${length}x${width} (Length x Width), qty=${quantity}`);
          
          extractedPieces.push({
            id: `piece-${extractedPieces.length}`,
            length,
            width,
            quantity,
            material: currentMaterial?.displayName || 'Default Material',
            materialId: currentMaterial?.id || '201',
            materialDisplayName: currentMaterial?.displayName || 'Default Material'
          });
          
          matched = true;
          break;
        }
      }
    }
    
    if (!matched) {
      console.log(`No dimension found in line: ${line}`);
    }
    
    lineIndex++;
  }
  
  // Convert extractedPieces to dimensions format
  const finalDimensions = extractedPieces.filter((piece: any) => !piece.separator).map((piece: any) => ({
    id: piece.id,
    length: piece.length,
    width: piece.width,
    quantity: piece.quantity,
    material: piece.material,
    materialId: piece.materialId,
    materialDisplayName: piece.materialDisplayName
  }));
  
  // Add any separators as well
  const separators = extractedPieces.filter((piece: any) => piece.separator);
  const allDimensions = [...separators, ...finalDimensions];
  
  // Log the total number of dimensions found
  console.log(`Total dimensions extracted: ${finalDimensions.length}`);
  console.log('\n=== EXTRACTED PIECES ===');
  finalDimensions.forEach((piece: any, index: number) => {
    console.log(`${index + 1}. ${piece.length}x${piece.width} qty=${piece.quantity} [${piece.material}]`);
  });
  
  // Only try HDS table format if ALL these conditions are met:
  // 1. Standard parsing found very few results (≤1)
  // 2. Text contains "HDS" (company identifier)
  // 3. Text contains table headers like "Height/Length" and "Width" and "Qoy" (quantity)
  // 4. Text contains numbered rows (1, 2, 3, etc.)
  const hasHDSIdentifier = ocrText.includes('HDS');
  const hasTableHeaders = ocrText.includes('Height/Length') && ocrText.includes('Width') && (ocrText.includes('Qoy') || ocrText.includes('Qty'));
  const hasNumberedRows = /^\d+\s+\d+\s+\d+\s+\d+/m.test(ocrText); // Look for numbered table rows
  
  if (finalDimensions.length <= 1 && hasHDSIdentifier && hasTableHeaders && hasNumberedRows) {
    console.log('Standard parsing found few results and this appears to be an HDS table format. Trying HDS table parsing...');
    console.log('HDS conditions met:', { hasHDSIdentifier, hasTableHeaders, hasNumberedRows });
    
    const hdsResult = extractFromHDSTable(ocrText);
    if (hdsResult.dimensions.length > finalDimensions.length) {
      console.log(`HDS table parsing found ${hdsResult.dimensions.length} dimensions vs ${finalDimensions.length} from standard parsing. Using HDS results.`);
      return hdsResult;
    } else {
      console.log(`HDS table parsing found ${hdsResult.dimensions.length} dimensions, not better than standard parsing (${finalDimensions.length}). Using standard results.`);
    }
  } else {
    console.log('HDS table parsing conditions not met:', { 
      fewDimensions: finalDimensions.length <= 1,
      hasHDSIdentifier, 
      hasTableHeaders, 
      hasNumberedRows 
    });
  }
  
  return { dimensions: allDimensions, unit };
};

/**
 * Save an image file locally (stub implementation for compatibility)
 */
export const saveImageFile = async (fileBuffer: Buffer, filename: string): Promise<string> => {
  console.log('saveImageFile called - this is a stub implementation since OCR is handled by n8n');
  return 'file-path-placeholder';
};

/**
 * Process OCR results from text (use this for data from n8n)
 */
export const processOcrText = (ocrText: string): { dimensions: Dimension[], unit: string, rawText: string } => {
  console.log('Processing OCR text from n8n');
  const { dimensions, unit } = extractDimensionsFromText(ocrText);
  return { dimensions, unit, rawText: ocrText };
};

/**
 * Process image with OCR (stub for compatibility)
 */
export const processImageWithOCR = async (imagePath: string): Promise<{ dimensions: Dimension[], unit: string, rawText: string }> => {
  console.log('processImageWithOCR called - this is a stub implementation since OCR is handled by n8n');
  return { 
    dimensions: [], 
    unit: 'mm', 
    rawText: 'OCR processing is now handled by n8n' 
  };
};

/**
 * Convert OCR results to cutlist data format (stub for compatibility)
 */
export const convertOCRToCutlistData = (ocrResults: any): any => {
  console.log('convertOCRToCutlistData called - this is a stub implementation since OCR is handled by n8n');
  // Extract dimensions from OCR text if available
  if (ocrResults && ocrResults.rawText) {
    const { dimensions, unit } = extractDimensionsFromText(ocrResults.rawText);
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
