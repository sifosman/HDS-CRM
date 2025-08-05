const fs = require('fs');
const path = require('path');

// Path to the optimizer service file
const filePath = path.resolve(__dirname, 'optimizer.service.ts');
const backupPath = path.resolve(__dirname, 'optimizer.service.ts.bak');

// Create backup
if (fs.existsSync(filePath)) {
  console.log('Creating backup of optimizer.service.ts...');
  fs.copyFileSync(filePath, backupPath);
  console.log('Backup created at optimizer.service.ts.bak');
}

// Read file content as a buffer to handle potential encoding issues
let fileContent;
try {
  fileContent = fs.readFileSync(filePath, { encoding: 'utf8' });
  console.log('File read successfully');
} catch (error) {
  console.error('Error reading file:', error);
  process.exit(1);
}

// Fix template literal syntax errors
const fixes = [
  // Fix generateAndUploadOptimizationPdf fileName issue
  {
    search: /const fileName = optimization__\.pdf;/g,
    replace: `const fileName = \`solution_\${pdfResult.id}.pdf\`;`
  },
  // Fix template literals in text() calls
  {
    search: /\.text\(Generated:\s+,/g,
    replace: '.text(`Generated: ${new Date().toLocaleDateString()}`,',
  },
  {
    search: /doc\.text\(\${totalStockPieces},/g, 
    replace: 'doc.text(`${totalStockPieces}`,',
  },
  {
    search: /doc\.text\(\${totalCutPieces},/g,
    replace: 'doc.text(`${totalCutPieces}`,',
  },
  {
    search: /doc\.text\(\${totalStockAreaConverted}\s+,/g,
    replace: 'doc.text(`${totalStockAreaConverted}`,',
  },
  {
    search: /doc\.text\(\${totalCutAreaConverted}\s+,/g,
    replace: 'doc.text(`${totalCutAreaConverted}`,',
  },
  {
    search: /doc\.text\(\${wasteAreaConverted}\s+,/g,
    replace: 'doc.text(`${wasteAreaConverted}`,',
  },
  {
    search: /doc\.text\(\${wastePercentage}\)% of total material,/g,
    replace: 'doc.text(`${wastePercentage}% of total material`,',
  },
  {
    search: /doc\.text\(\${layout === 0 \? 'Guillotine' : 'Nested'},/g,
    replace: 'doc.text(`${layout === 0 ? \'Guillotine\' : \'Nested\'}`,',
  },
  {
    search: /doc\.text\(\${cutWidthConverted}\s+,/g,
    replace: 'doc.text(`${cutWidthConverted}`,',
  },
  {
    search: /doc\.text\(Case\s+- Stock Piece,/g,
    replace: 'doc.text(`Case - Stock Piece`,',
  },
  {
    search: /doc\.text\(Dimensions:\s+�\s+\);/g,
    replace: 'doc.text(`Dimensions: ${dimensions}`);',
  },
  {
    search: /doc\.text\(Area:\s+\);/g,
    replace: 'doc.text(`Area: ${area}`);',
  },
];

let fixedContent = fileContent;
let fixCount = 0;

// Apply each fix
fixes.forEach(fix => {
  const originalContent = fixedContent;
  fixedContent = fixedContent.replace(fix.search, fix.replace);
  
  // Check if anything changed
  if (originalContent !== fixedContent) {
    fixCount++;
    console.log(`Applied fix: ${fix.search}`);
  }
});

// Save fixed content
try {
  fs.writeFileSync(filePath, fixedContent, { encoding: 'utf8' });
  console.log(`File saved with ${fixCount} fixes applied`);
} catch (error) {
  console.error('Error writing file:', error);
  process.exit(1);
}

console.log('Done! Try compiling the project now.');
