import { IPiece } from '../models/project.model';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import { Buffer } from 'buffer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Interfaces for the optimizer
interface StockPiece {
  width: number;
  length: number;
  quantity: number;
  patternDirection: number;
}

interface CutPiece {
  width: number;
  length: number;
  quantity: number;
  patternDirection: number;
  externalId: number;
  canRotate: boolean;
  // Optional edging information carried from frontend/controller
  edging?: string | number | boolean;
  edgeL1?: boolean;
  edgeL2?: boolean;
  edgeW1?: boolean;
  edgeW2?: boolean;
}

interface PlacedPiece {
  x: number;
  y: number;
  width: number;
  length: number;
  externalId: number | string;
  canRotate?: boolean;
  // Carry edging info into the final solution for PDF
  edging?: string | number | boolean;
  edgeL1?: boolean;
  edgeL2?: boolean;
  edgeW1?: boolean;
  edgeW2?: boolean;
}

interface Solution {
  stockPieces: Array<{
    width: number;
    length: number;
    cutPieces: PlacedPiece[];
  }>;
}

// Convert units
const convertUnit = (value: number, fromUnit: number, toUnit: number): number => {
  // Units: 0 = mm, 1 = inch, 2 = foot
  const mmToInch = 0.0393701;
  const mmToFoot = 0.00328084;
  const inchToMm = 25.4;
  const inchToFoot = 0.0833333;
  const footToMm = 304.8;
  const footToInch = 12;

  if (fromUnit === toUnit) return value;

  if (fromUnit === 0) { // from mm
    if (toUnit === 1) return value * mmToInch;
    if (toUnit === 2) return value * mmToFoot;
  } else if (fromUnit === 1) { // from inch
    if (toUnit === 0) return value * inchToMm;
    if (toUnit === 2) return value * inchToFoot;
  } else if (fromUnit === 2) { // from foot
    if (toUnit === 0) return value * footToMm;
    if (toUnit === 1) return value * footToInch;
  }

  return value;
};

// Prepare data for optimization
export const prepareOptimizationData = (pieces: IPiece[], unit: number): { stockPieces: StockPiece[], cutPieces: CutPiece[] } => {
  const stockPieces: StockPiece[] = [];
  const cutPieces: CutPiece[] = [];
  let seq = 0;

  pieces.forEach(piece => {
    // Convert to mm for internal calculations
    const width = Math.round(convertUnit(piece.width, unit, 0));
    const length = Math.round(convertUnit(piece.length, unit, 0));
    // Default to no-grain when pattern is not provided from client
    const patternDirection = (piece as any)?.pattern ?? 0;

    if (piece.kind === 1) { // Stock piece
      for (let i = 0; i < piece.amount; i++) {
        stockPieces.push({
          width,
          length,
          quantity: 1,
          patternDirection
        });
      }
    } else { // Cut piece
      for (let i = 0; i < piece.amount; i++) {
        seq++;
        // Extract and normalize edging info, if present on incoming piece
        const anyPiece: any = piece as any;
        const rawEdging = anyPiece?.edging;
        let edgeL1 = false, edgeL2 = false, edgeW1 = false, edgeW2 = false;
        if (rawEdging !== undefined && rawEdging !== null) {
          if (rawEdging === 1 || rawEdging === true || (typeof rawEdging === 'string' && rawEdging.trim() === '1')) {
            edgeL1 = edgeL2 = edgeW1 = edgeW2 = true;
          } else if (typeof rawEdging === 'string') {
            rawEdging.split(',').map((s: string) => s.trim()).filter((s: string) => s).forEach((s: string) => {
              if (s === 'L1') edgeL1 = true;
              if (s === 'L2') edgeL2 = true;
              if (s === 'W1') edgeW1 = true;
              if (s === 'W2') edgeW2 = true;
            });
          }
        }
        cutPieces.push({
          width,
          length,
          quantity: 1,
          patternDirection,
          externalId: seq,
          canRotate: patternDirection === 0, // Can only rotate if no pattern
          edging: rawEdging,
          edgeL1,
          edgeL2,
          edgeW1,
          edgeW2
        });
      }
    }
  });

  return { stockPieces, cutPieces };
};

// Improved optimization function with better bin packing algorithm
export const optimizeCuttingLayout = (stockPieces: StockPiece[], cutPieces: CutPiece[], cutWidth: number, layout: number): Solution => {
  const solution: Solution = {
    stockPieces: []
  };

  // Sort cut pieces by area (largest first) for better packing
  const sortedCutPieces = [...cutPieces].sort((a, b) => {
    const areaA = a.width * a.length;
    const areaB = b.width * b.length;
    return areaB - areaA; // Descending order (largest first)
  });

  // Process each stock piece
  for (let stockPieceIndex = 0; stockPieceIndex < stockPieces.length; stockPieceIndex++) {
    const stockPiece = stockPieces[stockPieceIndex];

    // Skip if no more cut pieces to place
    if (sortedCutPieces.length === 0) break;

    const solutionStockPiece = {
      width: stockPiece.width,
      length: stockPiece.length,
      cutPieces: [] as PlacedPiece[]
    };

    // For guillotine layout, we'll use a simple shelf algorithm
    // For nested layout, we'll use a more complex bin packing approach
    if (layout === 0) { // Guillotine layout
      // Initialize free rectangles with the whole stock piece
      const freeRects = [{ x: 0, y: 0, width: stockPiece.width, height: stockPiece.length }];

      // Try to place each cut piece
      let i = 0;
      while (i < sortedCutPieces.length) {
        const cutPiece = sortedCutPieces[i];
        let placed = false;

        // Try to place in each free rectangle
        for (let j = 0; j < freeRects.length; j++) {
          const rect = freeRects[j];

          // Check if piece fits in this rectangle (considering cut width)
          const fitsWidth = cutPiece.width <= rect.width;
          const fitsHeight = cutPiece.length <= rect.height;

          // Try rotated if allowed and it fits
          const canRotate = cutPiece.canRotate && cutPiece.patternDirection === 0;
          const fitsWidthRotated = canRotate && cutPiece.length <= rect.width;
          const fitsHeightRotated = canRotate && cutPiece.width <= rect.height;

          // Decide orientation to place
          let canPlaceNormal = fitsWidth && fitsHeight;
          let canPlaceRotated = fitsWidthRotated && fitsHeightRotated;
          let useRotated = false;

          if (canPlaceNormal || canPlaceRotated) {
            if (canPlaceNormal && canPlaceRotated) {
              // Both orientations fit: choose the one with less waste
              const normalWaste = (rect.width - cutPiece.width) * (rect.height - cutPiece.length);
              const rotatedWaste = (rect.width - cutPiece.length) * (rect.height - cutPiece.width);
              useRotated = rotatedWaste < normalWaste;
            } else if (!canPlaceNormal && canPlaceRotated) {
              useRotated = true;
            } else {
              useRotated = false;
            }

            // Place the piece
            const placedPiece: PlacedPiece = {
              x: rect.x,
              y: rect.y,
              width: useRotated ? cutPiece.length : cutPiece.width,
              length: useRotated ? cutPiece.width : cutPiece.length,
              externalId: cutPiece.externalId,
              edging: (cutPiece as any).edging,
              edgeL1: (cutPiece as any).edgeL1,
              edgeL2: (cutPiece as any).edgeL2,
              edgeW1: (cutPiece as any).edgeW1,
              edgeW2: (cutPiece as any).edgeW2
            };

            try {
              console.log(
                `Placed piece #${placedPiece.externalId} on stock index ${stockPieceIndex} at (${placedPiece.x},${placedPiece.y}) ` +
                `size ${placedPiece.width}x${placedPiece.length} (rotated=${useRotated})`
              );
            } catch {}

            solutionStockPiece.cutPieces.push(placedPiece);

            // Split the free rectangle into two new free rectangles
            // Remove the current free rectangle
            freeRects.splice(j, 1);

            // Add new free rectangles (considering cut width)
            const usedWidth = placedPiece.width + cutWidth;
            const usedHeight = placedPiece.length + cutWidth;

            // Right rectangle
            if (rect.width - usedWidth > 0) {
              freeRects.push({
                x: rect.x + usedWidth,
                y: rect.y,
                width: rect.width - usedWidth,
                height: rect.height
              });
            }

            // Bottom rectangle
            if (rect.height - usedHeight > 0) {
              freeRects.push({
                x: rect.x,
                y: rect.y + usedHeight,
                width: usedWidth,
                height: rect.height - usedHeight
              });
            }

            // Remove the placed piece from the list
            sortedCutPieces.splice(i, 1);
            placed = true;
            break;
          }
        }

        // If the piece couldn't be placed, move to the next one
        if (!placed) {
          i++;
        }
      }
    } else { // Nested layout - more complex bin packing
      // Initialize a grid for the stock piece
      const gridSize = Math.min(cutWidth, 10); // Use cut width as grid size, but not smaller than 10
      const gridWidth = Math.ceil(stockPiece.width / gridSize);
      const gridHeight = Math.ceil(stockPiece.length / gridSize);
      const grid = Array(gridHeight).fill(0).map(() => Array(gridWidth).fill(false));

      // Try to place each cut piece
      let i = 0;
      while (i < sortedCutPieces.length) {
        const cutPiece = sortedCutPieces[i];
        let placed = false;

        // Calculate piece dimensions in grid units
        const pieceWidth = Math.ceil(cutPiece.width / gridSize);
        const pieceHeight = Math.ceil(cutPiece.length / gridSize);
        const cutWidthGrid = Math.ceil(cutWidth / gridSize);

        // Try all possible positions
        for (let y = 0; y <= gridHeight - pieceHeight; y++) {
          for (let x = 0; x <= gridWidth - pieceWidth; x++) {
            // Check if this position is free
            let canPlace = true;
            for (let py = 0; py < pieceHeight; py++) {
              for (let px = 0; px < pieceWidth; px++) {
                if (grid[y + py][x + px]) {
                  canPlace = false;
                  break;
                }
              }
              if (!canPlace) break;
            }

            // Also check if there's enough space for the cut width
            if (canPlace) {
              // Check right edge
              if (x + pieceWidth < gridWidth) {
                for (let py = 0; py < pieceHeight; py++) {
                  for (let c = 0; c < cutWidthGrid; c++) {
                    if (x + pieceWidth + c < gridWidth && grid[y + py][x + pieceWidth + c]) {
                      canPlace = false;
                      break;
                    }
                  }
                  if (!canPlace) break;
                }
              }

              // Check bottom edge
              if (canPlace && y + pieceHeight < gridHeight) {
                for (let px = 0; px < pieceWidth; px++) {
                  for (let c = 0; c < cutWidthGrid; c++) {
                    if (y + pieceHeight + c < gridHeight && grid[y + pieceHeight + c][x + px]) {
                      canPlace = false;
                      break;
                    }
                  }
                  if (!canPlace) break;
                }
              }
            }

            if (canPlace) {
              // Mark the grid as used
              for (let py = 0; py < pieceHeight; py++) {
                for (let px = 0; px < pieceWidth; px++) {
                  grid[y + py][x + px] = true;
                }
              }

              // Mark cut width areas as used
              if (x + pieceWidth < gridWidth) {
                for (let py = 0; py < pieceHeight; py++) {
                  for (let c = 0; c < cutWidthGrid; c++) {
                    if (x + pieceWidth + c < gridWidth) {
                      grid[y + py][x + pieceWidth + c] = true;
                    }
                  }
                }
              }

              if (y + pieceHeight < gridHeight) {
                for (let px = 0; px < pieceWidth; px++) {
                  for (let c = 0; c < cutWidthGrid; c++) {
                    if (y + pieceHeight + c < gridHeight) {
                      grid[y + pieceHeight + c][x + px] = true;
                    }
                  }
                }
              }

              // Add the placed piece
              solutionStockPiece.cutPieces.push({
                x: x * gridSize,
                y: y * gridSize,
                width: cutPiece.width,
                length: cutPiece.length,
                externalId: cutPiece.externalId,
                edging: (cutPiece as any).edging,
                edgeL1: (cutPiece as any).edgeL1,
                edgeL2: (cutPiece as any).edgeL2,
                edgeW1: (cutPiece as any).edgeW1,
                edgeW2: (cutPiece as any).edgeW2
              });

              // Remove the placed piece from the list
              sortedCutPieces.splice(i, 1);
              placed = true;
              break;
            }
          }
          if (placed) break;
        }

        // If the piece couldn't be placed, move to the next one
        if (!placed) {
          i++;
        }
      }
    }

    // Only add stock pieces that have cut pieces placed on them
    if (solutionStockPiece.cutPieces.length > 0) {
      solution.stockPieces.push(solutionStockPiece);
    }
  }

  return solution;
};

// Generate PDF with the solution
export const generatePdf = (solution: Solution, unit: number, cutWidth: number = 3, layout: number = 0): string => {
  const pdfId = uuidv4();
  const pdfPath = path.join(__dirname, '../../pdfs', `solution_${pdfId}.pdf`);

  // Ensure directory exists
  const dir = path.dirname(pdfPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Create PDF document
  const doc = new PDFDocument({ size: 'A4' });
  const stream = fs.createWriteStream(pdfPath);
  doc.pipe(stream);

  // Add title with a colored header box
  doc.rect(50, 50, doc.page.width - 100, 60)
     .fillAndStroke('#003366', '#000000');

  doc.fontSize(24)
     .fillColor('#FFFFFF')
     .text('HDS Group Cutlist', 50, 65, { align: 'center', width: doc.page.width - 100 });

  doc.fontSize(16)
     .fillColor('#FFFFFF')
     .text('2D CUTTING OPTIMIZER', 50, 95, { align: 'center', width: doc.page.width - 100 });

  // Add date and time
  const now = new Date();
  const dateString = now.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  const timeString = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  doc.fontSize(10)
     .fillColor('#000000')
     .text(`Generated: ${dateString} ${timeString}`, 50, 120, { align: 'right', width: doc.page.width - 100 });

  doc.moveDown(3);

  // Add detailed summary information
  const totalStockPieces = solution.stockPieces.length;
  const totalCutPieces = solution.stockPieces.reduce((sum, sp) => sum + sp.cutPieces.length, 0);

  // Calculate basic solution properties
  
  // Calculate total edging required in mm
  let totalEdging = 0;
  solution.stockPieces.forEach((sp: any) => {
    sp.cutPieces.forEach((cp: any) => {
      // Count edges that need edging (L1, L2, W1, W2)
      const edgingNeeded = [
        cp.edgeL1 ? cp.length : 0,
        cp.edgeL2 ? cp.length : 0,
        cp.edgeW1 ? cp.width : 0,
        cp.edgeW2 ? cp.width : 0
      ].reduce((sum: number, val: number) => sum + val, 0);
      
      totalEdging += edgingNeeded;
    });
  });
  
  // Convert edging to meters and calculate cost (includes 10% allowance)
  const EDGING_PRICE_PER_METER = 14; // R14 per meter
  const EDGING_ALLOWANCE_FACTOR = 1.10; // +10%
  const totalEdgingWithAllowanceMm = Math.round(totalEdging * EDGING_ALLOWANCE_FACTOR);
  const totalEdgingMeters = totalEdgingWithAllowanceMm / 1000;
  const edgingCost = totalEdgingMeters * EDGING_PRICE_PER_METER;

  // Calculate total area and waste
  let totalStockArea = 0;
  let totalCutArea = 0;

  solution.stockPieces.forEach(stockPiece => {
    const stockArea = stockPiece.width * stockPiece.length;
    totalStockArea += stockArea;

    stockPiece.cutPieces.forEach(cutPiece => {
      totalCutArea += cutPiece.width * cutPiece.length;
    });
  });

  const wasteArea = totalStockArea - totalCutArea;
  const wastePercentage = ((wasteArea / totalStockArea) * 100).toFixed(2);

  // Create a detailed summary table
  doc.fontSize(14).text(`Optimization Summary`, { underline: true });
  doc.moveDown(0.5);

  // Draw summary table
  const summaryStartX = 50;
  const summaryStartY = doc.y;
  const summaryColWidths = [200, 100, 150];
  const summaryRowHeight = 25;

  // Draw table headers
  doc.rect(summaryStartX, summaryStartY, summaryColWidths[0] + summaryColWidths[1] + summaryColWidths[2], summaryRowHeight)
     .fillAndStroke('#e0e0e0', '#000000');

  doc.fontSize(10).fillColor('#000000');
  doc.text('Parameter', summaryStartX + 5, summaryStartY + 8, { width: summaryColWidths[0] });
  doc.text('Value', summaryStartX + summaryColWidths[0] + 5, summaryStartY + 8, { width: summaryColWidths[1] });
  doc.text('Details', summaryStartX + summaryColWidths[0] + summaryColWidths[1] + 5, summaryStartY + 8, { width: summaryColWidths[2] });

  // Draw rows
  let currentSummaryY = summaryStartY + summaryRowHeight;

  // Row 1: Stock Pieces
  doc.rect(summaryStartX, currentSummaryY, summaryColWidths[0] + summaryColWidths[1] + summaryColWidths[2], summaryRowHeight)
     .stroke();
  doc.text('Stock Pieces Used', summaryStartX + 5, currentSummaryY + 8, { width: summaryColWidths[0] });
  doc.text(`${totalStockPieces}`, summaryStartX + summaryColWidths[0] + 5, currentSummaryY + 8, { width: summaryColWidths[1] });
  doc.text(`Total sheets/panels`, summaryStartX + summaryColWidths[0] + summaryColWidths[1] + 5, currentSummaryY + 8, { width: summaryColWidths[2] });
  currentSummaryY += summaryRowHeight;

  // Row 2: Cut Pieces
  doc.rect(summaryStartX, currentSummaryY, summaryColWidths[0] + summaryColWidths[1] + summaryColWidths[2], summaryRowHeight)
     .stroke();
  doc.text('Cut Pieces Placed', summaryStartX + 5, currentSummaryY + 8, { width: summaryColWidths[0] });
  doc.text(`${totalCutPieces}`, summaryStartX + summaryColWidths[0] + 5, currentSummaryY + 8, { width: summaryColWidths[1] });
  doc.text(`Total parts cut`, summaryStartX + summaryColWidths[0] + summaryColWidths[1] + 5, currentSummaryY + 8, { width: summaryColWidths[2] });
  currentSummaryY += summaryRowHeight;

  // Row 3: Total Stock Area
  const unitLabel = unit === 0 ? 'mm' : unit === 1 ? 'in' : 'ft';
  const totalStockAreaConverted = convertUnit(totalStockArea, 0, unit).toFixed(2);

  doc.rect(summaryStartX, currentSummaryY, summaryColWidths[0] + summaryColWidths[1] + summaryColWidths[2], summaryRowHeight)
     .stroke();
  doc.text('Total Stock Area', summaryStartX + 5, currentSummaryY + 8, { width: summaryColWidths[0] });
  doc.text(`${totalStockAreaConverted} ${unitLabel}`, summaryStartX + summaryColWidths[0] + 5, currentSummaryY + 8, { width: summaryColWidths[1] });
  doc.text(`Total material area`, summaryStartX + summaryColWidths[0] + summaryColWidths[1] + 5, currentSummaryY + 8, { width: summaryColWidths[2] });
  currentSummaryY += summaryRowHeight;

  // Row 4: Total Cut Area
  const totalCutAreaConverted = convertUnit(totalCutArea, 0, unit).toFixed(2);

  doc.rect(summaryStartX, currentSummaryY, summaryColWidths[0] + summaryColWidths[1] + summaryColWidths[2], summaryRowHeight)
     .stroke();
  doc.text('Total Cut Area', summaryStartX + 5, currentSummaryY + 8, { width: summaryColWidths[0] });
  doc.text(`${totalCutAreaConverted} ${unitLabel}`, summaryStartX + summaryColWidths[0] + 5, currentSummaryY + 8, { width: summaryColWidths[1] });
  doc.text(`Total used material`, summaryStartX + summaryColWidths[0] + summaryColWidths[1] + 5, currentSummaryY + 8, { width: summaryColWidths[2] });
  currentSummaryY += summaryRowHeight;

  // Row 5: Waste Area
  const wasteAreaConverted = convertUnit(wasteArea, 0, unit).toFixed(2);

  doc.rect(summaryStartX, currentSummaryY, summaryColWidths[0] + summaryColWidths[1] + summaryColWidths[2], summaryRowHeight)
     .fillAndStroke('#fff0f0', '#000000');
  doc.text('Waste Area', summaryStartX + 5, currentSummaryY + 8, { width: summaryColWidths[0] });
  doc.text(`${wasteAreaConverted} ${unitLabel}`, summaryStartX + summaryColWidths[0] + 5, currentSummaryY + 8, { width: summaryColWidths[1] });
  doc.text(`${wastePercentage}% of total material`, summaryStartX + summaryColWidths[0] + summaryColWidths[1] + 5, currentSummaryY + 8, { width: summaryColWidths[2] });
  currentSummaryY += summaryRowHeight;

  // Row 6: Edging Cost
  doc.rect(summaryStartX, currentSummaryY, summaryColWidths[0] + summaryColWidths[1] + summaryColWidths[2], summaryRowHeight)
     .stroke();
  doc.text('Edging Cost', summaryStartX + 5, currentSummaryY + 8, { width: summaryColWidths[0] });
  doc.text(`R ${edgingCost.toFixed(2)}`, summaryStartX + summaryColWidths[0] + 5, currentSummaryY + 8, { width: summaryColWidths[1] });
  doc.text(`Total edging cost`, summaryStartX + summaryColWidths[0] + summaryColWidths[1] + 5, currentSummaryY + 8, { width: summaryColWidths[2] });
  currentSummaryY += summaryRowHeight;

  // Row 7: Layout Type
  doc.rect(summaryStartX, currentSummaryY, summaryColWidths[0] + summaryColWidths[1] + summaryColWidths[2], summaryRowHeight)
     .stroke();
  doc.text('Layout Type', summaryStartX + 5, currentSummaryY + 8, { width: summaryColWidths[0] });
  doc.text(`${layout === 0 ? 'Guillotine' : 'Nested'}`, summaryStartX + summaryColWidths[0] + 5, currentSummaryY + 8, { width: summaryColWidths[1] });
  doc.text(`Cutting algorithm used`, summaryStartX + summaryColWidths[0] + summaryColWidths[1] + 5, currentSummaryY + 8, { width: summaryColWidths[2] });
  currentSummaryY += summaryRowHeight;

  // Row 8: Cut Width
  const cutWidthConverted = convertUnit(cutWidth, 0, unit).toFixed(2);
  const unitLabelSingle = unit === 0 ? 'mm' : unit === 1 ? 'in' : 'ft';

  doc.rect(summaryStartX, currentSummaryY, summaryColWidths[0] + summaryColWidths[1] + summaryColWidths[2], summaryRowHeight)
     .stroke();
  doc.text('Cut Width', summaryStartX + 5, currentSummaryY + 8, { width: summaryColWidths[0] });
  doc.text(`${cutWidthConverted} ${unitLabelSingle}`, summaryStartX + summaryColWidths[0] + 5, currentSummaryY + 8, { width: summaryColWidths[1] });
  doc.text(`Saw blade thickness`, summaryStartX + summaryColWidths[0] + summaryColWidths[1] + 5, currentSummaryY + 8, { width: summaryColWidths[2] });

  doc.moveDown(3);

  // Draw layout diagrams
  
  // Calculate positions for stock piece layouts
  const stockTitleX = 50;
  const stockTitleY = currentSummaryY + 50; // Position below the summary
  const stockTitleWidth = 500;
  
  // Draw each stock piece layout
  solution.stockPieces.forEach((stockPiece, index) => {
    const stockTitleHeight = 30;

    doc.rect(stockTitleX, stockTitleY, stockTitleWidth, stockTitleHeight)
       .fillAndStroke('#003366', '#000000');

    doc.fontSize(14)
       .fillColor('#FFFFFF')
       .text(`CASE ${index + 1}`, stockTitleX, stockTitleY + 8,
             { align: 'center', width: stockTitleWidth });

    // Add stock piece details in a table format
    const stockDetailsStartX = 50;
    const stockDetailsStartY = stockTitleY + stockTitleHeight + 10;
    const stockDetailsColWidths = [100, 100, 100, 100];
    const stockDetailsRowHeight = 25;

    // Draw header
    doc.rect(stockDetailsStartX, stockDetailsStartY,
             stockDetailsColWidths.reduce((a, b) => a + b, 0),
             stockDetailsRowHeight)
       .fillAndStroke('#e0e0e0', '#000000');

    doc.fontSize(10).fillColor('#000000');
    doc.text('Resource', stockDetailsStartX + 5, stockDetailsStartY + 8,
             { width: stockDetailsColWidths[0] });
    doc.text('Width', stockDetailsStartX + stockDetailsColWidths[0] + 5,
             stockDetailsStartY + 8, { width: stockDetailsColWidths[1] });
    doc.text('Length', stockDetailsStartX + stockDetailsColWidths[0] +
             stockDetailsColWidths[1] + 5, stockDetailsStartY + 8,
             { width: stockDetailsColWidths[2] });
    doc.text('Area', stockDetailsStartX + stockDetailsColWidths[0] +
             stockDetailsColWidths[1] + stockDetailsColWidths[2] + 5,
             stockDetailsStartY + 8, { width: stockDetailsColWidths[3] });

    // Draw data row
    const stockDetailsDataY = stockDetailsStartY + stockDetailsRowHeight;
    doc.rect(stockDetailsStartX, stockDetailsDataY,
             stockDetailsColWidths.reduce((a, b) => a + b, 0),
             stockDetailsRowHeight)
       .stroke();

    const stockWidth = convertUnit(stockPiece.width, 0, unit).toFixed(1);
    const stockLength = convertUnit(stockPiece.length, 0, unit).toFixed(1);
    const stockAreaFormatted = (parseFloat(stockWidth) * parseFloat(stockLength)).toFixed(2);

    doc.text(`Case ${index + 1}`, stockDetailsStartX + 5, stockDetailsDataY + 8,
             { width: stockDetailsColWidths[0] });
    doc.text(`${stockWidth} ${unitLabel}`, stockDetailsStartX + stockDetailsColWidths[0] + 5,
             stockDetailsDataY + 8, { width: stockDetailsColWidths[1] });
    doc.text(`${stockLength} ${unitLabel}`, stockDetailsStartX + stockDetailsColWidths[0] +
             stockDetailsColWidths[1] + 5, stockDetailsDataY + 8,
             { width: stockDetailsColWidths[2] });
    doc.text(`${stockAreaFormatted} ${unitLabel}`, stockDetailsStartX + stockDetailsColWidths[0] +
             stockDetailsColWidths[1] + stockDetailsColWidths[2] + 5,
             stockDetailsDataY + 8, { width: stockDetailsColWidths[3] });

    doc.moveDown(3);

    // Calculate scale to fit on page
    const pageWidth = 500;
    const pageHeight = 700;
    const scale = Math.min(
      pageWidth / stockPiece.width,
      pageHeight / stockPiece.length
    ) * 0.8;

    // Draw stock piece
    const startX = 50;
    const startY = 120;

    // Draw stock piece outline
    doc.rect(
      startX,
      startY,
      stockPiece.width * scale,
      stockPiece.length * scale
    ).stroke('#000000');

    // Draw cut pieces
    stockPiece.cutPieces.forEach((cutPiece, pieceIndex) => {
      // Generate a color for this piece (pastel colors for better visibility)
      const colors = [
        '#FFD6D6', // light pink
        '#D6FFDB', // light green
        '#D6F0FF', // light blue
        '#FFF7D6', // light yellow
        '#EBD6FF', // light purple
        '#FFE4D6', // light orange
        '#D6FFFF'  // light cyan
      ];
      const fillColor = colors[pieceIndex % colors.length];

      // Draw cut piece
      doc.rect(
        startX + cutPiece.x * scale,
        startY + cutPiece.y * scale,
        cutPiece.width * scale,
        cutPiece.length * scale
      ).fillAndStroke(fillColor, '#000000');

      // Add ID label in the center
      const labelX = startX + cutPiece.x * scale + (cutPiece.width * scale / 2);
      const labelY = startY + cutPiece.y * scale + (cutPiece.length * scale / 2);

      // Draw the ID in the center with larger font
      doc.fontSize(14)
         .fillColor('#000000')
         .text(
           `${cutPiece.externalId}`,
           labelX - 10,
           labelY - 10,
           { width: 20, align: 'center' }
         );

      // Draw width dimension on top
      const widthLabel = convertUnit(cutPiece.width, 0, unit).toFixed(0);
      doc.fontSize(8)
         .fillColor('#000000')
         .text(
           widthLabel,
           startX + cutPiece.x * scale + (cutPiece.width * scale / 2) - 10,
           startY + cutPiece.y * scale - 12,
           { width: 20, align: 'center' }
         );

      // Draw length dimension on the left side
      const lengthLabel = convertUnit(cutPiece.length, 0, unit).toFixed(0);
      doc.fontSize(8)
         .fillColor('#000000')
         .text(
           lengthLabel,
           startX + cutPiece.x * scale - 20,
           startY + cutPiece.y * scale + (cutPiece.length * scale / 2) - 5,
           { width: 20, align: 'center' }
         );

      // Draw dimension lines
      // Top width line
      doc.moveTo(startX + cutPiece.x * scale, startY + cutPiece.y * scale - 5)
         .lineTo(startX + cutPiece.x * scale + cutPiece.width * scale, startY + cutPiece.y * scale - 5)
         .stroke('#000000');

      // Left length line
      doc.moveTo(startX + cutPiece.x * scale - 5, startY + cutPiece.y * scale)
         .lineTo(startX + cutPiece.x * scale - 5, startY + cutPiece.y * scale + cutPiece.length * scale)
         .stroke('#000000');

      // Draw small ticks at the ends of dimension lines
      // Top width ticks
      doc.moveTo(startX + cutPiece.x * scale, startY + cutPiece.y * scale - 3)
         .lineTo(startX + cutPiece.x * scale, startY + cutPiece.y * scale - 7)
         .stroke('#000000');
      doc.moveTo(startX + cutPiece.x * scale + cutPiece.width * scale, startY + cutPiece.y * scale - 3)
         .lineTo(startX + cutPiece.x * scale + cutPiece.width * scale, startY + cutPiece.y * scale - 7)
         .stroke('#000000');

      // Left length ticks
      doc.moveTo(startX + cutPiece.x * scale - 3, startY + cutPiece.y * scale)
         .lineTo(startX + cutPiece.x * scale - 7, startY + cutPiece.y * scale)
         .stroke('#000000');
      doc.moveTo(startX + cutPiece.x * scale - 3, startY + cutPiece.y * scale + cutPiece.length * scale)
         .lineTo(startX + cutPiece.x * scale - 7, startY + cutPiece.y * scale + cutPiece.length * scale)
         .stroke('#000000');
    });

    // Add cut pieces table with colored header
    doc.moveDown(2);

    // Create a colored header for the cut pieces table
    const cutPiecesTitleX = 50;
    const cutPiecesTitleY = doc.y;
    const cutPiecesTitleWidth = doc.page.width - 100;
    const cutPiecesTitleHeight = 30;

    doc.rect(cutPiecesTitleX, cutPiecesTitleY, cutPiecesTitleWidth, cutPiecesTitleHeight)
       .fillAndStroke('#003366', '#000000');

    doc.fontSize(14)
       .fillColor('#FFFFFF')
       .text('CUTTED PARTS', cutPiecesTitleX, cutPiecesTitleY + 8,
             { align: 'center', width: cutPiecesTitleWidth });

    doc.moveDown(2);

    const tableTop = doc.y;
    const colWidths = [80, 80, 80, 60, 80, 80];
    const rowHeight = 25;

    // Draw table header
    doc.rect(startX, tableTop, colWidths.reduce((a, b) => a + b, 0), rowHeight)
       .fillAndStroke('#4682B4', '#000000'); // Steel blue header

    doc.fontSize(10).fillColor('#FFFFFF');
    doc.text('Part Name', startX + 5, tableTop + 8, { width: colWidths[0] });
    doc.text('X', startX + colWidths[0] + 5, tableTop + 8, { width: colWidths[1], align: 'center' });
    doc.text('Y', startX + colWidths[0] + colWidths[1] + 5, tableTop + 8, { width: colWidths[2], align: 'center' });
    doc.text('Count', startX + colWidths[0] + colWidths[1] + colWidths[2] + 5, tableTop + 8, { width: colWidths[3], align: 'center' });
    doc.text('Width', startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 5, tableTop + 8, { width: colWidths[4], align: 'center' });
    doc.text('Length', startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + 5, tableTop + 8, { width: colWidths[5], align: 'center' });

    // Group cut pieces by dimensions to count similar pieces
    const groupedPieces = new Map();

    stockPiece.cutPieces.forEach(cutPiece => {
      const key = `${cutPiece.width}-${cutPiece.length}`;
      if (!groupedPieces.has(key)) {
        groupedPieces.set(key, {
          width: cutPiece.width,
          length: cutPiece.length,
          count: 1,
          pieces: [cutPiece]
        });
      } else {
        const group = groupedPieces.get(key);
        group.count++;
        group.pieces.push(cutPiece);
      }
    });

    // Draw cut pieces in the table
    let currentY = tableTop + rowHeight;
    let partIndex = 0;

    Array.from(groupedPieces.values()).forEach((group, idx) => {
      partIndex++;
      const partName = String.fromCharCode(65 + (idx % 26)); // A, B, C, ...

      // Get the first piece in the group for position reference
      const firstPiece = group.pieces[0];

      // Unit is handled in the width/length conversion
      const width = convertUnit(group.width, 0, unit).toFixed(1);
      const length = convertUnit(group.length, 0, unit).toFixed(1);
      const x = convertUnit(firstPiece.x, 0, unit).toFixed(1);
      const y = convertUnit(firstPiece.y, 0, unit).toFixed(1);

      // Alternate row background for better readability
      if (idx % 2 === 1) {
        doc.rect(startX, currentY, colWidths.reduce((a, b) => a + b, 0), rowHeight)
           .fillAndStroke('#F0F8FF', '#000000'); // Light blue background
      } else {
        doc.rect(startX, currentY, colWidths.reduce((a, b) => a + b, 0), rowHeight)
           .fillAndStroke('#FFFFFF', '#000000'); // White background
      }

      doc.fillColor('#000000');
      doc.text(partName, startX + 5, currentY + 8, { width: colWidths[0] });
      doc.text(x, startX + colWidths[0] + 5, currentY + 8, { width: colWidths[1], align: 'center' });
      doc.text(y, startX + colWidths[0] + colWidths[1] + 5, currentY + 8, { width: colWidths[2], align: 'center' });
      doc.text(group.count.toString(), startX + colWidths[0] + colWidths[1] + colWidths[2] + 5, currentY + 8, { width: colWidths[3], align: 'center' });
      doc.text(width, startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 5, currentY + 8, { width: colWidths[4], align: 'center' });
      doc.text(length, startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + 5, currentY + 8, { width: colWidths[5], align: 'center' });

      currentY += rowHeight;

      // Update the externalId of each piece in the group to use the part name
      group.pieces.forEach((piece: PlacedPiece) => {
        piece.externalId = partName;
      });
    });

    // Draw table border
    doc.rect(startX, tableTop, colWidths.reduce((a, b) => a + b, 0), currentY - tableTop)
       .stroke('#000000');

    // Add additional information table with colored header
    doc.moveDown(2);

    // Create a colored header for the info table
    const infoTitleX = 50;
    const infoTitleY = doc.y;
    const infoTitleWidth = doc.page.width - 100;
    const infoTitleHeight = 30;

    doc.rect(infoTitleX, infoTitleY, infoTitleWidth, infoTitleHeight)
       .fillAndStroke('#003366', '#000000');

    doc.fontSize(14)
       .fillColor('#FFFFFF')
       .text('CUTTING PARAMETERS', infoTitleX, infoTitleY + 8,
             { align: 'center', width: infoTitleWidth });

    doc.moveDown(2);

    const infoTableTop = doc.y;
    const infoColWidths = [150, 150];

    // Draw info table header
    doc.rect(startX, infoTableTop, infoColWidths[0] + infoColWidths[1], rowHeight)
       .fillAndStroke('#4682B4', '#000000');

    doc.fontSize(10).fillColor('#FFFFFF');
    doc.text('Parameter', startX + 5, infoTableTop + 8, { width: infoColWidths[0] });
    doc.text('Value', startX + infoColWidths[0] + 5, infoTableTop + 8, { width: infoColWidths[1] });

    let infoCurrentY = infoTableTop + rowHeight;

    // Row 1: Guillotine Cutting
    doc.rect(startX, infoCurrentY, infoColWidths[0] + infoColWidths[1], rowHeight)
       .fillAndStroke('#F0F8FF', '#000000'); // Light blue background
    doc.fillColor('#000000');
    doc.text('Guillotine Cutting', startX + 5, infoCurrentY + 8, { width: infoColWidths[0] });
    doc.text(layout === 0 ? 'Yes' : 'No', startX + infoColWidths[0] + 5, infoCurrentY + 8, { width: infoColWidths[1] });
    infoCurrentY += rowHeight;

    // Row 2: Rotating
    doc.rect(startX, infoCurrentY, infoColWidths[0] + infoColWidths[1], rowHeight)
       .fillAndStroke('#FFFFFF', '#000000'); // White background
    doc.text('Rotating', startX + 5, infoCurrentY + 8, { width: infoColWidths[0] });
    // Check if any pieces have canRotate=true
    const canRotate = stockPiece.cutPieces.some(p => p.canRotate);
    doc.text(canRotate ? 'Yes' : 'No', startX + infoColWidths[0] + 5, infoCurrentY + 8, { width: infoColWidths[1] });
    infoCurrentY += rowHeight;

    // Row 3: Waste
    const stockAreaValue = stockPiece.width * stockPiece.length;
    let usedAreaValue = 0;
    stockPiece.cutPieces.forEach(p => {
      usedAreaValue += p.width * p.length;
    });
    const wasteAreaValue = stockAreaValue - usedAreaValue;
    const wastePercentage = ((wasteAreaValue / stockAreaValue) * 100).toFixed(2);

    doc.rect(startX, infoCurrentY, infoColWidths[0] + infoColWidths[1], rowHeight)
       .fillAndStroke('#FFECEC', '#000000'); // Light red background for waste
    doc.text('Waste', startX + 5, infoCurrentY + 8, { width: infoColWidths[0] });
    doc.text(`${convertUnit(wasteAreaValue, 0, unit).toFixed(2)} ${unitLabel} (${wastePercentage}%)`,
             startX + infoColWidths[0] + 5, infoCurrentY + 8, { width: infoColWidths[1] });

    // Row 4: Edging Cost
    doc.rect(startX, infoCurrentY + rowHeight, infoColWidths[0] + infoColWidths[1], rowHeight)
       .fillAndStroke('#F0F8FF', '#000000'); // Light blue background
    doc.fillColor('#000000');
    doc.text('Edging Cost', startX + 5, (infoCurrentY + rowHeight) + 8, { width: infoColWidths[0] });
    doc.text(`R ${edgingCost.toFixed(2)}`, startX + infoColWidths[0] + 5, (infoCurrentY + rowHeight) + 8, { width: infoColWidths[1] });
  });

  // Add a simple footer to the last page
  doc.fontSize(8).fillColor('#666666');
  doc.text(
    `HDS Group Cutlist - Generated on ${dateString}`,
    50,
    doc.page.height - 50,
    { align: 'center', width: doc.page.width - 100 }
  );

  // Finalize PDF
  doc.end();

  return pdfId;
};

// Generate a PDF invoice from quote data
export const generateInvoicePdf = (quoteData: any, branchData?: any): Promise<{ buffer: any, id: string }> => {
  return new Promise((resolve, reject) => {
    try {
      console.log('Generating invoice PDF for quote:', quoteData.quote_number || quoteData.id);
      
      // Extract data from quote with better fallback handling
      const quoteId = quoteData.quote_number || quoteData.id || `INV-${Date.now()}`;
      const customerName = quoteData.customer_name || quoteData.customerName || 'Customer';
      const projectName = quoteData.project_name || quoteData.projectName || 'Project';
      const quoteDate = quoteData.created_at ? new Date(quoteData.created_at).toLocaleDateString() : new Date().toLocaleDateString();
      const invoiceDate = new Date().toLocaleDateString();
      const invoiceNumber = `INV-${quoteId}-${Date.now()}`;
      
      // Parse quote data with better structure handling
      let parsedQuoteData;
      try {
        parsedQuoteData = typeof quoteData.quote_data === 'string' 
          ? JSON.parse(quoteData.quote_data) 
          : quoteData.quote_data || quoteData;
      } catch (e) {
        console.warn('Could not parse quote_data, using fallback');
        parsedQuoteData = { items: [], totals: { finalTotal: 0 } };
      }
      
      // Extract sections data (same as quote PDF)
      const sections = parsedQuoteData.sections || [];
      
      // Debug: Log the sections data structure
      console.log('🔍 DEBUG: Sections data:', JSON.stringify(sections, null, 2));
      console.log('🔍 DEBUG: Number of sections found:', sections.length);
      
      // Calculate totals using the same logic as quote PDF
      const EDGING_PRICE_PER_METER = 14; // R14 per meter
      let totalEdgingMeters = 0;
      
      console.log('💰 Extracting amounts from quote data...');
      
      let boardTotal = 0;
      let totalEdgingCost = 0;
      let totalCuttingFee = 0;
      let finalTotal = 0;
      
      // Parse quote data to get the actual totals
      try {
        const parsedQuoteData = JSON.parse(quoteData.quote_data || '{}');
        console.log('📊 Parsed quote data keys:', Object.keys(parsedQuoteData));
        
        // Always calculate edging and cutting fees from sections data first
        if (sections && sections.length > 0) {
          console.log('💰 Calculating edging and cutting fees from sections...');
          console.log('🔍 DEBUG: Processing', sections.length, 'sections');
          
          // Calculate sectionTotal for each section if not already calculated
          sections.forEach((section: any, index: number) => {
            console.log(`🔍 DEBUG: Section ${index}:`, {
              material: section.material,
              pricePerBoard: section.pricePerBoard,
              boardsNeeded: section.boardsNeeded,
              sectionTotal: section.sectionTotal,
              edging: section.edging
            });
            
            if (!section.sectionTotal && section.pricePerBoard && section.boardsNeeded) {
              section.sectionTotal = parseFloat((section.pricePerBoard * section.boardsNeeded).toFixed(2));
            }
          });

          // Calculate edging costs for each section
          sections.forEach((section: any, index: number) => {
            console.log(`🔍 DEBUG: Processing edging for section ${index}`);
            console.log(`🔍 DEBUG: Section edging data:`, section.edging);
            
            if (section.edging && section.edging.totalEdging > 0) {
              // Convert from mm to meters
              const edgingMeters = section.edging.totalEdging / 1000;
              totalEdgingMeters += edgingMeters;
              
              console.log(`🔍 DEBUG: Section ${index} edging: ${section.edging.totalEdging}mm = ${edgingMeters}m`);
              
              // Use the already calculated cost from the controller if available
              if (section.edging.cost !== undefined) {
                section.edgingCost = parseFloat(section.edging.cost);
                totalEdgingCost += section.edgingCost;
                console.log(`🔍 DEBUG: Using pre-calculated edging cost: R${section.edgingCost}`);
              } else {
                // Fallback calculation if cost not provided
                const edgingCost = (edgingMeters * EDGING_PRICE_PER_METER).toFixed(2);
                section.edgingCost = parseFloat(edgingCost);
                totalEdgingCost += section.edgingCost;
                console.log(`🔍 DEBUG: Calculated edging cost: ${edgingMeters}m × R${EDGING_PRICE_PER_METER} = R${edgingCost}`);
              }
            } else {
              section.edgingCost = 0;
              console.log(`🔍 DEBUG: Section ${index} has no edging`);
            }
          });
          
          // Round the total edging cost to 2 decimal places
          totalEdgingCost = parseFloat(totalEdgingCost.toFixed(2));
          console.log(`🔍 DEBUG: Total edging meters: ${totalEdgingMeters}m`);
          console.log(`🔍 DEBUG: Total edging cost: R${totalEdgingCost}`);
          
          // Calculate cutting fee (R70 per board)
          const cuttingFeePerBoard = 70; // R70 per board
          const totalBoardsUsed = sections.reduce((sum: number, section: any) => sum + (section.boardsNeeded || 0), 0);
          totalCuttingFee = parseFloat((totalBoardsUsed * cuttingFeePerBoard).toFixed(2));
          
          console.log(`🔍 DEBUG: Total boards used: ${totalBoardsUsed}`);
          console.log(`🔍 DEBUG: Cutting fee: ${totalBoardsUsed} boards × R${cuttingFeePerBoard} = R${totalCuttingFee}`);
          
          console.log('✅ Calculated fees - Edging:', totalEdgingCost, 'Cutting:', totalCuttingFee);
        } else {
          console.log('⚠️ DEBUG: No sections found or sections array is empty');
        }
        
        // Now determine the base total amount
        if (parsedQuoteData.totals) {
          // Use the totals from the quote data
          const quoteTotals = parsedQuoteData.totals;
          console.log('💰 Found totals in quote data:', quoteTotals);
          
          // The quote already has calculated totals - use the subtotal as our base
          finalTotal = parseFloat(quoteTotals.subtotal || quoteTotals.finalTotal || 0);
          
          // Calculate board total by subtracting fees from final total
          boardTotal = finalTotal - totalEdgingCost - totalCuttingFee;
          if (boardTotal < 0) boardTotal = finalTotal; // Fallback if calculation doesn't make sense
          
          console.log('✅ Using quote subtotal as base amount:', finalTotal);
        } else if (parsedQuoteData.items && Array.isArray(parsedQuoteData.items)) {
          // Fallback: calculate from items if totals not available
          console.log('📦 Calculating from items...');
          parsedQuoteData.items.forEach((item: any) => {
            if (item.total && !isNaN(item.total)) {
              finalTotal += parseFloat(item.total);
            }
          });
          boardTotal = finalTotal - totalEdgingCost - totalCuttingFee;
          if (boardTotal < 0) boardTotal = finalTotal;
          console.log('✅ Calculated total from items:', finalTotal);
        } else if (sections && sections.length > 0) {
          // Calculate from sections data
          console.log('📦 Calculating from sections...');
          
          // Calculate initial grand total from board costs
          boardTotal = sections.reduce((sum: number, section: any) => sum + (section.sectionTotal || 0), 0);
          boardTotal = parseFloat(boardTotal.toFixed(2));
          
          // Calculate final grand total with edging and cutting fee included
          finalTotal = boardTotal + totalEdgingCost + totalCuttingFee;
          
          console.log('✅ Calculated from sections - Board:', boardTotal, 'Edging:', totalEdgingCost, 'Cutting:', totalCuttingFee, 'Total:', finalTotal);
        }
        
      } catch (parseError) {
        console.error('❌ Error parsing quote data for amounts:', parseError);
        // Use fallback amounts if parsing fails
        finalTotal = 0;
        boardTotal = 0;
      }
      
      // PRIORITY FIX: Calculate board total directly from sections (same as quote PDF)
      if (sections && sections.length > 0) {
        // Calculate board total from sections (same as quote PDF logic)
        boardTotal = sections.reduce((sum: number, section: any) => sum + (section.sectionTotal || 0), 0);
        boardTotal = parseFloat(boardTotal.toFixed(2));
        console.log('✅ Board total calculated from sections:', boardTotal);
        
        // Calculate final total as: board total + edging + cutting fee
        finalTotal = boardTotal + totalEdgingCost + totalCuttingFee;
        console.log('✅ Final total calculated as board + edging + cutting:', finalTotal);
      } else if (quoteData.total && !isNaN(quoteData.total)) {
        console.log('⚠️ No sections data, using database quote.total as fallback:', quoteData.total);
        finalTotal = parseFloat(quoteData.total);
        // Estimate board total (fallback only)
        boardTotal = finalTotal - totalEdgingCost - totalCuttingFee;
        if (boardTotal < 0) boardTotal = finalTotal * 0.8;
      } else {
        console.log('⚠️ No sections or quote.total found, using calculated amounts');
        // Keep the calculated amounts from above logic
      }
      
      // Define variables needed for PDF display
      const cuttingFeePerBoard = 70; // R70 per board (for display purposes)
      const totalBoardsUsed = sections.length > 0 
        ? sections.reduce((sum: number, section: any) => sum + (section.boardsNeeded || 0), 0)
        : Math.ceil(finalTotal / 500); // Estimate boards if no sections data
      
      console.log('💰 Final amounts for invoice:');
      console.log('  Board Total:', boardTotal);
      console.log('  Edging Cost:', totalEdgingCost);
      console.log('  Cutting Fee:', totalCuttingFee);
      console.log('  Total Boards Used:', totalBoardsUsed);
      console.log('  Subtotal (before VAT):', finalTotal);
      
      // Create PDF document
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      
      // Setup buffer to store PDF content
      const buffers: any[] = [];
      let pdfBuffer: any = null;
      
      doc.on('data', (chunk: any) => {
        buffers.push(chunk);
      });
      
      doc.on('end', () => {
        pdfBuffer = Buffer.concat(buffers);
        resolve({
          buffer: pdfBuffer,
          id: invoiceNumber
        });
      });
      
      doc.on('error', (error: any) => {
        console.error('PDF generation error:', error);
        reject(error);
      });
      
      // Generate a unique ID for this invoice
      const pdfId = invoiceNumber;
      
      // ===== INVOICE HEADER =====
      doc.fontSize(28).fillColor('#003366').font('Helvetica-Bold');
      doc.text('INVOICE', 50, 50, { align: 'center', width: doc.page.width - 100 });
      
      doc.moveDown(1);
      
      // Company details (left side) - using dynamic branch data
      console.log('🏢 Branch data received in generateInvoicePdf:', JSON.stringify(branchData, null, 2));
      
      const effectiveBranchData = branchData || {
        name: 'HDS Group',
        trading_as: 'HDS Group',
        branch_address: 'Please contact us for address details',
        branch_telephone: '011 123 4567',
        email_address: 'info@hdsgroup.co.za'
      };
      
      console.log('🏢 Effective branch data:', JSON.stringify(effectiveBranchData, null, 2));
      
      doc.fontSize(12).fillColor('#003366').font('Helvetica-Bold');
      const companyName = effectiveBranchData.trading_as || effectiveBranchData.name || 'HDS Group';
      doc.text(companyName, 50, doc.y);
      console.log('🏢 Company name displayed:', companyName);
      
      doc.font('Helvetica').fontSize(10).fillColor('#333333');
      
      // Address - always show something
      const address = effectiveBranchData.branch_address || 'Please contact us for address details';
      doc.text(address, 50, doc.y + 5);
      console.log('🏢 Address displayed:', address);
      
      // Phone - always show something
      const phone = effectiveBranchData.branch_telephone || '011 123 4567';
      doc.text(`Tel: ${phone}`, 50, doc.y + 5);
      console.log('🏢 Phone displayed:', phone);
      
      // Email - always show something
      const email = effectiveBranchData.email_address || 'info@hdsgroup.co.za';
      doc.text(`Email: ${email}`, 50, doc.y + 5);
      console.log('🏢 Email displayed:', email);
      
      // Invoice details (right side) - improved layout for long invoice numbers
      const rightColumnX = doc.page.width - 280; // Increased width for longer content
      const topY = 120;
      const labelWidth = 90; // Increased label width
      const valueX = rightColumnX + labelWidth + 5; // 5px spacing between label and value
      
      doc.fontSize(12).fillColor('#003366').font('Helvetica-Bold');
      doc.text('Invoice Details', rightColumnX, topY);
      
      doc.font('Helvetica').fontSize(10).fillColor('#333333');
      
      // Invoice Number - use flexible layout with extra spacing
      doc.text('Invoice Number:', rightColumnX, topY + 20, { width: labelWidth });
      doc.text(invoiceNumber, valueX, topY + 20, { width: 180 }); // Allow wrapping if needed
      
      // Invoice Date - increased spacing to prevent overlap with long invoice numbers
      doc.text('Invoice Date:', rightColumnX, topY + 45, { width: labelWidth }); // Was topY + 35
      doc.text(invoiceDate, valueX, topY + 45, { width: 180 });
      
      // Quote Number - may also be long, increased spacing
      doc.text('Quote Number:', rightColumnX, topY + 65, { width: labelWidth }); // Was topY + 50
      doc.text(quoteId, valueX, topY + 65, { width: 180 });
      
      // Quote Date - increased spacing
      doc.text('Quote Date:', rightColumnX, topY + 85, { width: labelWidth }); // Was topY + 65
      doc.text(quoteDate, valueX, topY + 85, { width: 180 });
      
      // Customer details
      doc.y = topY + 100;
      doc.fontSize(12).fillColor('#003366').font('Helvetica-Bold');
      doc.text('Bill To:', 50, doc.y);
      
      doc.font('Helvetica').fontSize(10).fillColor('#333333');
      doc.text(customerName, 50, doc.y + 15);
      doc.text(projectName, 50, doc.y + 15);
      
      doc.moveDown(2);
      
      // ===== INVOICE SUMMARY (SIMPLIFIED) =====
      doc.moveDown(2);
      
      const pageWidth = doc.page.width - 100;
      doc.fontSize(14).fillColor('#000000').font('Helvetica-Bold');
      doc.text('Invoice Summary', 50, doc.y, { align: 'center', width: pageWidth });
      doc.font('Helvetica').fontSize(10).fillColor('#333333');
      doc.moveDown(0.3);
      
      // Create a summary table
      const summaryStartY = doc.y;
      const summaryColWidth = (doc.page.width - 100) / 2;
      const summaryRowHeight = 25;
      
      // Table header
      doc.rect(50, summaryStartY, summaryColWidth * 2, summaryRowHeight)
         .fillAndStroke('#cccccc', '#000000');
      
      doc.fontSize(12).fillColor('#000000');
      doc.text('Description', 60, summaryStartY + 8);
      doc.text('Amount', 60 + summaryColWidth, summaryStartY + 8);
      
      let summaryY = summaryStartY + summaryRowHeight;
      
      // Board costs row
      doc.rect(50, summaryY, summaryColWidth * 2, summaryRowHeight).stroke();
      doc.text('Total Board Cost', 60, summaryY + 8);
      doc.text(`R ${boardTotal.toFixed(2)}`, 60 + summaryColWidth, summaryY + 8);
      
      summaryY += summaryRowHeight;
      
      // Edging costs row
      doc.rect(50, summaryY, summaryColWidth * 2, summaryRowHeight).stroke();
      doc.text(`Total Edging Cost (${totalEdgingMeters.toFixed(2)}m @ R${EDGING_PRICE_PER_METER}/m)`, 60, summaryY + 8);
      doc.text(`R ${totalEdgingCost.toFixed(2)}`, 60 + summaryColWidth, summaryY + 8);
      
      summaryY += summaryRowHeight;

      // Cutting fee row
      doc.rect(50, summaryY, summaryColWidth * 2, summaryRowHeight)
         .fillAndStroke('#ffffff', '#000000');
      doc.fillColor('#000000');
      doc.text(`Cutting Fee (R${cuttingFeePerBoard} per board × ${totalBoardsUsed} board(s))`, 60, summaryY + 8);
      doc.text(`R ${totalCuttingFee.toFixed(2)}`, 60 + summaryColWidth, summaryY + 8);

      summaryY += summaryRowHeight;

      // Grand total row (no VAT)
      doc.rect(50, summaryY, summaryColWidth * 2, summaryRowHeight)
         .fillAndStroke('#003366', '#000000');
      
      doc.fontSize(14).fillColor('#FFFFFF').font('Helvetica-Bold');
      doc.text('TOTAL:', 60, summaryY + 8);
      doc.text(`R ${finalTotal.toFixed(2)}`, 60 + summaryColWidth, summaryY + 8);
      doc.font('Helvetica');
      
      // Payment Status Section
      doc.moveDown(1);
      
      // Payment status box
      const paymentBoxY = doc.y + 10;
      const paymentBoxWidth = doc.page.width - 100;
      const paymentBoxHeight = 40;
      
      // Green background for paid status
      doc.rect(50, paymentBoxY, paymentBoxWidth, paymentBoxHeight)
         .fillAndStroke('#d4edda', '#28a745');
      
      // Payment status text
      doc.fontSize(14).fillColor('#155724').font('Helvetica-Bold');
      doc.text('✓ PAYMENT RECEIVED', 50, paymentBoxY + 12, { 
        align: 'center', 
        width: paymentBoxWidth 
      });
      
      doc.fontSize(10).fillColor('#155724').font('Helvetica');
      doc.text('This invoice has been paid in full', 50, paymentBoxY + 28, { 
        align: 'center', 
        width: paymentBoxWidth 
      });
      
      // Footer
      doc.fontSize(8).fillColor('#666666');
      doc.text('Thank you for your business!', 50, doc.page.height - 100, { align: 'center', width: doc.page.width - 100 });
      doc.text('This invoice was generated automatically. Please contact us if you have any questions.', 50, doc.page.height - 85, { align: 'center', width: doc.page.width - 100 });

      // Set PDF metadata (shows as the document title on phone previews instead of "Untitled")
      doc.info.Title = `HDS Invoice ${invoiceNumber} - ${customerName}`;
      doc.info.Author = 'HDS Cut & Edge Group';
      doc.info.Subject = 'Invoice';
      doc.info.Keywords = 'HDS, invoice, cut and edge, boards';

      doc.end();
      
    } catch (error: any) {
      console.error('❌ Error in generateInvoicePdf:', error);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
      console.error('❌ Error details:', JSON.stringify(error, null, 2));
      reject(new Error(`PDF generation failed: ${error.message || 'Unknown error'}`));
    }
  });
};
// Generate IQ software compatible export data
export const generateIQExport = (solution: Solution, unit: number, cutWidth: number = 3, layout: number = 0): any => {
  // Create an object structure that matches the IQ software import format
  const iqData: any = {
    version: "1.0",
    title: "HDS Group Cutlist Export",
    date: new Date().toISOString(),
    unit: unit === 0 ? "mm" : unit === 1 ? "in" : "ft",
    layout: layout === 0 ? "guillotine" : "nested",
    cutWidth: convertUnit(cutWidth, 0, unit),
    stockPieces: [],
    metadata: {
      source: "HDS Group Cutlist",
      exportType: "optimization",
      optimizationId: uuidv4(),
      settings: {
        allowRotation: true,
        cutWidth: convertUnit(cutWidth, 0, unit),
        algorithm: layout === 0 ? "guillotine" : "nested"
      }
    },
    summary: {
      totalStockPieces: solution.stockPieces.length,
      totalCutPieces: 0,
      totalStockArea: 0,
      totalCutArea: 0,
      totalWaste: 0,
      wastePercentage: 0
    }
  };

  // Process each stock piece
  solution.stockPieces.forEach((stockPiece, stockIndex) => {
    const stockWidth = convertUnit(stockPiece.width, 0, unit);
    const stockLength = convertUnit(stockPiece.length, 0, unit);
    const stockArea = stockWidth * stockLength;

    // Group cut pieces by dimensions
    const groupedPieces = new Map();

    stockPiece.cutPieces.forEach(cutPiece => {
      const key = `${cutPiece.width}-${cutPiece.length}`;
      if (!groupedPieces.has(key)) {
        groupedPieces.set(key, {
          width: cutPiece.width,
          length: cutPiece.length,
          count: 1,
          pieces: [cutPiece]
        });
      } else {
        const group = groupedPieces.get(key);
        group.count++;
        group.pieces.push(cutPiece);
      }
    });

    // Calculate used area and waste
    let usedArea = 0;
    stockPiece.cutPieces.forEach(p => {
      usedArea += p.width * p.length;
    });

    const wasteArea = stockPiece.width * stockPiece.length - usedArea;
    const wastePercentage = (wasteArea / (stockPiece.width * stockPiece.length)) * 100;

    // Convert grouped pieces to array with part names
    const parts = Array.from(groupedPieces.entries()).map(([_, group], index) => {
      const partName = String.fromCharCode(65 + (index % 26)); // A, B, C, ...
      const firstPiece = group.pieces[0];

      return {
        name: partName,
        width: convertUnit(group.width, 0, unit),
        length: convertUnit(group.length, 0, unit),
        count: group.count,
        x: convertUnit(firstPiece.x, 0, unit),
        y: convertUnit(firstPiece.y, 0, unit)
      };
    });

    // Add stock piece to IQ data
    iqData.stockPieces.push({
      id: `Case${stockIndex + 1}`,
      width: stockWidth,
      length: stockLength,
      area: stockArea,
      usedArea: convertUnit(usedArea, 0, unit),
      waste: convertUnit(wasteArea, 0, unit),
      wastePercentage: wastePercentage.toFixed(2),
      parts: parts
    });

    // Update summary data
    iqData.summary.totalCutPieces += stockPiece.cutPieces.length;
    iqData.summary.totalStockArea += stockArea;
    iqData.summary.totalCutArea += convertUnit(usedArea, 0, unit);
  });

  // Calculate total waste
  iqData.summary.totalWaste = iqData.summary.totalStockArea - iqData.summary.totalCutArea;
  iqData.summary.wastePercentage = ((iqData.summary.totalWaste / iqData.summary.totalStockArea) * 100).toFixed(2);

  return iqData;
};

// Import data from IQ software
export const importFromIQ = (iqData: any): { pieces: IPiece[], unit: number, width: number, layout: number } => {
  if (!iqData || typeof iqData !== 'object') {
    throw new Error('Invalid IQ data format');
  }

  // Determine unit from IQ data
  let unit = 0; // Default to mm
  if (iqData.unit) {
    if (iqData.unit === 'in') unit = 1;
    else if (iqData.unit === 'ft') unit = 2;
  }

  // Determine cut width and layout
  const cutWidth = iqData.cutWidth ? convertUnit(iqData.cutWidth, unit, 0) : 3;
  const layout = iqData.layout === 'nested' ? 1 : 0;

  // Process stock pieces
  const pieces: IPiece[] = [];

  // Add stock pieces
  if (Array.isArray(iqData.stockPieces)) {
    iqData.stockPieces.forEach((stockPiece: any) => {
      if (stockPiece.width && stockPiece.length) {
        pieces.push({
          width: convertUnit(stockPiece.width, unit, 0),
          length: convertUnit(stockPiece.length, unit, 0),
          amount: stockPiece.quantity || 1,
          kind: 1, // Stock piece
          pattern: 0 // No pattern by default
        });
      }
    });
  }

  // Add cut pieces
  if (iqData.parts) {
    iqData.parts.forEach((part: any) => {
      if (part.width && part.length) {
        pieces.push({
          width: convertUnit(part.width, unit, 0),
          length: convertUnit(part.length, unit, 0),
          amount: part.quantity || 1,
          kind: 0, // Cut piece
          pattern: 0 // No pattern by default
        });
      }
    });
  } else if (iqData.stockPieces) {
    // Try to extract parts from stock pieces if they exist
    iqData.stockPieces.forEach((stockPiece: any) => {
      if (Array.isArray(stockPiece.parts)) {
        stockPiece.parts.forEach((part: any) => {
          if (part.width && part.length) {
            pieces.push({
              width: convertUnit(part.width, unit, 0),
              length: convertUnit(part.length, unit, 0),
              amount: part.count || 1,
              kind: 0, // Cut piece
              pattern: 0 // No pattern by default
            });
          }
        });
      }
    });
  }

  return {
    pieces,
    unit,
    width: cutWidth,
    layout
  };
};

// Helper to safely format numbers. Returns '-' if value is null/undefined/NaN
const safeFixed = (value: any, digits = 2): string => {
  const num = Number(value);
  return isFinite(num) ? num.toFixed(digits) : '-';
};

// Generate a PDF for quotations — Elegant v2 design (black header, red/gold accents)
export const generateQuotePdf = (quoteData: any, isPaid: boolean = false): Promise<{ buffer: any, id: string }> => {
  const {
    quoteId,
    customerName,
    projectName,
    date,
    sections,
    grandTotal,
    branchData,
    bankingDetails,
    phoneNumber,
    hardwareItems,
    hardwareTotal
  } = quoteData;

  // Colors matching the HTML template
  const COLOR_BLACK = '#000000';
  const COLOR_RED = '#EC2329';
  const COLOR_GOLD = '#DC9826';
  const COLOR_WHITE = '#FFFFFF';
  const COLOR_LIGHT_GRAY = '#F8F8FA';
  const COLOR_BORDER = '#E0E0E0';
  const COLOR_ROW_BORDER = '#F0F0F0';
  const COLOR_TEXT_GRAY = '#888888';
  const COLOR_TEXT_DARK = '#212121';
  const COLOR_TEXT_MED = '#555555';

  // Page dimensions (A4)
  const PAGE_W = 595.28;
  const PAGE_H = 841.89;
  const MARGIN = 40;
  const CONTENT_W = PAGE_W - MARGIN * 2;

  // Create PDF document with no default margins (we control all positioning)
  const doc = new PDFDocument({ size: 'A4', margin: 0 });

  const pdfId = quoteId || `Q-${Date.now()}`;

  // Setup buffer to store PDF content
  const buffers: any[] = [];
  doc.on('data', buffers.push.bind(buffers));

  // Try to load the logo (web-downloaded PNG version, falls back to SVG-converted)
  let logoPath: string | null = null;
  try {
    const webLogo = path.join(__dirname, '..', 'templates', 'hds-logo-web.png');
    if (fs.existsSync(webLogo)) {
      logoPath = webLogo;
    } else {
      const svgLogo = path.join(__dirname, '..', 'templates', 'hds-logo.png');
      if (fs.existsSync(svgLogo)) {
        logoPath = svgLogo;
      }
    }
  } catch (e) {
    console.warn('Logo file not found, proceeding without logo');
  }

  // ====== COST CALCULATIONS (same logic as before) ======
  const EDGING_PRICE_PER_METER = 14;
  let totalEdgingMeters = 0;
  let totalEdgingCost = 0;

  let boardTotal = sections.reduce((sum: number, section: any) => sum + (section.sectionTotal || 0), 0);
  boardTotal = parseFloat(boardTotal.toFixed(2));

  sections.forEach((section: any) => {
    if (section.edging && section.edging.totalEdging > 0) {
      const totalEdgingWithAllowanceMm = Math.round(section.edging.totalEdging * 1.10);
      const edgingMeters = totalEdgingWithAllowanceMm / 1000;
      totalEdgingMeters += edgingMeters;
      const computedEdgingCost = parseFloat((edgingMeters * EDGING_PRICE_PER_METER).toFixed(2));
      section.edgingCost = computedEdgingCost;
      totalEdgingCost += computedEdgingCost;
    } else {
      section.edgingCost = 0;
    }
  });
  totalEdgingCost = parseFloat(totalEdgingCost.toFixed(2));

  const cuttingFeePerBoard = 70;
  const totalBoardsUsed = sections.reduce((sum: number, section: any) => sum + (section.boardsNeeded || 0), 0);
  const totalCuttingFee = parseFloat((totalBoardsUsed * cuttingFeePerBoard).toFixed(2));
  const hwTotal = parseFloat((Number(hardwareTotal || 0)).toFixed(2));
  const finalTotal = boardTotal + totalEdgingCost + totalCuttingFee + hwTotal;

  // ====== HELPER: draw a filled rectangle ======
  const drawRect = (x: number, y: number, w: number, h: number, fill: string, stroke?: string) => {
    if (fill) doc.rect(x, y, w, h).fillAndStroke(fill, stroke || fill);
    else doc.rect(x, y, w, h).stroke(stroke || COLOR_BORDER);
  };

  // ====== HELPER: check remaining space, add page if needed ======
  const ensureSpace = (needed: number, yVal: number): number => {
    if (yVal + needed > PAGE_H - MARGIN) {
      doc.addPage({ size: 'A4', margin: 0 });
      return MARGIN; // new page starts at top margin
    }
    return yVal; // no page break needed, y stays the same
  };

  // ====== 1. HEADER (black background with red/gold gradient bar) ======
  const headerH = 95;
  drawRect(MARGIN, MARGIN, CONTENT_W, headerH, COLOR_BLACK);

  // Red/gold gradient bar at bottom of header (simulate with 3 segments)
  const barH = 4;
  const barW = CONTENT_W / 3;
  drawRect(MARGIN, MARGIN + headerH - barH, barW, barH, COLOR_RED);
  drawRect(MARGIN + barW, MARGIN + headerH - barH, barW, barH, COLOR_GOLD);
  drawRect(MARGIN + barW * 2, MARGIN + headerH - barH, barW, barH, COLOR_RED);

  // Logo (left side) — height ~40pt
  let headerTextX = MARGIN + 15;
  if (logoPath) {
    try {
      doc.image(logoPath, MARGIN + 15, MARGIN + 15, { height: 40 });
      headerTextX = MARGIN + 15 + 100;
    } catch (e) {
      console.warn('Failed to embed logo image:', e);
    }
  }

  // Company name + tagline (next to logo)
  doc.fontSize(16).fillColor(COLOR_WHITE).font('Helvetica-Bold');
  doc.text('HDS Cut & Edge Group', headerTextX, MARGIN + 15, { width: 200 });
  doc.fontSize(9).fillColor(COLOR_GOLD).font('Helvetica');
  doc.text('Creativity from the heart of the wood', headerTextX, MARGIN + 35, { width: 200 });

  // Right side: QUOTATION title + quote ID
  doc.fontSize(20).fillColor(COLOR_WHITE).font('Helvetica-Bold');
  doc.text(isPaid ? 'INVOICE' : 'QUOTATION', MARGIN + CONTENT_W - 200, MARGIN + 15, {
    width: 185, align: 'right'
  });
  doc.fontSize(10).fillColor('#D2D2D2').font('Helvetica');
  doc.text(pdfId, MARGIN + CONTENT_W - 200, MARGIN + 40, {
    width: 185, align: 'right'
  });

  // Header bottom row: website, Est. 2001, tagline with red dot separators
  const headerBottomY = MARGIN + 60;
  const bottomItems = ['www.hdsgroup.co.za', 'Est. 2001', 'Largest Cut & Edge Distributor in Sub-Saharan Africa'];
  let bottomX = MARGIN + 15;
  bottomItems.forEach((item, i) => {
    if (i > 0) {
      doc.fillColor(COLOR_RED);
      doc.circle(bottomX + 2, headerBottomY + 4, 2).fill();
      bottomX += 10;
    }
    doc.fillColor('rgba(255,255,255,0.7)').fontSize(8).font('Helvetica');
    doc.text(item, bottomX, headerBottomY, { width: item.length * 4.5 });
    bottomX += item.length * 4.5 + 5;
  });

  // ====== 2. QUOTE DETAILS (3-column grid with red left borders) ======
  let y = MARGIN + headerH + 5;
  const detailsH = 70;
  drawRect(MARGIN, y, CONTENT_W, detailsH, COLOR_WHITE, COLOR_BORDER);

  const detailLabels = ['Date', 'Customer', 'Project', 'Contact', 'Quote Number', 'Valid For'];
  const detailValues = [
    new Date(date).toLocaleDateString(),
    customerName || 'N/A',
    projectName || 'N/A',
    phoneNumber || 'N/A',
    pdfId,
    '30 Days'
  ];

  const colW = CONTENT_W / 3;
  const rowH = detailsH / 2;
  for (let i = 0; i < 6; i++) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const dx = MARGIN + col * colW;
    const dy = y + row * rowH;

    // Red left border accent
    drawRect(dx + 8, dy + 8, 2, rowH - 16, COLOR_RED);

    // Label
    doc.fontSize(8).fillColor(COLOR_TEXT_GRAY).font('Helvetica');
    doc.text(detailLabels[i].toUpperCase(), dx + 14, dy + 10, { width: colW - 20 });

    // Value
    doc.fontSize(11).fillColor(COLOR_TEXT_DARK).font('Helvetica-Bold');
    doc.text(detailValues[i], dx + 14, dy + 24, { width: colW - 20 });
  }

  y += detailsH + 15;

  // ====== 3. MATERIAL BREAKDOWN ======
  // Section heading with red accent bar
  drawRect(MARGIN, y, 30, 3, COLOR_RED);
  doc.fontSize(13).fillColor(COLOR_BLACK).font('Helvetica-Bold');
  doc.text('MATERIAL BREAKDOWN', MARGIN + 38, y - 5, { width: CONTENT_W - 40 });
  y += 20;

  sections.forEach((section: any, index: number) => {
    const { material, boardSize, boardsNeeded, pricePerBoard, sectionTotal, edging } = section;

    // Estimate card height
    const hasEdging = edging && edging.totalEdging > 0;
    const cardH = 25 + 22 + 22 + 22 + (hasEdging ? 44 : 22) + 10;

    y = ensureSpace(cardH + 15, y);

    // Material card border
    drawRect(MARGIN, y, CONTENT_W, cardH, COLOR_WHITE, COLOR_BORDER);

    // Card header (black background)
    const cardHeaderH = 25;
    drawRect(MARGIN, y, CONTENT_W, cardHeaderH, COLOR_BLACK);

    doc.fontSize(11).fillColor(COLOR_WHITE).font('Helvetica-Bold');
    doc.text(material ?? '-', MARGIN + 10, y + 7, { width: CONTENT_W * 0.6 });
    doc.fontSize(9).fillColor('#D2D2D2').font('Helvetica');
    doc.text(boardSize ? `${boardSize}mm` : '', MARGIN + CONTENT_W * 0.6, y + 8, {
      width: CONTENT_W * 0.35 - 10, align: 'right'
    });

    let ty = y + cardHeaderH;

    // Table header
    const tColW = [CONTENT_W * 0.5, CONTENT_W * 0.25, CONTENT_W * 0.25];
    drawRect(MARGIN, ty, CONTENT_W, 22, COLOR_LIGHT_GRAY);
    doc.fontSize(9).fillColor(COLOR_TEXT_GRAY).font('Helvetica-Bold');
    doc.text('DESCRIPTION', MARGIN + 10, ty + 7, { width: tColW[0] - 15 });
    doc.text('QUANTITY', MARGIN + tColW[0], ty + 7, { width: tColW[1] - 10 });
    doc.text('PRICE', MARGIN + tColW[0] + tColW[1], ty + 7, {
      width: tColW[2] - 10, align: 'right'
    });
    ty += 22;

    // Data row: material line item
    drawRect(MARGIN, ty, CONTENT_W, 22, COLOR_WHITE, COLOR_ROW_BORDER);
    doc.fontSize(10).fillColor(COLOR_TEXT_DARK).font('Helvetica');
    const descText = `${material ?? '-'} (${boardSize ?? '-'}mm)`;
    doc.text(descText, MARGIN + 10, ty + 7, { width: tColW[0] - 15 });
    doc.text(`${boardsNeeded ?? '-'} boards`, MARGIN + tColW[0], ty + 7, { width: tColW[1] - 10 });
    doc.font('Helvetica-Bold');
    doc.text(`R ${safeFixed(pricePerBoard)}`, MARGIN + tColW[0] + tColW[1], ty + 7, {
      width: tColW[2] - 10, align: 'right'
    });
    ty += 22;

    // Board Total row (light gray)
    drawRect(MARGIN, ty, CONTENT_W, 22, COLOR_LIGHT_GRAY, COLOR_ROW_BORDER);
    doc.fontSize(10).fillColor(COLOR_TEXT_MED).font('Helvetica-Bold');
    doc.text('Board Total', MARGIN + 10, ty + 7, { width: tColW[0] + tColW[1] - 15 });
    doc.text(`R ${safeFixed(sectionTotal)}`, MARGIN + tColW[0] + tColW[1], ty + 7, {
      width: tColW[2] - 10, align: 'right'
    });
    ty += 22;

    // Edging row (if applicable)
    if (hasEdging) {
      const edgingMeters = (Math.round(edging.totalEdging * 1.10) / 1000).toFixed(2);
      const edgingCostVal = section.edgingCost !== undefined
        ? section.edgingCost.toFixed(2)
        : (parseFloat(edgingMeters) * EDGING_PRICE_PER_METER).toFixed(2);

      drawRect(MARGIN, ty, CONTENT_W, 22, COLOR_WHITE, COLOR_ROW_BORDER);
      doc.fontSize(10).fillColor(COLOR_TEXT_DARK).font('Helvetica');
      doc.text(`Edging (${edgingMeters}m @ R${EDGING_PRICE_PER_METER}/m)`, MARGIN + 10, ty + 7, {
        width: tColW[0] + tColW[1] - 15
      });
      doc.font('Helvetica-Bold');
      doc.text(`R ${edgingCostVal}`, MARGIN + tColW[0] + tColW[1], ty + 7, {
        width: tColW[2] - 10, align: 'right'
      });
      ty += 22;

      // Section Total row (darker gray with red top border)
      drawRect(MARGIN, ty, CONTENT_W, 22, '#F0F0F0');
      drawRect(MARGIN, ty, CONTENT_W, 2, COLOR_RED);
      doc.fontSize(11).fillColor(COLOR_BLACK).font('Helvetica-Bold');
      const combinedTotal = (parseFloat(sectionTotal || '0') + parseFloat(edgingCostVal)).toFixed(2);
      doc.text('Section Total', MARGIN + 10, ty + 7, { width: tColW[0] + tColW[1] - 15 });
      doc.text(`R ${combinedTotal}`, MARGIN + tColW[0] + tColW[1], ty + 7, {
        width: tColW[2] - 10, align: 'right'
      });
      ty += 22;
    } else {
      // Section Total row without edging
      drawRect(MARGIN, ty, CONTENT_W, 22, '#F0F0F0');
      drawRect(MARGIN, ty, CONTENT_W, 2, COLOR_RED);
      doc.fontSize(11).fillColor(COLOR_BLACK).font('Helvetica-Bold');
      doc.text('Section Total', MARGIN + 10, ty + 7, { width: tColW[0] + tColW[1] - 15 });
      doc.text(`R ${safeFixed(sectionTotal)}`, MARGIN + tColW[0] + tColW[1], ty + 7, {
        width: tColW[2] - 10, align: 'right'
      });
      ty += 22;
    }

    y = ty + 12;
  });

  // ====== 3b. HARDWARE & ACCESSORIES ======
  // Render only if there are hardware line items
  if (hardwareItems && Array.isArray(hardwareItems) && hardwareItems.length > 0) {
    // Estimate section height: heading + table header + one row per item + total row
    const hwRowH = 22;
    const hwHeaderH = 25 + 22; // card header + table header
    const hwTotalH = 22; // total row
    const estimatedH = hwHeaderH + (hardwareItems.length * hwRowH) + hwTotalH + 30;

    y = ensureSpace(estimatedH, y);

    // Section heading with red accent bar (matches MATERIAL BREAKDOWN style)
    drawRect(MARGIN, y, 30, 3, COLOR_RED);
    doc.fontSize(13).fillColor(COLOR_BLACK).font('Helvetica-Bold');
    doc.text('HARDWARE & ACCESSORIES', MARGIN + 38, y - 5, { width: CONTENT_W - 40 });
    y += 20;

    // Hardware card border
    const hwCardH = hwHeaderH + (hardwareItems.length * hwRowH) + hwTotalH;
    drawRect(MARGIN, y, CONTENT_W, hwCardH, COLOR_WHITE, COLOR_BORDER);

    // Card header (black background)
    const hwCardHeaderH = 25;
    drawRect(MARGIN, y, CONTENT_W, hwCardHeaderH, COLOR_BLACK);
    doc.fontSize(11).fillColor(COLOR_WHITE).font('Helvetica-Bold');
    doc.text('Hardware Line Items', MARGIN + 10, y + 7, { width: CONTENT_W * 0.6 });
    doc.fontSize(9).fillColor('#D2D2D2').font('Helvetica');
    doc.text(`${hardwareItems.length} item(s)`, MARGIN + CONTENT_W * 0.6, y + 8, {
      width: CONTENT_W * 0.35 - 10, align: 'right'
    });

    let hwy = y + hwCardHeaderH;

    // Table header row
    const hwColW = [CONTENT_W * 0.5, CONTENT_W * 0.15, CONTENT_W * 0.175, CONTENT_W * 0.175];
    drawRect(MARGIN, hwy, CONTENT_W, 22, COLOR_LIGHT_GRAY);
    doc.fontSize(9).fillColor(COLOR_TEXT_GRAY).font('Helvetica-Bold');
    doc.text('ITEM', MARGIN + 10, hwy + 7, { width: hwColW[0] - 15 });
    doc.text('QTY', MARGIN + hwColW[0], hwy + 7, { width: hwColW[1] - 10 });
    doc.text('UNIT PRICE', MARGIN + hwColW[0] + hwColW[1], hwy + 7, {
      width: hwColW[2] - 10, align: 'right'
    });
    doc.text('TOTAL', MARGIN + hwColW[0] + hwColW[1] + hwColW[2], hwy + 7, {
      width: hwColW[3] - 10, align: 'right'
    });
    hwy += 22;

    // Data rows
    hardwareItems.forEach((hwItem: any, idx: number) => {
      const rowBg = idx % 2 === 0 ? COLOR_WHITE : COLOR_LIGHT_GRAY;
      drawRect(MARGIN, hwy, CONTENT_W, hwRowH, rowBg, COLOR_ROW_BORDER);
      doc.fontSize(10).fillColor(COLOR_TEXT_DARK).font('Helvetica');
      const itemName = hwItem.name || '-';
      doc.text(itemName, MARGIN + 10, hwy + 7, { width: hwColW[0] - 15 });
      doc.text(`${hwItem.quantity || 1}`, MARGIN + hwColW[0], hwy + 7, { width: hwColW[1] - 10 });
      doc.font('Helvetica');
      doc.text(`R ${safeFixed(hwItem.unitPrice)}`, MARGIN + hwColW[0] + hwColW[1], hwy + 7, {
        width: hwColW[2] - 10, align: 'right'
      });
      doc.font('Helvetica-Bold');
      doc.text(`R ${safeFixed(hwItem.lineTotal)}`, MARGIN + hwColW[0] + hwColW[1] + hwColW[2], hwy + 7, {
        width: hwColW[3] - 10, align: 'right'
      });
      hwy += hwRowH;
    });

    // Hardware total row (darker gray with red top border)
    drawRect(MARGIN, hwy, CONTENT_W, hwTotalH, '#F0F0F0');
    drawRect(MARGIN, hwy, CONTENT_W, 2, COLOR_RED);
    doc.fontSize(11).fillColor(COLOR_BLACK).font('Helvetica-Bold');
    doc.text('Hardware Total', MARGIN + 10, hwy + 7, {
      width: hwColW[0] + hwColW[1] + hwColW[2] - 15
    });
    doc.text(`R ${safeFixed(hwTotal)}`, MARGIN + hwColW[0] + hwColW[1] + hwColW[2], hwy + 7, {
      width: hwColW[3] - 10, align: 'right'
    });
    hwy += hwTotalH;

    y = hwy + 12;
  }

  // ====== 4. QUOTE SUMMARY ======
  y = ensureSpace(180, y);
  y += 5;

  // Summary title (centered with red underline)
  doc.fontSize(15).fillColor(COLOR_BLACK).font('Helvetica-Bold');
  doc.text('QUOTE SUMMARY', MARGIN, y, { width: CONTENT_W, align: 'center' });
  const underlineY = y + 22;
  drawRect(MARGIN + CONTENT_W / 2 - 30, underlineY, 60, 3, COLOR_RED);
  y = underlineY + 15;

  // Summary table (centered, max-width ~350pt)
  const sumW = 350;
  const sumX = MARGIN + (CONTENT_W - sumW) / 2;
  const sumRowH = 28;
  const sumColW = [sumW * 0.65, sumW * 0.35];

  const summaryRows = [
    { label: 'Total Board Cost', value: `R ${boardTotal.toFixed(2)}` },
    { label: `Total Edging Cost (${totalEdgingMeters.toFixed(2)}m @ R${EDGING_PRICE_PER_METER}/m)`, value: `R ${totalEdgingCost.toFixed(2)}` },
    { label: `Cutting Fee (R${cuttingFeePerBoard} per board × ${totalBoardsUsed} board(s))`, value: `R ${totalCuttingFee.toFixed(2)}` },
  ];

  // Add hardware row if hardware items present
  if (hardwareItems && Array.isArray(hardwareItems) && hardwareItems.length > 0) {
    summaryRows.push({
      label: `Hardware & Accessories (${hardwareItems.length} item(s))`,
      value: `R ${hwTotal.toFixed(2)}`
    });
  }

  summaryRows.forEach((row) => {
    drawRect(sumX, y, sumW, sumRowH, COLOR_WHITE, COLOR_BORDER);
    doc.fontSize(11).fillColor(COLOR_TEXT_DARK).font('Helvetica');
    doc.text(row.label, sumX + 10, y + 9, { width: sumColW[0] - 15 });
    doc.font('Helvetica-Bold');
    doc.text(row.value, sumX + sumColW[0], y + 9, { width: sumColW[1] - 10, align: 'right' });
    y += sumRowH;
  });

  // Grand total row (black background, red amount)
  drawRect(sumX, y, sumW, sumRowH + 5, COLOR_BLACK);
  doc.fontSize(14).fillColor(COLOR_WHITE).font('Helvetica-Bold');
  doc.text('GRAND TOTAL', sumX + 10, y + 11, { width: sumColW[0] - 15 });
  doc.fillColor(COLOR_RED);
  doc.text(`R ${finalTotal.toFixed(2)}`, sumX + sumColW[0], y + 11, {
    width: sumColW[1] - 10, align: 'right'
  });
  y += sumRowH + 5 + 20;

  // ====== 5. CONTACT & PAYMENT INFO (two side-by-side cards) ======
  y = ensureSpace(200, y);

  // Section title
  doc.fontSize(15).fillColor(COLOR_BLACK).font('Helvetica-Bold');
  doc.text('CONTACT & PAYMENT INFORMATION', MARGIN, y, { width: CONTENT_W, align: 'center' });
  drawRect(MARGIN + CONTENT_W / 2 - 30, y + 22, 60, 3, COLOR_RED);
  y += 35;

  const cardW = (CONTENT_W - 15) / 2;
  const cardX2 = MARGIN + cardW + 15;
  const cardHeaderH = 22;

  // Use fallback branch data
  const quoteBranchData = branchData || {
    trading_as: 'HDS Cut & Edge Group',
    address1: 'Please contact us for branch details',
    phone: '',
    email: '',
    whatsapp: ''
  };

  // --- Branch Details Card ---
  drawRect(MARGIN, y, cardW, cardHeaderH, COLOR_BLACK);
  drawRect(MARGIN, y + cardHeaderH - 3, cardW, 3, COLOR_RED);
  doc.fontSize(10).fillColor(COLOR_WHITE).font('Helvetica-Bold');
  doc.text('BRANCH DETAILS', MARGIN + 10, y + 6, { width: cardW - 20 });

  // Branch card body
  const branchBodyY = y + cardHeaderH;
  const branchBodyH = 100;
  drawRect(MARGIN, branchBodyY, cardW, branchBodyH, COLOR_WHITE, COLOR_BORDER);

  doc.fontSize(9).fillColor(COLOR_TEXT_MED).font('Helvetica');
  let by = branchBodyY + 10;
  doc.font('Helvetica-Bold').fillColor(COLOR_TEXT_DARK);
  doc.text(quoteBranchData.trading_as || quoteBranchData.name || 'Branch', MARGIN + 10, by, { width: cardW - 20 });
  by += 14;
  doc.font('Helvetica').fillColor(COLOR_TEXT_MED);

  const branchExclude = ['id', 'created_at', 'updated_at', 'uuid', 'branch_id', 'branch_number', 'trading_as', 'name'];
  const branchLabels: Record<string, string> = {
    address1: 'Address', address2: '', city: 'City', state: 'Province',
    zip: 'ZIP', phone: 'Phone', email: 'Email', website: 'Website',
    whatsapp: 'WhatsApp', vat: 'VAT Number', registration: 'Reg Number'
  };
  Object.keys(quoteBranchData).forEach((key) => {
    if (branchExclude.includes(key)) return;
    const value = quoteBranchData[key];
    if (!value) return;
    const label = branchLabels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    if (label) {
      doc.text(`${label}: ${value}`, MARGIN + 10, by, { width: cardW - 20 });
    } else {
      doc.text(`${value}`, MARGIN + 10, by, { width: cardW - 20 });
    }
    by += 13;
  });

  // --- Banking Details Card ---
  drawRect(cardX2, y, cardW, cardHeaderH, COLOR_BLACK);
  drawRect(cardX2, y + cardHeaderH - 3, cardW, 3, COLOR_RED);
  doc.fontSize(10).fillColor(COLOR_WHITE).font('Helvetica-Bold');
  doc.text('BANKING DETAILS', cardX2 + 10, y + 6, { width: cardW - 20 });

  const bankBodyY = y + cardHeaderH;
  const bankBodyH = 100;
  drawRect(cardX2, bankBodyY, cardW, bankBodyH, COLOR_WHITE, COLOR_BORDER);

  doc.fontSize(9).fillColor(COLOR_TEXT_MED).font('Helvetica');
  let bby = bankBodyY + 10;

  if (bankingDetails && Object.keys(bankingDetails).length > 0) {
    const bankExclude = ['id', 'created_at', 'updated_at', 'uuid', 'fx_branch'];
    const bankLabels: Record<string, string> = {
      account_holder: 'Account Holder', bank: 'Bank', account_number: 'Account Number',
      branch_code: 'Branch Code', account_type: 'Account Type', reference: 'Reference',
      swift_code: 'SWIFT Code', iban: 'IBAN'
    };
    Object.keys(bankingDetails).forEach((key) => {
      if (bankExclude.includes(key)) return;
      const value = bankingDetails[key];
      if (!value) return;
      const label = bankLabels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      doc.text(`${label}: ${value}`, cardX2 + 10, bby, { width: cardW - 20 });
      bby += 13;
    });
    if (bby === bankBodyY + 10) {
      doc.text('Please contact us for payment information.', cardX2 + 10, bby, { width: cardW - 20 });
    }
  } else {
    doc.text('Bank: Standard Bank', cardX2 + 10, bby, { width: cardW - 20 }); bby += 13;
    doc.text('Account Type: Business Account', cardX2 + 10, bby, { width: cardW - 20 }); bby += 13;
    doc.text(`Reference: ${pdfId}`, cardX2 + 10, bby, { width: cardW - 20 });
  }

  y = bankBodyY + bankBodyH + 20;

  // ====== 6. PAYMENT BUTTON ======
  y = ensureSpace(60, y);

  if (isPaid) {
    drawRect(MARGIN + CONTENT_W / 2 - 150, y, 300, 40, '#e8f5e8', '#28a745');
    doc.fontSize(14).fillColor('#28a745').font('Helvetica-Bold');
    doc.text('PAYMENT RECEIVED', MARGIN + CONTENT_W / 2 - 150, y + 12, {
      width: 300, align: 'center'
    });
    y += 50;
  } else {
    const btnW = 250;
    const btnH = 40;
    const btnX = MARGIN + (CONTENT_W - btnW) / 2;
    drawRect(btnX, y, btnW, btnH, COLOR_BLACK);
    drawRect(btnX, y + btnH - 4, btnW, 4, COLOR_RED);

    const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
    const paymentUrl = `${baseUrl}/api/payfast/pay?quoteId=${pdfId}&amount=${finalTotal.toFixed(2)}&customerName=${encodeURIComponent(customerName || 'Customer')}&projectName=${encodeURIComponent(projectName || 'Project')}`;

    doc.fontSize(13).fillColor(COLOR_WHITE).font('Helvetica-Bold');
    doc.text(`PAY NOW — R ${finalTotal.toFixed(2)}`, btnX, y + 12, {
      width: btnW, align: 'center', link: paymentUrl
    });
    y += btnH + 8;

    doc.fontSize(8).fillColor(COLOR_TEXT_GRAY).font('Helvetica');
    doc.text('Secure online payment via PayFast — All major payment methods accepted',
      MARGIN, y, { width: CONTENT_W, align: 'center' });
    y += 18;
  }

  // ====== 7. DISCLAIMER ======
  y = ensureSpace(30, y);
  y += 5;
  drawRect(MARGIN, y, CONTENT_W, 30, COLOR_LIGHT_GRAY, COLOR_BORDER);
  doc.fontSize(7.5).fillColor('#999999').font('Helvetica');
  doc.text('Prices may vary slightly when purchasing in-store at our branches, as different regions have different pricing structures. This quotation serves as an estimate and is valid for 30 days from the date of issue.',
    MARGIN + 10, y + 5, { width: CONTENT_W - 20, align: 'center' });
  y += 35;

  // ====== 8. FOOTER (black with gradient top border) ======
  if (y + 50 > PAGE_H - MARGIN) {
    doc.addPage({ size: 'A4', margin: 0 });
    y = MARGIN;
  } else {
    y = PAGE_H - MARGIN - 45;
  }

  // Gradient top border for footer
  drawRect(MARGIN, y, CONTENT_W / 3, 3, COLOR_RED);
  drawRect(MARGIN + CONTENT_W / 3, y, CONTENT_W / 3, 3, COLOR_GOLD);
  drawRect(MARGIN + CONTENT_W * 2 / 3, y, CONTENT_W / 3, 3, COLOR_RED);

  drawRect(MARGIN, y + 3, CONTENT_W, 42, COLOR_BLACK);

  // Footer logo (small)
  if (logoPath) {
    try {
      doc.image(logoPath, MARGIN + 15, y + 10, { height: 20 });
    } catch (e) { /* skip */ }
  }
  doc.fontSize(8).fillColor('rgba(255,255,255,0.7)').font('Helvetica');
  doc.text('www.hdsgroup.co.za', MARGIN + 80, y + 16, { width: 150 });

  doc.fontSize(8).fillColor(COLOR_GOLD).font('Helvetica');
  doc.text('hdsgroup.co.za  |  Est. 2001  |  Largest Cut & Edge Distributor',
    MARGIN + CONTENT_W - 280, y + 16, { width: 270, align: 'right' });

  // Set PDF metadata (shows as the document title on phone previews instead of "Untitled")
  const safeCustomer = (customerName && customerName !== 'N/A') ? customerName : 'Valued Customer';
  const safeProject = (projectName && projectName !== 'N/A') ? projectName : '';
  const titleParts = [pdfId, safeCustomer];
  if (safeProject) titleParts.push(safeProject);
  doc.info.Title = `HDS Quote ${titleParts.join(' - ')}`;
  doc.info.Author = 'HDS Cut & Edge Group';
  doc.info.Subject = isPaid ? 'Invoice' : 'Quotation';
  doc.info.Keywords = 'HDS, quote, quotation, cut and edge, boards';

  // Finalize PDF
  doc.end();

  return new Promise<{ buffer: any, id: string }>((resolve) => {
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(buffers);
      resolve({ buffer: pdfBuffer, id: pdfId });
    });
  });
};



/**
 * Generate PDF with optimization solution and upload to Supabase storage
 * @param solution The optimization solution
 * @param unit Unit of measurement (0 = mm, 1 = inches, 2 = feet)
 * @param cutWidth Saw blade thickness
 * @param layout Layout algorithm type
 * @returns Promise with the public URL and ID of the uploaded PDF
 */
export const generateAndUploadOptimizationPdf = async (
  solution: Solution,
  unit: number,
  cutWidth: number = 3,
  layout: number = 0,
  cutlistId?: string
): Promise<{ success: boolean; publicUrl?: string; pdfId?: string; error?: string }> => {
  try {
    // Generate PDF buffer using existing generatePdfWithBuffer function
    const pdfResult = await generatePdfWithBuffer(solution, unit, cutWidth, layout);
    
    // Create filename using cutlistId if provided, otherwise use UUID format
    let fileName: string;
    if (cutlistId) {
      fileName = `${cutlistId}.pdf`;
      console.log('✅ Using cutlistId for PDF filename:', fileName);
    } else {
      fileName = `solution_${pdfResult.id}.pdf`;
      console.log('⚠️ Using UUID format for PDF filename (no cutlistId provided):', fileName);
    }
    
    // Import Supabase service dynamically to avoid circular dependencies
    const SupabaseService = (await import('./supabase.service')).default;
    
    // Upload to Supabase cutlists bucket
    const uploadResult = await SupabaseService.uploadCutlistPdf(pdfResult.buffer, fileName);
    
    if (uploadResult.success && uploadResult.publicUrl) {
      return {
        success: true,
        publicUrl: uploadResult.publicUrl,
        pdfId: pdfResult.id
      };
    } else {
      return {
        success: false,
        error: uploadResult.error || 'Failed to upload PDF to storage'
      };
    }
  } catch (error: any) {
    console.error('Error generating and uploading optimization PDF:', error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred'
    };
  }
};

/**
 * Generate PDF with optimization solution and return buffer for cloud storage
 * @param solution The optimization solution
 * @param unit Unit of measurement (0 = mm, 1 = inches, 2 = feet)
 * @param cutWidth Saw blade thickness
 * @param layout Layout algorithm type
 * @returns Promise with the buffer and ID of the generated PDF
 */
export const generatePdfWithBuffer = async (
  solution: Solution,
  unit: number,
  cutWidth: number = 3,
  layout: number = 0
): Promise<{ buffer: any, id: string }> => {
  const pdfId = uuidv4();
  
  // Create PDF document
  const doc = new PDFDocument({ size: 'A4' });
  
  // Collect PDF data in memory buffers instead of writing to disk
  const buffers: any[] = [];
  doc.on('data', buffers.push.bind(buffers));
  
  // Ensure we start fresh without any page switching
  doc.font('Helvetica');
  
  // Add title with a colored header box
  doc.rect(50, 50, doc.page.width - 100, 60)
     .fillAndStroke('#003366', '#000000');

  doc.fontSize(24)
     .fillColor('#FFFFFF')
     .text('HDS Group Cutlist', 50, 65, { align: 'center', width: doc.page.width - 100 });

  doc.fontSize(16)
     .fillColor('#FFFFFF')
     .text('2D CUTTING OPTIMIZER', 50, 95, { align: 'center', width: doc.page.width - 100 });

  // Add date and time
  const now = new Date();
  const dateString = now.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  const timeString = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  doc.fontSize(10)
     .fillColor('#000000')
     .text('Generated: ' + new Date().toLocaleDateString(), 50, 120, { align: 'right', width: doc.page.width - 100 });

  doc.moveDown(3);

  // Add detailed summary information
  const totalStockPieces = solution.stockPieces.length;
  const totalCutPieces = solution.stockPieces.reduce((sum, sp) => sum + sp.cutPieces.length, 0);

  // Calculate total edging required in mm
  let totalEdging = 0;
  solution.stockPieces.forEach((sp: any) => {
    sp.cutPieces.forEach((cp: any) => {
      // Count edges that need edging (L1, L2, W1, W2)
      const edgingNeeded = [
        cp.edgeL1 ? cp.length : 0,
        cp.edgeL2 ? cp.length : 0,
        cp.edgeW1 ? cp.width : 0,
        cp.edgeW2 ? cp.width : 0
      ].reduce((sum: number, val: number) => sum + val, 0);
      
      totalEdging += edgingNeeded;
    });
  });
  
  // Convert edging to meters and calculate cost
  const EDGING_PRICE_PER_METER = 14; // R14 per meter
  const totalEdgingMeters = totalEdging / 1000;
  const edgingCost = totalEdgingMeters * EDGING_PRICE_PER_METER;

  // Calculate total area and waste
  let totalStockArea = 0;
  let totalCutArea = 0;

  solution.stockPieces.forEach(stockPiece => {
    const stockArea = stockPiece.width * stockPiece.length;
    totalStockArea += stockArea;

    stockPiece.cutPieces.forEach(cutPiece => {
      totalCutArea += cutPiece.width * cutPiece.length;
    });
  });

  const wasteArea = totalStockArea - totalCutArea;
  const wastePercentage = ((wasteArea / totalStockArea) * 100).toFixed(2);

  // Create a detailed summary table
  doc.fontSize(14).text('Optimization Summary', { underline: true });
  doc.moveDown(0.5);

  // Draw summary table
  const summaryStartX = 50;
  const summaryStartY = doc.y;
  const summaryColWidths = [200, 100, 150];
  const summaryRowHeight = 25;

  // Draw table headers
  doc.rect(summaryStartX, summaryStartY, summaryColWidths[0] + summaryColWidths[1] + summaryColWidths[2], summaryRowHeight)
     .fillAndStroke('#e0e0e0', '#000000');

  doc.fontSize(10).fillColor('#000000');
  doc.text('Parameter', summaryStartX + 5, summaryStartY + 8, { width: summaryColWidths[0] });
  doc.text('Value', summaryStartX + summaryColWidths[0] + 5, summaryStartY + 8, { width: summaryColWidths[1] });
  doc.text('Details', summaryStartX + summaryColWidths[0] + summaryColWidths[1] + 5, summaryStartY + 8, { width: summaryColWidths[2] });

  // Draw rows
  let currentSummaryY = summaryStartY + summaryRowHeight;

  // Row 1: Stock Pieces
  doc.rect(summaryStartX, currentSummaryY, summaryColWidths[0] + summaryColWidths[1] + summaryColWidths[2], summaryRowHeight)
     .stroke();
  doc.text('Stock Pieces Used', summaryStartX + 5, currentSummaryY + 8, { width: summaryColWidths[0] });
  doc.text(`${totalStockPieces}`, summaryStartX + summaryColWidths[0] + 5, currentSummaryY + 8, { width: summaryColWidths[1] });
  doc.text('Total sheets/panels', summaryStartX + summaryColWidths[0] + summaryColWidths[1] + 5, currentSummaryY + 8, { width: summaryColWidths[2] });
  currentSummaryY += summaryRowHeight;

  // Row 2: Cut Pieces
  doc.rect(summaryStartX, currentSummaryY, summaryColWidths[0] + summaryColWidths[1] + summaryColWidths[2], summaryRowHeight)
     .stroke();
  doc.text('Cut Pieces Placed', summaryStartX + 5, currentSummaryY + 8, { width: summaryColWidths[0] });
  doc.text(`${totalCutPieces}`, summaryStartX + summaryColWidths[0] + 5, currentSummaryY + 8, { width: summaryColWidths[1] });
  doc.text('Total parts cut', summaryStartX + summaryColWidths[0] + summaryColWidths[1] + 5, currentSummaryY + 8, { width: summaryColWidths[2] });
  currentSummaryY += summaryRowHeight;

  // Row 3: Total Stock Area
  const unitLabel = unit === 0 ? 'mm' : unit === 1 ? 'in' : 'ft';
  const totalStockAreaConverted = convertUnit(totalStockArea, 0, unit).toFixed(2);

  doc.rect(summaryStartX, currentSummaryY, summaryColWidths[0] + summaryColWidths[1] + summaryColWidths[2], summaryRowHeight)
     .stroke();
  doc.text('Total Stock Area', summaryStartX + 5, currentSummaryY + 8, { width: summaryColWidths[0] });
  doc.text(totalStockAreaConverted.toString(), summaryStartX + summaryColWidths[0] + 5, currentSummaryY + 8, { width: summaryColWidths[1] });
  doc.text('Total material area', summaryStartX + summaryColWidths[0] + summaryColWidths[1] + 5, currentSummaryY + 8, { width: summaryColWidths[2] });
  currentSummaryY += summaryRowHeight;

  // Row 4: Total Cut Area
  const totalCutAreaConverted = convertUnit(totalCutArea, 0, unit).toFixed(2);

  doc.rect(summaryStartX, currentSummaryY, summaryColWidths[0] + summaryColWidths[1] + summaryColWidths[2], summaryRowHeight)
     .stroke();
  doc.text('Total Cut Area', summaryStartX + 5, currentSummaryY + 8, { width: summaryColWidths[0] });
  doc.text(totalCutAreaConverted.toString(), summaryStartX + summaryColWidths[0] + 5, currentSummaryY + 8, { width: summaryColWidths[1] });
  doc.text('Total used material', summaryStartX + summaryColWidths[0] + summaryColWidths[1] + 5, currentSummaryY + 8, { width: summaryColWidths[2] });
  currentSummaryY += summaryRowHeight;

  // Row 5: Waste Area
  const wasteAreaConverted = convertUnit(wasteArea, 0, unit).toFixed(2);

  doc.rect(summaryStartX, currentSummaryY, summaryColWidths[0] + summaryColWidths[1] + summaryColWidths[2], summaryRowHeight)
     .fillAndStroke('#fff0f0', '#000000');
  doc.text('Waste Area', summaryStartX + 5, currentSummaryY + 8, { width: summaryColWidths[0] });
  doc.text(wasteAreaConverted.toString(), summaryStartX + summaryColWidths[0] + 5, currentSummaryY + 8, { width: summaryColWidths[1] });
  doc.text(wastePercentage + '% of total material', summaryStartX + summaryColWidths[0] + summaryColWidths[1] + 5, currentSummaryY + 8, { width: summaryColWidths[2] });
  currentSummaryY += summaryRowHeight;

  // Row 6: Edging Cost
  doc.rect(summaryStartX, currentSummaryY, summaryColWidths[0] + summaryColWidths[1] + summaryColWidths[2], summaryRowHeight)
     .stroke();
  doc.text('Edging Cost', summaryStartX + 5, currentSummaryY + 8, { width: summaryColWidths[0] });
  doc.text(`${edgingCost}`, summaryStartX + summaryColWidths[0] + 5, currentSummaryY + 8, { width: summaryColWidths[1] });
  doc.text('Total edging cost', summaryStartX + summaryColWidths[0] + summaryColWidths[1] + 5, currentSummaryY + 8, { width: summaryColWidths[2] });
  currentSummaryY += summaryRowHeight;

  // Row 7: Layout Type
  doc.rect(summaryStartX, currentSummaryY, summaryColWidths[0] + summaryColWidths[1] + summaryColWidths[2], summaryRowHeight)
     .stroke();
  doc.text('Layout Type', summaryStartX + 5, currentSummaryY + 8, { width: summaryColWidths[0] });
  doc.text((layout === 0 ? 'Guillotine' : 'Nested'), summaryStartX + summaryColWidths[0] + 5, currentSummaryY + 8, { width: summaryColWidths[1] });
  doc.text('Cutting algorithm used', summaryStartX + summaryColWidths[0] + summaryColWidths[1] + 5, currentSummaryY + 8, { width: summaryColWidths[2] });
  currentSummaryY += summaryRowHeight;

  // Row 8: Cut Width
  const cutWidthConverted = convertUnit(cutWidth, 0, unit).toFixed(2);
  const unitLabelSingle = unit === 0 ? 'mm' : unit === 1 ? 'in' : 'ft';

  doc.rect(summaryStartX, currentSummaryY, summaryColWidths[0] + summaryColWidths[1] + summaryColWidths[2], summaryRowHeight)
     .stroke();
  doc.text('Cut Width', summaryStartX + 5, currentSummaryY + 8, { width: summaryColWidths[0] });
  doc.text(cutWidthConverted.toString(), summaryStartX + summaryColWidths[0] + 5, currentSummaryY + 8, { width: summaryColWidths[1] });
  doc.text('Saw blade thickness', summaryStartX + summaryColWidths[0] + summaryColWidths[1] + 5, currentSummaryY + 8, { width: summaryColWidths[2] });

  doc.moveDown(3);

  // BALANCED APPROACH: Include comprehensive cut pieces table + limited detailed diagrams
  const MAX_DETAILED_PAGES = 5; // Show first 5 stock pieces with detailed diagrams
  const stockPiecesToShow = Math.min(solution.stockPieces.length, MAX_DETAILED_PAGES);
  
  console.log(`📄 PDF Generation: Including comprehensive cut pieces table + ${stockPiecesToShow} of ${solution.stockPieces.length} detailed diagrams`);
  
  // Add comprehensive summary table for ALL stock pieces first
  doc.addPage(); // Start detailed content on new page to prevent overlap
  
  // Title for complete summary
  doc.rect(50, 50, doc.page.width - 100, 40)
     .fillAndStroke('#003366', '#000000');
  
  doc.fontSize(16)
     .fillColor('#FFFFFF')
     .text('Complete Stock Pieces Summary', 50, 60, { align: 'center', width: doc.page.width - 100 });
  
  doc.moveDown(2);
  
  // Create compact table for ALL stock pieces
  const allStockTableStartX = 50;
  const allStockTableStartY = doc.y;
  const allStockColWidths = [50, 70, 70, 80, 80, 100]; // Case, Width, Length, Area, Cut Pieces, Waste
  const allStockRowHeight = 18;
  
  // Draw table header
  doc.rect(allStockTableStartX, allStockTableStartY, allStockColWidths.reduce((a, b) => a + b, 0), allStockRowHeight)
     .fillAndStroke('#e0e0e0', '#000000');
  
  doc.fontSize(9).fillColor('#000000');
  doc.text('Case', allStockTableStartX + 5, allStockTableStartY + 5, { width: allStockColWidths[0] });
  doc.text('Width', allStockTableStartX + allStockColWidths[0] + 5, allStockTableStartY + 5, { width: allStockColWidths[1] });
  doc.text('Length', allStockTableStartX + allStockColWidths[0] + allStockColWidths[1] + 5, allStockTableStartY + 5, { width: allStockColWidths[2] });
  doc.text('Area', allStockTableStartX + allStockColWidths[0] + allStockColWidths[1] + allStockColWidths[2] + 5, allStockTableStartY + 5, { width: allStockColWidths[3] });
  doc.text('Pieces', allStockTableStartX + allStockColWidths[0] + allStockColWidths[1] + allStockColWidths[2] + allStockColWidths[3] + 5, allStockTableStartY + 5, { width: allStockColWidths[4] });
  doc.text('Waste %', allStockTableStartX + allStockColWidths[0] + allStockColWidths[1] + allStockColWidths[2] + allStockColWidths[3] + allStockColWidths[4] + 5, allStockTableStartY + 5, { width: allStockColWidths[5] });
  
  // Draw data rows for ALL stock pieces (compact format)
  let currentRowY = allStockTableStartY + allStockRowHeight;
  const maxRowsPerPage = 35; // Increased rows per page for compact format
  
  solution.stockPieces.forEach((stockPiece, index) => {
    // Add new page if we exceed the row limit
    if (index > 0 && index % maxRowsPerPage === 0) {
      doc.addPage();
      currentRowY = 80; // Reset Y position for new page
      
      // Redraw header on new page
      doc.rect(allStockTableStartX, currentRowY - allStockRowHeight, allStockColWidths.reduce((a, b) => a + b, 0), allStockRowHeight)
         .fillAndStroke('#e0e0e0', '#000000');
      
      doc.fontSize(9).fillColor('#000000');
      doc.text('Case', allStockTableStartX + 5, currentRowY - allStockRowHeight + 5, { width: allStockColWidths[0] });
      doc.text('Width', allStockTableStartX + allStockColWidths[0] + 5, currentRowY - allStockRowHeight + 5, { width: allStockColWidths[1] });
      doc.text('Length', allStockTableStartX + allStockColWidths[0] + allStockColWidths[1] + 5, currentRowY - allStockRowHeight + 5, { width: allStockColWidths[2] });
      doc.text('Area', allStockTableStartX + allStockColWidths[0] + allStockColWidths[1] + allStockColWidths[2] + 5, currentRowY - allStockRowHeight + 5, { width: allStockColWidths[3] });
      doc.text('Pieces', allStockTableStartX + allStockColWidths[0] + allStockColWidths[1] + allStockColWidths[2] + allStockColWidths[3] + 5, currentRowY - allStockRowHeight + 5, { width: allStockColWidths[4] });
      doc.text('Waste %', allStockTableStartX + allStockColWidths[0] + allStockColWidths[1] + allStockColWidths[2] + allStockColWidths[3] + allStockColWidths[4] + 5, currentRowY - allStockRowHeight + 5, { width: allStockColWidths[5] });
    }
    
    // Calculate values for this stock piece
    const stockWidth = convertUnit(stockPiece.width, 0, unit).toFixed(1);
    const stockLength = convertUnit(stockPiece.length, 0, unit).toFixed(1);
    const stockAreaFormatted = (parseFloat(stockWidth) * parseFloat(stockLength)).toFixed(1);
    
    const stockAreaValue = stockPiece.width * stockPiece.length;
    let usedAreaValue = 0;
    stockPiece.cutPieces.forEach(p => {
      usedAreaValue += p.width * p.length;
    });
    const wasteAreaValue = stockAreaValue - usedAreaValue;
    const wastePercentage = ((wasteAreaValue / stockAreaValue) * 100).toFixed(1);
    
    // Draw row
    doc.rect(allStockTableStartX, currentRowY, allStockColWidths.reduce((a, b) => a + b, 0), allStockRowHeight)
       .stroke();
    
    doc.fontSize(8).fillColor('#000000');
    doc.text(`${index + 1}`, allStockTableStartX + 5, currentRowY + 5, { width: allStockColWidths[0] });
    doc.text(`${stockWidth}`, allStockTableStartX + allStockColWidths[0] + 5, currentRowY + 5, { width: allStockColWidths[1] });
    doc.text(`${stockLength}`, allStockTableStartX + allStockColWidths[0] + allStockColWidths[1] + 5, currentRowY + 5, { width: allStockColWidths[2] });
    doc.text(`${stockAreaFormatted}`, allStockTableStartX + allStockColWidths[0] + allStockColWidths[1] + allStockColWidths[2] + 5, currentRowY + 5, { width: allStockColWidths[3] });
    doc.text(`${stockPiece.cutPieces.length}`, allStockTableStartX + allStockColWidths[0] + allStockColWidths[1] + allStockColWidths[2] + allStockColWidths[3] + 5, currentRowY + 5, { width: allStockColWidths[4] });
    doc.text(`${wastePercentage}%`, allStockTableStartX + allStockColWidths[0] + allStockColWidths[1] + allStockColWidths[2] + allStockColWidths[3] + allStockColWidths[4] + 5, currentRowY + 5, { width: allStockColWidths[5] });
    
    currentRowY += allStockRowHeight;
  });

  // ADD COMPREHENSIVE CUT PIECES TABLE - showing ALL individual cut pieces with details
  doc.addPage(); // New page for cut pieces table
  
  // Title for cut pieces table
  doc.rect(50, 50, doc.page.width - 100, 40)
     .fillAndStroke('#003366', '#000000');
  
  doc.fontSize(16)
     .fillColor('#FFFFFF')
     .text('Complete Cut Pieces Details', 50, 60, { align: 'center', width: doc.page.width - 100 });
  
  doc.moveDown(2);
  
  // Create detailed cut pieces table
  const cutPiecesTableStartX = 50;
  const cutPiecesTableStartY = doc.y;
  const cutPiecesColWidths = [35, 45, 55, 55, 45, 45, 70, 60, 70]; // ID, Stock, Width, Length, X, Y, Area, Edging, Label
  const cutPiecesRowHeight = 16;
  
  // Draw cut pieces table header
  doc.rect(cutPiecesTableStartX, cutPiecesTableStartY, cutPiecesColWidths.reduce((a, b) => a + b, 0), cutPiecesRowHeight)
     .fillAndStroke('#e0e0e0', '#000000');
  
  doc.fontSize(8).fillColor('#000000');
  doc.text('ID', cutPiecesTableStartX + 5, cutPiecesTableStartY + 4, { width: cutPiecesColWidths[0] });
  doc.text('Stock', cutPiecesTableStartX + cutPiecesColWidths[0] + 5, cutPiecesTableStartY + 4, { width: cutPiecesColWidths[1] });
  doc.text('Width', cutPiecesTableStartX + cutPiecesColWidths[0] + cutPiecesColWidths[1] + 5, cutPiecesTableStartY + 4, { width: cutPiecesColWidths[2] });
  doc.text('Length', cutPiecesTableStartX + cutPiecesColWidths[0] + cutPiecesColWidths[1] + cutPiecesColWidths[2] + 5, cutPiecesTableStartY + 4, { width: cutPiecesColWidths[3] });
  doc.text('X Pos', cutPiecesTableStartX + cutPiecesColWidths[0] + cutPiecesColWidths[1] + cutPiecesColWidths[2] + cutPiecesColWidths[3] + 5, cutPiecesTableStartY + 4, { width: cutPiecesColWidths[4] });
  doc.text('Y Pos', cutPiecesTableStartX + cutPiecesColWidths[0] + cutPiecesColWidths[1] + cutPiecesColWidths[2] + cutPiecesColWidths[3] + cutPiecesColWidths[4] + 5, cutPiecesTableStartY + 4, { width: cutPiecesColWidths[5] });
  doc.text('Area', cutPiecesTableStartX + cutPiecesColWidths[0] + cutPiecesColWidths[1] + cutPiecesColWidths[2] + cutPiecesColWidths[3] + cutPiecesColWidths[4] + cutPiecesColWidths[5] + 5, cutPiecesTableStartY + 4, { width: cutPiecesColWidths[6] });
  doc.text('Edging', cutPiecesTableStartX + cutPiecesColWidths[0] + cutPiecesColWidths[1] + cutPiecesColWidths[2] + cutPiecesColWidths[3] + cutPiecesColWidths[4] + cutPiecesColWidths[5] + cutPiecesColWidths[6] + 5, cutPiecesTableStartY + 4, { width: cutPiecesColWidths[7] });
  doc.text('Label', cutPiecesTableStartX + cutPiecesColWidths[0] + cutPiecesColWidths[1] + cutPiecesColWidths[2] + cutPiecesColWidths[3] + cutPiecesColWidths[4] + cutPiecesColWidths[5] + cutPiecesColWidths[6] + cutPiecesColWidths[7] + 5, cutPiecesTableStartY + 4, { width: cutPiecesColWidths[8] });
  
  // Draw data rows for ALL cut pieces
  let cutPiecesCurrentRowY = cutPiecesTableStartY + cutPiecesRowHeight;
  const cutPiecesMaxRowsPerPage = 40; // More rows per page for cut pieces
  let cutPieceRowCount = 0;
  
  solution.stockPieces.forEach((stockPiece, stockIndex) => {
    stockPiece.cutPieces.forEach((cutPiece, cutIndex) => {
      // Add new page if we exceed the row limit
      if (cutPieceRowCount > 0 && cutPieceRowCount % cutPiecesMaxRowsPerPage === 0) {
        doc.addPage();
        cutPiecesCurrentRowY = 80; // Reset Y position for new page
        
        // Redraw header on new page
        doc.rect(cutPiecesTableStartX, cutPiecesCurrentRowY - cutPiecesRowHeight, cutPiecesColWidths.reduce((a, b) => a + b, 0), cutPiecesRowHeight)
           .fillAndStroke('#e0e0e0', '#000000');
        
        doc.fontSize(8).fillColor('#000000');
        doc.text('ID', cutPiecesTableStartX + 5, cutPiecesCurrentRowY - cutPiecesRowHeight + 4, { width: cutPiecesColWidths[0] });
        doc.text('Stock', cutPiecesTableStartX + cutPiecesColWidths[0] + 5, cutPiecesCurrentRowY - cutPiecesRowHeight + 4, { width: cutPiecesColWidths[1] });
        doc.text('Width', cutPiecesTableStartX + cutPiecesColWidths[0] + cutPiecesColWidths[1] + 5, cutPiecesCurrentRowY - cutPiecesRowHeight + 4, { width: cutPiecesColWidths[2] });
        doc.text('Length', cutPiecesTableStartX + cutPiecesColWidths[0] + cutPiecesColWidths[1] + cutPiecesColWidths[2] + 5, cutPiecesCurrentRowY - cutPiecesRowHeight + 4, { width: cutPiecesColWidths[3] });
        doc.text('X Pos', cutPiecesTableStartX + cutPiecesColWidths[0] + cutPiecesColWidths[1] + cutPiecesColWidths[2] + cutPiecesColWidths[3] + 5, cutPiecesCurrentRowY - cutPiecesRowHeight + 4, { width: cutPiecesColWidths[4] });
        doc.text('Y Pos', cutPiecesTableStartX + cutPiecesColWidths[0] + cutPiecesColWidths[1] + cutPiecesColWidths[2] + cutPiecesColWidths[3] + cutPiecesColWidths[4] + 5, cutPiecesCurrentRowY - cutPiecesRowHeight + 4, { width: cutPiecesColWidths[5] });
        doc.text('Area', cutPiecesTableStartX + cutPiecesColWidths[0] + cutPiecesColWidths[1] + cutPiecesColWidths[2] + cutPiecesColWidths[3] + cutPiecesColWidths[4] + cutPiecesColWidths[5] + 5, cutPiecesCurrentRowY - cutPiecesRowHeight + 4, { width: cutPiecesColWidths[6] });
        doc.text('Edging', cutPiecesTableStartX + cutPiecesColWidths[0] + cutPiecesColWidths[1] + cutPiecesColWidths[2] + cutPiecesColWidths[3] + cutPiecesColWidths[4] + cutPiecesColWidths[5] + cutPiecesColWidths[6] + 5, cutPiecesCurrentRowY - cutPiecesRowHeight + 4, { width: cutPiecesColWidths[7] });
        doc.text('Label', cutPiecesTableStartX + cutPiecesColWidths[0] + cutPiecesColWidths[1] + cutPiecesColWidths[2] + cutPiecesColWidths[3] + cutPiecesColWidths[4] + cutPiecesColWidths[5] + cutPiecesColWidths[6] + cutPiecesColWidths[7] + 5, cutPiecesCurrentRowY - cutPiecesRowHeight + 4, { width: cutPiecesColWidths[8] });
      }
      
      // Calculate values for this cut piece
      const cutWidth = convertUnit(cutPiece.width, 0, unit).toFixed(1);
      const cutLength = convertUnit(cutPiece.length, 0, unit).toFixed(1);
      const cutX = convertUnit(cutPiece.x, 0, unit).toFixed(1);
      const cutY = convertUnit(cutPiece.y, 0, unit).toFixed(1);
      const cutAreaFormatted = (parseFloat(cutWidth) * parseFloat(cutLength)).toFixed(1);
      const cutLabel = cutPiece.externalId ? `Piece ${cutPiece.externalId}` : `P${stockIndex + 1}-${cutIndex + 1}`;
      
      // Determine edging string for this cut piece
      const cpAny: any = cutPiece as any;
      const edgingSides: string[] = [];
      if (cpAny && (cpAny.edgeL1 || cpAny.edgeL2 || cpAny.edgeW1 || cpAny.edgeW2)) {
        if (cpAny.edgeL1) edgingSides.push('L1');
        if (cpAny.edgeL2) edgingSides.push('L2');
        if (cpAny.edgeW1) edgingSides.push('W1');
        if (cpAny.edgeW2) edgingSides.push('W2');
      } else if (cpAny && (cpAny.edging !== undefined && cpAny.edging !== null)) {
        if (cpAny.edging === 1 || cpAny.edging === true) {
          edgingSides.push('L1','L2','W1','W2');
        } else if (typeof cpAny.edging === 'string') {
          cpAny.edging.split(',').map((s: string) => s.trim()).filter((s: string) => s).forEach((s: string) => edgingSides.push(s));
        }
      }
      const edgingStr = edgingSides.join(', ');

      // Draw row
      doc.rect(cutPiecesTableStartX, cutPiecesCurrentRowY, cutPiecesColWidths.reduce((a, b) => a + b, 0), cutPiecesRowHeight)
         .stroke();
      
      doc.fontSize(7).fillColor('#000000');
      doc.text(`${cutPieceRowCount + 1}`, cutPiecesTableStartX + 5, cutPiecesCurrentRowY + 4, { width: cutPiecesColWidths[0] });
      doc.text(`${stockIndex + 1}`, cutPiecesTableStartX + cutPiecesColWidths[0] + 5, cutPiecesCurrentRowY + 4, { width: cutPiecesColWidths[1] });
      doc.text(`${cutWidth}`, cutPiecesTableStartX + cutPiecesColWidths[0] + cutPiecesColWidths[1] + 5, cutPiecesCurrentRowY + 4, { width: cutPiecesColWidths[2] });
      doc.text(`${cutLength}`, cutPiecesTableStartX + cutPiecesColWidths[0] + cutPiecesColWidths[1] + cutPiecesColWidths[2] + 5, cutPiecesCurrentRowY + 4, { width: cutPiecesColWidths[3] });
      doc.text(`${cutX}`, cutPiecesTableStartX + cutPiecesColWidths[0] + cutPiecesColWidths[1] + cutPiecesColWidths[2] + cutPiecesColWidths[3] + 5, cutPiecesCurrentRowY + 4, { width: cutPiecesColWidths[4] });
      doc.text(`${cutY}`, cutPiecesTableStartX + cutPiecesColWidths[0] + cutPiecesColWidths[1] + cutPiecesColWidths[2] + cutPiecesColWidths[3] + cutPiecesColWidths[4] + 5, cutPiecesCurrentRowY + 4, { width: cutPiecesColWidths[5] });
      doc.text(`${cutAreaFormatted}`, cutPiecesTableStartX + cutPiecesColWidths[0] + cutPiecesColWidths[1] + cutPiecesColWidths[2] + cutPiecesColWidths[3] + cutPiecesColWidths[4] + cutPiecesColWidths[5] + 5, cutPiecesCurrentRowY + 4, { width: cutPiecesColWidths[6] });
      doc.text(`${edgingStr}`, cutPiecesTableStartX + cutPiecesColWidths[0] + cutPiecesColWidths[1] + cutPiecesColWidths[2] + cutPiecesColWidths[3] + cutPiecesColWidths[4] + cutPiecesColWidths[5] + cutPiecesColWidths[6] + 5, cutPiecesCurrentRowY + 4, { width: cutPiecesColWidths[7] });
      doc.text(`${cutLabel}`, cutPiecesTableStartX + cutPiecesColWidths[0] + cutPiecesColWidths[1] + cutPiecesColWidths[2] + cutPiecesColWidths[3] + cutPiecesColWidths[4] + cutPiecesColWidths[5] + cutPiecesColWidths[6] + cutPiecesColWidths[7] + 5, cutPiecesCurrentRowY + 4, { width: cutPiecesColWidths[8] });
      
      cutPiecesCurrentRowY += cutPiecesRowHeight;
      cutPieceRowCount++;
    });
  });

  console.log(`📄 Cut Pieces Table Complete: Added ${cutPieceRowCount} individual cut pieces with full details`);

  // ADD LIMITED DETAILED DIAGRAMS for first 5 stock pieces
  console.log(`📄 Adding detailed diagrams for first ${stockPiecesToShow} stock pieces`);
  
  solution.stockPieces.slice(0, stockPiecesToShow).forEach((stockPiece, index) => {
    // Add page for each stock piece
    doc.addPage();

    // Title for this stock piece
    doc.rect(50, 50, doc.page.width - 100, 40)
       .fillAndStroke('#003366', '#000000');
    
    doc.fontSize(16)
       .fillColor('#FFFFFF')
       .text(`Stock Piece ${index + 1} - Detailed Layout`, 50, 60, { align: 'center', width: doc.page.width - 100 });
    
    doc.moveDown(2);

    // Stock piece dimensions
    const stockWidth = convertUnit(stockPiece.width, 0, unit);
    const stockLength = convertUnit(stockPiece.length, 0, unit);
    const unitLabel = unit === 0 ? 'mm' : unit === 1 ? 'in' : 'ft';
    
    doc.fontSize(12).fillColor('#000000');
    doc.text(`Stock Dimensions: ${stockWidth.toFixed(1)} × ${stockLength.toFixed(1)} ${unitLabel}`, 50, doc.y + 10);
    doc.text(`Cut Pieces: ${stockPiece.cutPieces.length}`, 50, doc.y + 5);
    doc.moveDown(1);

    // Calculate scale to fit diagram on page
    const diagramMaxWidth = 400;
    const diagramMaxHeight = 300;
    const scaleX = diagramMaxWidth / stockPiece.width;
    const scaleY = diagramMaxHeight / stockPiece.length;
    const scale = Math.min(scaleX, scaleY, 1); // Don't scale up, only down

    const diagramStartX = 100;
    const diagramStartY = doc.y + 20;
    const scaledWidth = stockPiece.width * scale;
    const scaledLength = stockPiece.length * scale;

    // Draw stock piece outline
    doc.rect(diagramStartX, diagramStartY, scaledWidth, scaledLength)
       .stroke('#000000');

    // Draw cut pieces
    stockPiece.cutPieces.forEach((cutPiece, cutIndex) => {
      const scaledX = cutPiece.x * scale;
      const scaledY = cutPiece.y * scale;
      const scaledCutWidth = cutPiece.width * scale;
      const scaledCutLength = cutPiece.length * scale;

      // Draw cut piece rectangle
      doc.rect(diagramStartX + scaledX, diagramStartY + scaledY, scaledCutWidth, scaledCutLength)
         .fillAndStroke('#e6f3ff', '#0066cc');

      // Add cut piece label if there's space
      if (scaledCutWidth > 30 && scaledCutLength > 15) {
        const cutLabel = cutPiece.externalId ? `${cutPiece.externalId}` : `${cutIndex + 1}`;
        doc.fontSize(8).fillColor('#000000');
        doc.text(cutLabel, 
          diagramStartX + scaledX + 2, 
          diagramStartY + scaledY + 2, 
          { width: scaledCutWidth - 4, height: scaledCutLength - 4 }
        );
      }
    });

    // Add dimensions to diagram
    doc.fontSize(10).fillColor('#666666');
    doc.text(`${stockWidth.toFixed(1)}${unitLabel}`, diagramStartX, diagramStartY + scaledLength + 10);
    doc.text(`${stockLength.toFixed(1)}${unitLabel}`, diagramStartX + scaledWidth + 10, diagramStartY);

    // Add cut pieces list to the RIGHT of the diagram (avoid covering labels) and right-align it
    // Compute a safe left boundary just beyond the diagram's right-side labels
    const pageRightMargin = 50;
    const gapFromDiagram = 40; // leave room for dimension text near the diagram's right edge
    const safeLeft = diagramStartX + scaledWidth + gapFromDiagram;
    const panelMaxWidth = 220; // cap width so it doesn't crowd the page
    let panelWidth = Math.min(panelMaxWidth, Math.max(150, doc.page.width - pageRightMargin - safeLeft));

    let listX = doc.page.width - pageRightMargin - panelWidth; // anchor to right margin
    let listY = diagramStartY; // align to top of diagram

    // If there isn't enough horizontal space, place the list below the diagram as a fallback
    if (listX < safeLeft) {
      listX = safeLeft; // clamp to safe area
      panelWidth = Math.max(150, doc.page.width - pageRightMargin - listX);
      if (panelWidth < 150) {
        // Not enough width next to diagram; move below
        listX = 50;
        panelWidth = doc.page.width - 100;
        listY = diagramStartY + scaledLength + 16;
      }
    }

    // Title for the list (right-aligned)
    doc.fontSize(10).fillColor('#000000');
    doc.text('Cut Pieces in this Stock:', listX, listY, { width: panelWidth, align: 'right', continued: false });
    listY = doc.y + 2;

    // Render each bullet item, right-aligned within the panel
    stockPiece.cutPieces.forEach((cutPiece, cutIndex) => {
      const cutWidth = convertUnit(cutPiece.width, 0, unit).toFixed(1);
      const cutLength = convertUnit(cutPiece.length, 0, unit).toFixed(1);
      const cutLabel = cutPiece.externalId ? `Piece ${cutPiece.externalId}` : `Piece ${cutIndex + 1}`;

      doc.fontSize(8).fillColor('#000000');
      doc.text(
        `• ${cutLabel}: ${cutWidth} × ${cutLength} ${unitLabel}`,
        listX,
        listY,
        { width: panelWidth, align: 'right' }
      );
      listY = doc.y + 2;
    });
  });

  console.log(`📄 Detailed Diagrams Complete: Added ${stockPiecesToShow} detailed cutting layouts`);

  // Add simple footer without page switching to avoid buffer errors
  console.log(`Adding simple footer to current page only.`);
  
  try {
    // Add footer with date and basic page info to current page only
    doc.fontSize(8).fillColor('#666666');
    doc.text(
      `HDS Group Cutlist - Generated on ${new Date().toLocaleDateString()}`,
      50,
      doc.page.height - 50,
      { align: 'center', width: doc.page.width - 100 }
    );
      
    console.log('Footer added successfully to current page');
  } catch (error) {
    console.error('Error adding footer:', error);
    // Continue without footer if there's an error
  }
  
  // Finalize PDF
  doc.end();
  
  // Return promise with buffer and ID
  return new Promise<{ buffer: any, id: string }>((resolve) => {
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(buffers);
      resolve({
        buffer: pdfBuffer,
        id: pdfId
      });
    });
  });
};

