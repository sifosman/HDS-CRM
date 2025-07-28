// Utility functions for EditableCutlistTable
import type { CutPiece } from './types';

// Helper function to check if a string is numeric
function isNumeric(str: string): boolean {
  return !isNaN(parseFloat(str)) && isFinite(parseFloat(str));
}

// Helper function to parse HDS table format
function parseHDSTable(text: string, material: string = 'White Melamine'): Array<{ width: number; length: number; quantity: number; material: string; description: string }> {
  console.log('=== CLIENT-SIDE HDS TABLE PARSING ===');
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const dimensionMap = new Map<string, { width: number; length: number; quantity: number; material: string; description: string }>();
  
  // Extract material name from the OCR text if available
  const materialNameMatch = text.match(/Board Name:\s*([^\n]+)/i);
  if (materialNameMatch && materialNameMatch[1]) {
    material = materialNameMatch[1].trim();
    console.log(`Found material name in OCR text: ${material}`);
  }
  
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
    console.log('=== END CLIENT-SIDE HDS TABLE PARSING ===');
    return [];
  }
  
  console.log(`Table starts at line ${tableStartIndex}`);
  
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
          
          // Validate that first two numbers are reasonable dimensions (consistent with backend)
          if (!isNaN(potentialHeight) && !isNaN(potentialWidth) && 
              potentialHeight >= 50 && potentialHeight <= 3000 && 
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
            dimensionMap.set(dimensionKey, {
              width: width,
              length: height,
              quantity: quantity,
              material: material,
              description: `${height}x${width}`
            });
            console.log(`✅ Added new dimension from row ${rowNum}: ${dimensionKey} qty=${quantity}`);
          }
        } else {
          console.log(`❌ Row ${rowNum} skipped - insufficient dimensions (height: ${height}, width: ${width})`);
        }
      }
    }
  }
  
  // Convert Map to Array
  const dimensions = Array.from(dimensionMap.values());
  
  console.log(`Client-side HDS parsing complete. Found ${dimensions.length} unique dimensions.`);
  console.log('Dimensions:', dimensions);
  console.log('=== END CLIENT-SIDE HDS TABLE PARSING ===');
  return dimensions;
}

export function parseOcrText(ocrText: string, materialCategories: string[]): { dimensions: any[], materials: string[] } {
  if (!ocrText) return { dimensions: [], materials: [] };
  
  const dimensions: any[] = [];
  const materials: string[] = [];
  let currentMaterial = materialCategories[0];
  
  // Define material trigger words that should create dropdowns
  const materialTriggers = [
    { key: "white melamine", value: "White Melamine" },
    { key: "white melamme", value: "White Melamine" }, // Common spelling variation
    { key: "doors", value: "Doors" },
    { key: "door", value: "Doors" }, // Singular form
    { key: "color", value: "Color" },
    { key: "colour", value: "Color" }, // UK spelling
    { key: "white messonite", value: "White Messonite" },
    { key: "messonite", value: "White Messonite" }, // Just messonite
  ];
  
  // Split OCR text into lines
  const lines = ocrText.split('\n').filter(line => line.trim() !== '');
  console.log(`🔍 OCR PARSING DEBUG: Parsing ${lines.length} lines of OCR text`);
  console.log(`📋 Available material triggers:`, materialTriggers.map(t => t.key));
  
  let separatorCount = 0;
  
  // Process lines sequentially to maintain order
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    console.log(`📄 Processing line ${i}: "${line}"`);
    
    // Check if this line is a material trigger word
    let isMaterialTrigger = false;
    let triggeredMaterial = null;
    
    for (const trigger of materialTriggers) {
      if (line.toLowerCase().includes(trigger.key.toLowerCase())) {
        triggeredMaterial = trigger.value;
        currentMaterial = trigger.value;
        isMaterialTrigger = true;
        console.log(`✅ MATERIAL TRIGGER FOUND: "${trigger.key}" -> "${trigger.value}" on line ${i}`);
        break;
      }
    }
    
    // If we found a material trigger, add a separator dimension to create a dropdown
    if (isMaterialTrigger && triggeredMaterial) {
      separatorCount++;
      const separatorId = `separator-${Date.now()}-${dimensions.length}`;
      
      dimensions.push({
        id: separatorId,
        separator: true,
        name: triggeredMaterial,
        material: triggeredMaterial,
        lineIndex: i, // Track original position in OCR text
        originalLine: line // Store original line for reference
      });
      
      // Add to materials list if not already present
      if (!materials.includes(triggeredMaterial)) {
        materials.push(triggeredMaterial);
      }
      
      console.log(`🎯 SEPARATOR ${separatorCount} CREATED: ${triggeredMaterial} (ID: ${separatorId})`);
      continue;
    }
    
    // Try to extract dimensions: First check for quantity-first format like '10/ 1700 x 450'
    const quantityFirstMatch = line.match(/(\d+)\s*\/\s*(\d+)\s*[xX×*]\s*(\d+)/);
    if (quantityFirstMatch) {
      const quantity = parseInt(quantityFirstMatch[1], 10);
      const width = parseInt(quantityFirstMatch[2], 10);
      const length = parseInt(quantityFirstMatch[3], 10);
      
      // Validate that this looks like reasonable dimensions and quantity (consistent with backend)
      if (!isNaN(width) && !isNaN(length) && !isNaN(quantity) && 
          width > 0 && length > 0 && quantity > 0 && quantity <= 100 &&
          width >= 50 && width <= 3000 && length >= 50 && length <= 3000) {
        dimensions.push({
          id: `dim-${Date.now()}-${dimensions.length}`,
          width,
          length,
          quantity,
          material: currentMaterial,
          description: line, // Store the original line for reference
          lineIndex: i // Track original position in OCR text
        });
        
        console.log(`✅ QUANTITY-FIRST FORMAT: Added dimension: ${width}x${length}, qty=${quantity}, material=${currentMaterial}`);
        continue; // Skip to next line since we found a match
      }
    }
    
    // Try to extract dimensions: standard format like '460x2000' or '460x2000x2'
    const dimensionMatch = line.match(/(\d+)\s*[xX×*]\s*(\d+)(?:\s*[xX×*]\s*(\d+))?/);
    if (dimensionMatch) {
      const width = parseInt(dimensionMatch[1], 10);
      const length = parseInt(dimensionMatch[2], 10);
      const quantity = dimensionMatch[3] ? parseInt(dimensionMatch[3], 10) : 1;
      
      if (!isNaN(width) && !isNaN(length) && width > 0 && length > 0) {
        dimensions.push({
          id: `dim-${Date.now()}-${dimensions.length}`,
          width,
          length,
          quantity,
          material: currentMaterial,
          description: line, // Store the original line for reference
          lineIndex: i // Track original position in OCR text
        });
        
        console.log(`✅ STANDARD FORMAT: Added dimension: ${width}x${length}, qty=${quantity}, material=${currentMaterial}`);
      }
    }
  }
  
  // If we didn't find many dimensions with standard parsing, try HDS table format
  // Check for HDS-specific conditions
  const hasHDSIdentifier = ocrText.toUpperCase().includes('HDS');
  const hasTableHeaders = ocrText.includes('Height/Length') && ocrText.includes('Width') && (ocrText.includes('Qoy') || ocrText.includes('Qty'));
  const hasNumberedRows = /^\s*\d+\s*$/m.test(ocrText); // Look for standalone row numbers
  const hasMultipleRows = (ocrText.match(/^\s*\d+\s*$/gm) || []).length >= 2; // At least 2 row numbers
  
  console.log('=== HDS PARSING CONDITIONS CHECK ===');
  console.log('Standard parsing found dimensions:', dimensions.length);
  console.log('HDS conditions:', {
    fewDimensions: dimensions.length <= 1,
    hasHDSIdentifier,
    hasTableHeaders,
    hasNumberedRows,
    hasMultipleRows
  });
  
  if (dimensions.length <= 1 && hasHDSIdentifier && hasTableHeaders && hasNumberedRows && hasMultipleRows) {
    console.log('✅ All HDS conditions met. Attempting HDS table parsing...');
    
    const hdsDimensions = parseHDSTable(ocrText);
    if (hdsDimensions.length > dimensions.length) {
      console.log(`✅ HDS parsing successful: found ${hdsDimensions.length} dimensions vs ${dimensions.length} from standard parsing.`);
      dimensions.length = 0; // Clear existing dimensions
      dimensions.push(...hdsDimensions);
    } else {
      console.log(`❌ HDS parsing did not improve results: ${hdsDimensions.length} vs ${dimensions.length}`);
    }
  } else {
    console.log('❌ HDS parsing conditions not met - using standard parsing results');
  }
  console.log('=== END HDS PARSING CONDITIONS CHECK ===');
  
  // Make sure we have at least one material
  if (materials.length === 0) {
    materials.push(materialCategories[0]);
  }
  
  return { dimensions, materials };
}

export function extractQuantityFromDescription(description: string | undefined): number | null {
  if (!description) return 1; // Default to 1 if no description
  
  // Array of regex patterns to extract quantity from description, in order of priority
  const patterns = [
    // Format: "900x600x2" or "900X600X 2" (third dimension as quantity)
    /(?:^|\s|[xX×*])(\d+)\s*[xX×*]\s*\d+\s*[xX×*]\s*(\d+)/,
    
    // Format: "900x600 x2" (quantity after dimensions with 'x')
    /(?:^|\s|[xX×*])(\d+)\s*[xX×*]\s*\d+\s+[xX]\s*(\d+)/,
    
    // Format: "2000x460=2" or "918x460=4" (with equals sign)
    /(?:^|\s|[xX×*])(\d+)\s*[xX×*]\s*\d+\s*=\s*(\d+)/,
    
    // Format: "360x140-8" (with dash)
    /(?:^|\s|[xX×*])(\d+)\s*[xX×*]\s*\d+\s*-\s*(\d+)/,
    
    // Format: "X2" or "x 2" at the end of the string
    /[xX]\s*(\d+)\s*$/,
    
    // Format: at the end of string after dimensions
    /(?:^|\s|[xX×*])(\d+)\s*[xX×*]\s*\d+\s+(\d+)$/,
    
    // Format: parentheses (3)
    /\(\s*(\d+)\s*\)/,
    
    // Last resort: any number at the end
    /(\d+)$/
  ];
  
  // Try each pattern
  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (match) {
      // For patterns with two capture groups, the quantity is the second one
      const qtyStr = match[2] || match[1];
      const qty = parseInt(qtyStr, 10);
      if (!isNaN(qty) && qty > 0) {
        console.log(`Extracted quantity ${qty} from description: "${description}"`);
        return qty;
      }
    }
  }
  
  console.log(`No quantity found in description: "${description}", defaulting to 1`);
  return 1; // Default to 1 if no quantity found
}

export function normalizeCutPieces(rawPieces: any[], DEFAULT_MATERIAL_CATEGORIES: string[] = []): CutPiece[] {
  // If DEFAULT_MATERIAL_CATEGORIES is not provided or empty, use a default
  const materialCategories = DEFAULT_MATERIAL_CATEGORIES?.length > 0 ? DEFAULT_MATERIAL_CATEGORIES : ["Default Material"];
  
  console.log('🔧 NORMALIZE: Starting normalization process');
  console.log('📋 NORMALIZE: Raw pieces received:', rawPieces.length);
  console.log('🔗 NORMALIZE: Existing separators in raw pieces:', rawPieces.filter(p => p.separator).length);
  
  if (!rawPieces || rawPieces.length === 0) return [];

  // Check if separators already exist from backend parsing
  const existingSeparators = rawPieces.filter(piece => piece.separator);
  if (existingSeparators.length > 0) {
    console.log('✅ NORMALIZE: Found existing separators from backend, preserving structure');
    console.log('🎯 NORMALIZE: Existing separators:', existingSeparators.map(s => s.name || s.material));
    
    // If separators already exist, just normalize the quantities and return as-is
    const normalizedPieces: CutPiece[] = [];
    
    for (const piece of rawPieces) {
      if (piece.separator) {
        // Keep separator pieces as-is
        normalizedPieces.push({
          ...piece,
          id: piece.id || `separator-${Date.now()}-${normalizedPieces.length}`
        });
        console.log(`🔗 NORMALIZE: Preserved separator: ${piece.name || piece.material}`);
      } else {
        // Normalize regular pieces (mainly quantity handling)
        const description = piece.description || piece.name || '';
        
        let quantity = piece.quantity;
        if (quantity === undefined || quantity === null) {
          // Only extract from description if quantity is truly missing
          const extractedQty = extractQuantityFromDescription(description);
          if (extractedQty !== null && extractedQty > 0) {
            quantity = extractedQty;
            console.log(`📊 NORMALIZE: Extracted quantity ${quantity} from description: "${description}"`);
          } else {
            quantity = 1; // Default to 1 if no quantity found
          }
        } else {
          // Use the quantity that was already parsed from the backend
          console.log(`📊 NORMALIZE: Using existing quantity ${quantity} from backend parsing`);
        }
        
        // Create the normalized piece with the correct quantity
        const normalizedPiece: CutPiece = {
          id: piece.id || `piece-${Date.now()}-${normalizedPieces.length}`,
          width: piece.width,
          length: piece.length,
          quantity: quantity,
          name: description,
          description: description, // Keep the original description
          edging: piece.edging,
          material: piece.material // Keep the material assigned by backend
        };
        
        normalizedPieces.push(normalizedPiece);
        console.log(`✅ NORMALIZE: Preserved piece: ${piece.width}x${piece.length} x${quantity} (${piece.material})`);
      }
    }
    
    console.log('🎉 NORMALIZE: Completed with preserved structure, total pieces:', normalizedPieces.length);
    return normalizedPieces;
  }
  
  // Legacy path: No existing separators, create them based on material detection
  console.log('⚠️ NORMALIZE: No existing separators found, using legacy material detection');
  
  const materialHeadings: { key: string; value: string }[] = [];
  for (const piece of rawPieces) {
    const text = piece.description || piece.name;
    if (text) {
      for (const material of materialCategories) {
        if (text.toLowerCase().includes(material.toLowerCase())) {
          materialHeadings.push({
            key: text,
            value: material
          });
          break;
        }
      }
    }
  }

  console.log('materialHeadings:', materialHeadings);

  const normalizedPieces: CutPiece[] = [];
  let currentMaterial = materialCategories[0];

  for (const piece of rawPieces) {
    if (!piece) continue;

    const text = piece.description || piece.name;
    console.log('Processing piece:', piece);
    
    // Check if this piece is a material heading
    const isMaterialHeading = materialHeadings.some(
      heading => heading.key === text
    );

    if (isMaterialHeading) {
      const heading = materialHeadings.find(h => h.key === text);
      if (heading) {
        currentMaterial = heading.value;
      }
      // Push a separator piece
      normalizedPieces.push({
        id: `separator-${Date.now()}-${normalizedPieces.length}`,
        separator: true,
        material: currentMaterial
      });
    } else {
      // Normal cut piece - extract quantity from description if not explicitly provided
      const description = piece.description || piece.name || '';
      
      // First, check if quantity is already set in the piece data
      // If not, extract it from the description
      let quantity = piece.quantity;
      if (quantity === undefined || quantity === null) {
        // Only extract from description if quantity is truly missing
        const extractedQty = extractQuantityFromDescription(description);
        if (extractedQty !== null && extractedQty > 0) {
          quantity = extractedQty;
          console.log(`Extracted quantity ${quantity} from description: "${description}"`);
        } else {
          quantity = 1; // Default to 1 if no quantity found
        }
      } else {
        // Use the quantity that was already parsed from the backend
        console.log(`Using existing quantity ${quantity} from backend parsing`);
      }
      
      // Create the normalized piece with the correct quantity
      const normalizedPiece: CutPiece = {
        id: piece.id || `piece-${Date.now()}-${normalizedPieces.length}`,
        width: piece.width,
        length: piece.length,
        quantity: quantity,
        name: description,
        description: description, // Keep the original description
        edging: piece.edging,
        material: piece.material || currentMaterial // Preserve existing material from backend
      };
      
      normalizedPieces.push(normalizedPiece);
      console.log(`Normalized piece: ${piece.width}x${piece.length} x${quantity} (${piece.material || currentMaterial}) - "${description}"`);
    }
  }

  console.log('normalizedPieces:', normalizedPieces);
  return normalizedPieces;
}

export function calculateEdging(piece: CutPiece): string {
  if (!piece) return '';
  
  const edgingSides: string[] = [];
  
  // Check each tick box and add the corresponding side
  if (piece.lengthTick1) edgingSides.push('L1');
  if (piece.lengthTick2) edgingSides.push('L2');
  if (piece.widthTick1) edgingSides.push('W1');
  if (piece.widthTick2) edgingSides.push('W2');
  
  // If we have tick boxes selected, return them
  if (edgingSides.length > 0) {
    return edgingSides.join(',');
  }
  
  // Fallback: Check if piece has a legacy edging property
  // If edging is 1 or true, return "1" to indicate all sides
  if (piece.edging === 1) {
    return '1'; // Backend will interpret this as all 4 sides
  }
  
  // If edging is a number greater than 1, convert to string
  if (typeof piece.edging === 'number' && piece.edging > 1) {
    return piece.edging.toString();
  }
  
  // No edging required
  return '';
}

export function calculateEdgingLength(piece: CutPiece): number {
  if (!piece) return 0;
  
  let totalEdging = 0;
  
  // Calculate edging length based on tick boxes
  // L1 and L2 = length of the piece
  if (piece.lengthTick1) totalEdging += (piece.length || 0);
  if (piece.lengthTick2) totalEdging += (piece.length || 0);
  
  // W1 and W2 = width of the piece  
  if (piece.widthTick1) totalEdging += (piece.width || 0);
  if (piece.widthTick2) totalEdging += (piece.width || 0);
  
  // Multiply by quantity
  totalEdging *= (piece.quantity || 1);
  
  return totalEdging;
}

export function downloadPdf(url: string, filename: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function extractDimensions(productData: any): { width: number; length: number; thickness: number } {
  if (!productData) return { width: 0, length: 0, thickness: 0 };
  
  // Extract dimensions from the product data
  const width = productData.width || 0;
  const length = productData.length || 0;
  const thickness = productData.thickness || 0;
  
  return { width, length, thickness };
}
