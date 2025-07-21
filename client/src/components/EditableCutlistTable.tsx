import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PRODUCT_DESCRIPTIONS } from '../data/productDescriptions';
import { getMaterialOptions, optimizeCutting, getPdfUrl, getProductPricing, getAllProductDescriptions, generateQuote } from '../services/api';
import * as botsailorService from '../services/botsailor';
import {
  Box,
  Button,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  IconButton,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Snackbar,
  Alert,
  useTheme,
  Grid,
  Checkbox,
  FormControlLabel
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import ShareIcon from '@mui/icons-material/Share';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import { Fab } from '@mui/material'; // Added Fab for mobile

// TabPanel component removed as it's no longer needed

import type { StockPiece, CutPiece, Material, CutlistData, EditableCutlistTableProps } from './EditableCutlistTable/types';

import { 
  parseOcrText, 
  normalizeCutPieces,
  extractQuantityFromDescription, 
  calculateEdging,
  downloadPdf,
  extractDimensions
} from './EditableCutlistTable/utils';

const EditableCutlistTable: React.FC<EditableCutlistTableProps> = ({ 
  initialData, 
  onSave,
  onSendWhatsApp,
  isMobile,
  isConfirmed,
  branchData,
  requireMaterialValidation = false
}) => {
  const theme = useTheme();
  
  // State to track active validation
  const [isValidating, setIsValidating] = useState<boolean>(false);
  
  // State to track when material validation should be enforced
  const [showMaterialValidation, setShowMaterialValidation] = useState<boolean>(false);
  
  // Default material options as fallback
  const DEFAULT_MATERIAL_CATEGORIES = [
    "White Melamine",
    "Color Melamine",
    "Doors", 
    "White Messonite"
  ];
  
  // Default fallback material data structure
  const DEFAULT_MATERIAL_DATA = {
    "White Melamine": { "White": { "Solid": ["Smooth"] } },
    "White Messonite": { "White": { "Solid": ["Smooth"] } },
    "Color Melamine": { "Neutral": { "Solid": ["Smooth"] } },
    "Doors": { "Neutral": { "Solid": ["Smooth"] } }
  };
  
  // ------------------------------------------------------------------
  // Material headings and helper arrays MUST be declared BEFORE they are
  // referenced by normalizeCutPieces(). Declaring them here avoids the
  // "Cannot access '<var>' before initialization" runtime error.
  // Function to directly parse OCR text and extract dimensions and materials
  

  // ------------------------------------------------------------------
  const materialHeadings = [
    { key: "white melamine", value: "White Melamine" },
    { key: "white melamme", value: "White Melamine" }, // Common spelling variation
    { key: "doors", value: "Doors" },
    { key: "door", value: "Doors" }, // Singular form
    { key: "color", value: "Color" },
    { key: "colour", value: "Color" }, // UK spelling
    { key: "white messonite", value: "White Messonite" },
    { key: "messonite", value: "White Messonite" }, // Just messonite
  ];
  const separatorWords = materialHeadings.map(m => m.key);
  // ------------------------------------------------------------------

  // State for the component
  const [hasDirectlyParsed, setHasDirectlyParsed] = useState<boolean>(false);
  
  // State to track materials detected from OCR text
  const [detectedMaterials, setDetectedMaterials] = useState<string[]>([]);
  
  const [cutPieces, setCutPieces] = useState<CutPiece[]>(() => {
    // Check if we have raw OCR text to parse directly
    if (initialData.rawText && !hasDirectlyParsed) {
      console.log('Direct OCR parsing activated');
      const { dimensions, materials } = parseOcrText(initialData.rawText, DEFAULT_MATERIAL_CATEGORIES);
      
      // Save detected materials for later use
      if (materials.length > 0) {
        console.log(`Detected ${materials.length} materials from OCR text:`, materials);
        setDetectedMaterials(materials);
      }
      
      // Convert dimensions to cut pieces
      const pieces: CutPiece[] = dimensions.map((dim, idx) => ({
        id: `dim-${Date.now()}-${idx}`,
        width: dim.width,
        length: dim.length,
        quantity: dim.quantity, // Fixed: use 'quantity' instead of 'count'
        material: dim.material,
        description: dim.description || `${dim.length}x${dim.width}`,
        name: dim.description || `${dim.length}x${dim.width}`,
      }));
      
      // Mark that we've parsed the OCR text
      setHasDirectlyParsed(true);
      
      return pieces;
    }
    
    // If we have initial cut pieces, use them
    if (initialData.cutPieces && initialData.cutPieces.length > 0) {
      return normalizeCutPieces(initialData.cutPieces, DEFAULT_MATERIAL_CATEGORIES);
    }
    
    // Otherwise, return an empty array
    return [];
  });
  const [stockPieces, setStockPieces] = useState<StockPiece[]>(initialData?.stockPieces || []);
  const [materials, setMaterials] = useState<Material[]>(initialData?.materials || []);
  const [unit, setUnit] = useState<string>(initialData?.unit || 'mm');
  const [customerName, setCustomerName] = useState<string>(initialData?.customerName || '');
  const [projectName, setProjectName] = useState<string>(initialData?.projectName || '');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [whatsappDialogOpen, setWhatsappDialogOpen] = useState(false);
  const [quoteSuccessDialogOpen, setQuoteSuccessDialogOpen] = useState(false);
  const [confirmationDialogOpen, setConfirmationDialogOpen] = useState(false);
  const [successQuoteData, setSuccessQuoteData] = useState<{ quoteId: string; pdfUrl: string; phoneNumber?: string } | null>(null);
  const [message, setMessage] = useState<string>('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'info' | 'warning'>('success');
  const [isLoading, setIsLoading] = useState(false);
  
  // Material options from API
  const [materialData, setMaterialData] = useState<any>(DEFAULT_MATERIAL_DATA);
  const [materialCategories, setMaterialCategories] = useState<string[]>([]);
  const [productDescriptions, setProductDescriptions] = useState<string[]>([]);
  const [materialDescriptions, setMaterialDescriptions] = useState<Record<string, string[]>>({});
  const [loadingMaterials, setLoadingMaterials] = useState<boolean>(true);
  
  // State for managing material selections for each section
  interface SectionMaterial {
    category?: string;
    colorFamily?: string;
    decorPattern?: string;
    surfacePattern?: string;
    materialDescription?: string;
  }
  const [sectionMaterials, setSectionMaterials] = useState<Record<number, SectionMaterial>>({});
  
  // Fetch material options from API on component mount
  useEffect(() => {
    async function fetchOptions() {
      setLoadingMaterials(true);
      try {
        // Only use the static PRODUCT_DESCRIPTIONS instead of API call
        console.log('Using static product descriptions from file');
        
        // Use the real product descriptions imported from file
        setProductDescriptions(PRODUCT_DESCRIPTIONS);
        
        // Set default material structure for other dropdowns
        setMaterialData(DEFAULT_MATERIAL_DATA);
        setMaterialCategories(DEFAULT_MATERIAL_CATEGORIES);
        
      } catch (error) {
        console.error('Error setting up material data:', error);
        // Use fallbacks
        setMaterialData(DEFAULT_MATERIAL_DATA);
        setMaterialCategories(DEFAULT_MATERIAL_CATEGORIES);
      } finally {
        setLoadingMaterials(false);
      }
    }
    fetchOptions();
  }, []);

  useEffect(() => {
    if (initialData) {
      const normalized = normalizeCutPieces(initialData.cutPieces || [], DEFAULT_MATERIAL_CATEGORIES);
      setCutPieces(normalized);
      setStockPieces(initialData.stockPieces || []);
      setMaterials(initialData.materials || []);
      setUnit(initialData.unit || 'mm');
      setCustomerName(initialData.customerName || '');
      setProjectName(initialData.projectName || '');
    }
  }, [initialData]);

  useEffect(() => {
    // If we have detected materials from OCR text, use those instead of default
    if (detectedMaterials.length > 0) {
      // Clear existing cut pieces that are separators
      setCutPieces(prevPieces => {
        const nonSeparators = prevPieces.filter(p => !p.separator);
        let result: CutPiece[] = [];
        
        // Add a separator for each detected material
        detectedMaterials.forEach((material, index) => {
          // Add separator
          result.push({
            id: `ocr-sep-${index}-${Date.now()}`,
            name: material,
            separator: true,
          });
          
          // Add cut pieces that match this material
          const materialPieces = nonSeparators.filter(p => p.material === material);
          result = [...result, ...materialPieces];
        });
        
        // Add any remaining pieces that don't have a material match
        const remainingPieces = nonSeparators.filter(p => !detectedMaterials.includes(p.material || ''));
        result = [...result, ...remainingPieces];
        
        return result;
      });
    }
    // Otherwise, make sure at least one material section exists
    else if (cutPieces.length === 0 || !cutPieces.some(p => p.separator)) {
      handleAddMaterialSection();
    }
  }, [detectedMaterials.length]);

  useEffect(() => {
    console.log('Initial data:', initialData);
    console.log('Cut pieces:', cutPieces);
    console.log('Stock pieces:', stockPieces);
    console.log('Materials:', materials);
  }, []);

  const handleCutPieceChange = (id: string, field: keyof CutPiece, value: any) => {
    setCutPieces(prevCutPieces =>
      prevCutPieces.map(piece =>
        piece.id === id ? { ...piece, [field]: value } : piece
      )
    );
  };

  const handleAddMaterialSection = () => {
    // Generate unique IDs for both the separator and the new piece
    const separatorId = `separator-${Date.now()}`;
    const newPieceId = `piece-${Date.now()}`;
    
    // Default material to use
    const defaultMaterial = materialCategories.length > 0 ? materialCategories[0] : 'New Material';
    
    // Add both the separator and a blank piece at once
    setCutPieces(prevCutPieces => [
      ...prevCutPieces,
      // Add the material section separator
      {
        id: separatorId,
        separator: true,
        name: defaultMaterial,
        material: defaultMaterial,
      },
      // Add an empty piece with the same material
      {
        id: newPieceId,
        name: '',
        width: undefined,
        length: undefined,
        quantity: 1,
        material: defaultMaterial,
        edging: 0,
        lengthTick1: false,
        lengthTick2: false,
        widthTick1: false,
        widthTick2: false,
      }
    ]);
    
    // Set a material section for the newly added material if we have material categories
    if (materialCategories.length > 0) {
      // Create a default section material structure for the dropdown
      setSectionMaterials(prev => {
        const newMaterialSection = {
          material: defaultMaterial,
          category: materialCategories[0] || '',
        };
        return {...prev, [cutPieces.length]: newMaterialSection};
      });
    }
    
    // Show confirmation message
    setSnackbarMessage('New material section added');
    setSnackbarSeverity('success');
    setSnackbarOpen(true);
  };

  const handleAddCutPiece = (materialName?: string) => {
    const newId = `cp-${Date.now()}`;
    let targetMaterial = materialName;

    if (!targetMaterial) {
      // Find the last material section to add the piece to
      const lastSeparator = [...cutPieces].reverse().find(p => p.separator);
      targetMaterial = lastSeparator?.name || materialCategories[0] || 'New Material';
    }
    
    const newPiece: CutPiece = {
      id: newId,
      width: 500,
      length: 500,
      quantity: 1,
      name: 'New Piece',
      edging: 1,
      material: targetMaterial,
      lengthTick1: false,
      lengthTick2: false,
      widthTick1: false,
      widthTick2: false,
      separator: false,
    };

    // Find the correct index to insert the new piece
    let insertAtIndex = cutPieces.length;
    if (targetMaterial) {
        // Find the last piece of the same material
        const lastPieceInMaterialSectionIndex = cutPieces.map(p => p.material).lastIndexOf(targetMaterial);
        if (lastPieceInMaterialSectionIndex !== -1) {
            insertAtIndex = lastPieceInMaterialSectionIndex + 1;
        } else {
            // If no pieces of this material, find the separator and insert after it
            const separatorIndex = cutPieces.findIndex(p => p.separator && p.name === targetMaterial);
            if (separatorIndex !== -1) {
                insertAtIndex = separatorIndex + 1;
            }
        }
    }

    const updatedCutPieces = [...cutPieces];
    updatedCutPieces.splice(insertAtIndex, 0, newPiece);
    setCutPieces(updatedCutPieces);
  };

  const handleDeleteCutPiece = (id: string) => {
    setCutPieces(prevCutPieces => prevCutPieces.filter(piece => piece.id !== id));
  };

  // Function to delete a material section and all its pieces
  const handleDeleteMaterialSection = (headingIdx: number) => {
    setCutPieces(prevCutPieces => {
      // Create a copy of current pieces
      const updatedPieces = [...prevCutPieces];
      
      // Find the separator piece at the given index
      if (!updatedPieces[headingIdx] || !updatedPieces[headingIdx].separator) {
        console.error('Cannot delete: invalid material section index or not a separator');
        return prevCutPieces;
      }
      
      // Find the next separator piece (or end of array)
      let nextSeparatorIdx = updatedPieces.findIndex((piece, idx) => 
        idx > headingIdx && piece.separator
      );
      
      if (nextSeparatorIdx === -1) {
        nextSeparatorIdx = updatedPieces.length;
      }
      
      // Remove the separator and all pieces until the next separator
      updatedPieces.splice(headingIdx, nextSeparatorIdx - headingIdx);
      
      // Ensure there's at least one material section left
      if (!updatedPieces.some(piece => piece.separator)) {
        // Add default material section if all were deleted
        updatedPieces.unshift({
          id: `sep-default-${Date.now()}`,
          name: DEFAULT_MATERIAL_CATEGORIES[0],
          separator: true,
        });
      }
      
      return updatedPieces;
    });
  };

  const handleSave = () => {
    // Validate all piece fields
    if (cutPieces.some(p => !p.separator && (!p.length || !p.width || !p.quantity))) {
      setSnackbarMessage('Please fill in all dimensions and quantity for each piece.');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }
    // Material required validation
    if (requireMaterialValidation) {
      const sections = getSections();
      const missingMaterial = sections.some(section => !section.material || section.material.trim() === '');
      if (missingMaterial) {
        setSnackbarMessage('Please select a material for every section.');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
        return;
      }
    }
    onSave({
      stockPieces,
      cutPieces,
      materials,
      unit,
      customerName,
      projectName,
    });
    setSnackbarMessage('Cutlist saved successfully!');
    setSnackbarSeverity('success');
    setSnackbarOpen(true);
  };


  const handleOpenWhatsAppDialog = () => setWhatsappDialogOpen(true);
  const handleCloseWhatsAppDialog = () => setWhatsappDialogOpen(false);

  const handleSendWhatsApp = async () => {
    if (!onSendWhatsApp) return;

    if (!phoneNumber || !customerName) {
        setSnackbarMessage('Phone number and customer name are required.');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
        return;
    }

    const dataToSend = { stockPieces, cutPieces, materials, unit, customerName, projectName };
    
    try {
        await onSendWhatsApp(phoneNumber, dataToSend, customerName, projectName);
        setSnackbarMessage('WhatsApp message sent successfully!');
        setSnackbarSeverity('success');
        setSnackbarOpen(true);
        handleCloseWhatsAppDialog();
    } catch (error) {
        console.error('Error sending WhatsApp message:', error);
        setSnackbarMessage('Failed to send WhatsApp message.');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
    }
  };

  const handleCalculate = () => {
    console.log('handleCalculate called');
    // Validate data
    if (cutPieces.length === 0) {
      setSnackbarMessage('Please add cut pieces first');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }

    // Group the cutlist pieces by material section
    const sections = getSections();
    console.log('Material sections:', sections);
    console.log('Current validation state:', { isValidating, requireMaterialValidation });
    
    if (sections.length === 0) {
      setSnackbarMessage('No valid material sections found. Please add at least one material section with cut pieces.');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }
    
    // Enhanced validation for material dropdowns
    // Check for missing or invalid material selections
    console.log('Validation check - Available product descriptions:', productDescriptions);
    console.log('Validation check - Section materials:', sections.map(s => ({ material: s.material, valid: productDescriptions.includes(s.material) })));
    
    const missingMaterialSections = sections.filter(section => 
      !section.material || 
      section.material.trim() === '' || 
      !productDescriptions.includes(section.material)
    );
    
    console.log('Missing/invalid material sections:', missingMaterialSections.length);
    if (missingMaterialSections.length > 0) {
      // Find the first section with missing or invalid material
      const firstMissingSectionIndex = sections.findIndex(section => 
        !section.material || 
        section.material.trim() === '' || 
        !productDescriptions.includes(section.material)
      );
      
      // Set validation state to true to show validation errors
      console.log('Setting validation state to true for material validation');
      setIsValidating(true);
      
      // Scroll to the first missing material dropdown
      const materialDropdownId = `material-dropdown-${firstMissingSectionIndex}`;
      console.log('Looking for material dropdown with ID:', materialDropdownId);
      const materialDropdownElement = document.getElementById(materialDropdownId);
      
      // Set showMaterialValidation to true as well to ensure both states trigger validation
      setShowMaterialValidation(true);
      
      if (materialDropdownElement) {
        console.log('Found material dropdown element, scrolling to it');
        // Scroll to the element with smooth behavior
        materialDropdownElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
        
        // Add a visual highlight to the dropdown
        materialDropdownElement.style.boxShadow = '0 0 8px 2px rgba(244, 67, 54, 0.6)';
        
        // Add a slight delay then focus the dropdown
        setTimeout(() => {
          // For desktop view, find the select element
          const selectElement = materialDropdownElement.querySelector('div[role="button"]') as HTMLElement;
          if (selectElement) {
            console.log('Focusing and animating select element');
            selectElement.focus();
            // Add a pulsing animation to draw attention
            selectElement.animate(
              [
                { boxShadow: '0 0 0 0 rgba(244, 67, 54, 0.7)' },
                { boxShadow: '0 0 0 10px rgba(244, 67, 54, 0)' },
              ],
              {
                duration: 1500,
                iterations: 3,
              }
            );
          } else {
            console.log('Could not find select element within dropdown');
          }
          
          // Remove the highlight after animation completes
          setTimeout(() => {
            if (materialDropdownElement) {
              materialDropdownElement.style.boxShadow = '';
            }
            // Keep validation state active for a while to ensure user sees the error
            setTimeout(() => {
              setIsValidating(false);
            }, 10000); // Reset validation state after 10 seconds
          }, 4500); // 1500ms * 3 iterations
        }, 500);
      } else {
        console.log('Could not find material dropdown element with ID:', materialDropdownId);
        // Even if we can't find the element, keep validation state active for a while
        setTimeout(() => {
          setIsValidating(false);
        }, 10000); // Reset validation state after 10 seconds
      }
      
      setSnackbarMessage('⚠️ Materials dropdown needs a selection');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }
    
    // Enhanced validation for quantity values >100
    // Check for suspiciously high quantities that might be errors
    const highQuantityPieces = cutPieces.filter(piece => piece.quantity && piece.quantity > 100);
    
    console.log('High quantity pieces found:', highQuantityPieces.length);
    if (highQuantityPieces.length > 0) {
      // Find the first piece with high quantity
      const firstHighQuantityPiece = highQuantityPieces[0];
      const pieceIndex = cutPieces.findIndex(piece => piece.id === firstHighQuantityPiece.id);
      
      // Set validation state to true to show validation errors
      console.log('Setting validation state to true for quantity validation');
      setIsValidating(true);
      
      // Scroll to the first high quantity field
      const quantityFieldId = `quantity-field-${pieceIndex}`;
      console.log('Looking for quantity field with ID:', quantityFieldId);
      const quantityFieldElement = document.getElementById(quantityFieldId);
      
      if (quantityFieldElement) {
        console.log('Found quantity field element, scrolling to it');
        // Scroll to the element with smooth behavior
        quantityFieldElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
        
        // Add a visual highlight to the field
        quantityFieldElement.style.boxShadow = '0 0 8px 2px rgba(255, 152, 0, 0.6)';
        
        // Add a slight delay then focus the field
        setTimeout(() => {
          // Find the input element within the field
          const inputElement = quantityFieldElement.querySelector('input') as HTMLInputElement;
          if (inputElement) {
            console.log('Focusing and animating quantity input element');
            inputElement.focus();
            inputElement.select(); // Select the text for easy editing
            // Add a pulsing animation to draw attention
            inputElement.animate(
              [
                { boxShadow: '0 0 0 0 rgba(255, 152, 0, 0.7)' },
                { boxShadow: '0 0 0 10px rgba(255, 152, 0, 0)' },
              ],
              {
                duration: 1500,
                iterations: 3,
              }
            );
          } else {
            console.log('Could not find input element within quantity field');
          }
          
          // Remove the highlight after animation completes
          setTimeout(() => {
            if (quantityFieldElement) {
              quantityFieldElement.style.boxShadow = '';
            }
            // Keep validation state active for a while to ensure user sees the error
            setTimeout(() => {
              setIsValidating(false);
            }, 10000); // Reset validation state after 10 seconds
          }, 4500); // 1500ms * 3 iterations
        }, 500);
      } else {
        console.log('Could not find quantity field element with ID:', quantityFieldId);
        // Even if we can't find the element, keep validation state active for a while
        setTimeout(() => {
          setIsValidating(false);
        }, 10000); // Reset validation state after 10 seconds
      }
      
      setSnackbarMessage(`⚠️ Quantity ${firstHighQuantityPiece.quantity} seems unusually high. Please verify this is correct.`);
      setSnackbarSeverity('warning');
      setSnackbarOpen(true);
      return;
    }
    
    // All validations passed, open the confirmation dialog
    setConfirmationDialogOpen(true);
  };

  // Function to process the optimizer after user confirms measurements
  const processOptimizer = async () => {
    try {
      setSnackbarMessage('Calculating optimal cutting plan and generating quotation...');
      setSnackbarSeverity('info');
      setSnackbarOpen(true);
      
      // Group the cutlist pieces by material section
      const sections = getSections();
      
      // Prepare data for the backend
      const sectionData = sections.map(section => {
        console.log(`\n=== FRONTEND SECTION DEBUG: ${section.material} ===`);
        console.log(`Processing ${section.pieces.length} pieces:`);
        
        const cutPieces = section.pieces.map(piece => {
          const edgingResult = calculateEdging(piece);
          console.log(`\nPiece: ${piece.name || 'Unnamed'} (${piece.width}x${piece.length}mm, qty: ${piece.quantity || 1})`);
          console.log(`Tick boxes: L1=${piece.lengthTick1}, L2=${piece.lengthTick2}, W1=${piece.widthTick1}, W2=${piece.widthTick2}`);
          console.log(`Calculated edging: "${edgingResult}"`);
          
          return {
            id: piece.id,
            width: piece.width || 0,
            length: piece.length || 0,
            amount: piece.quantity || 1,
            edging: edgingResult, // This now returns a string like "L1,W2"
            name: piece.name
          };
        });
        
        console.log(`=== END FRONTEND SECTION DEBUG ===\n`);
        
        return {
          material: section.material,
          cutPieces
        };
      });
      
      // Prepare the request payload
      const quotePayload = {
        sections: sectionData,
        customerName: customerName || 'Customer',
        projectName: projectName || 'Custom Cutlist',
        phoneNumber: phoneNumber || '',
        branchData: branchData || null
      };
      
      console.log('Sending quote request to backend:', quotePayload);
      
      // Use the new backend endpoint for generating quotes
      const quoteResult = await generateQuote(quotePayload);
      
      console.log('Quote result from backend:', quoteResult);
      
      if (!quoteResult.success) {
        console.error('Quote generation failed:', quoteResult);
        // Use the detailed error message if available, otherwise use the general message or a fallback
        const errorMessage = quoteResult.error || quoteResult.message || 'Unknown error';
        setSnackbarMessage(`Failed to generate quote: ${errorMessage}`);
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
        return;
      }
      
      // Extract data from the response
      const { quoteId, sections: processedSections, grandTotal, pdfUrl } = quoteResult.data;
      
      // Trigger PDF download
      if (pdfUrl) {
        console.log('Downloading PDF from URL:', pdfUrl ? pdfUrl.substring(0, 100) + '...' : 'undefined');
        
        // Handle both Supabase public URLs and base64 data URLs
        if (pdfUrl.startsWith('data:application/pdf;base64,') || pdfUrl.startsWith('http')) {
          console.log('Valid PDF URL detected:', pdfUrl.startsWith('data:') ? 'base64 format' : 'Supabase public URL');
          // Store data and open success modal
          setSuccessQuoteData({
            quoteId,
            pdfUrl,
            phoneNumber: phoneNumber || undefined
          });
          setQuoteSuccessDialogOpen(true);
        } else {
          console.error('Invalid PDF URL format');
          setSnackbarMessage('PDF generation failed: invalid URL format');
          setSnackbarSeverity('error');
          setSnackbarOpen(true);
        }
      } else {
        console.error('No PDF URL received from server');
        setSnackbarMessage('PDF generation failed: no URL received');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
      }
      
      // Generate quotation text for WhatsApp
      const now = new Date();
      const quoteDate = now.toLocaleDateString();
      
      // Helper to format numbers safely without throwing
      const safeFixed = (val: number | undefined | null, digits = 2): string =>
        typeof val === 'number' && isFinite(val) ? val.toFixed(digits) : '-';
      
      const quotationText = `
HDS GROUP QUOTATION

Quote: ${quoteId}
Date: ${quoteDate}
Customer: ${customerName || 'Customer'}
Project: ${projectName || 'Custom Cutlist'}

${'='.repeat(50)}

${processedSections.map(section => 
`MATERIAL: ${section.material}
Board Size: ${section.boardSize}
Quantity: ${section.boardsNeeded}
Price per Board: R ${safeFixed(section.pricePerBoard)}
Section Total: R ${safeFixed(section.sectionTotal)}
`
).join('\n')}
${'='.repeat(50)}

GRAND TOTAL: R ${safeFixed(grandTotal)}

Thank you for your business!
`;
      
      // Set a success message
      setSnackbarMessage(`Quotation generated successfully. Total: R ${safeFixed(grandTotal)}`);
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      
      // WhatsApp message will be sent from the success modal when user clicks the button
      
    } catch (error) {
      console.error('Calculation error:', error);
      setSnackbarMessage('Failed to calculate boards and price.');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  // Handle closing the quote success dialog
  const handleCloseQuoteSuccessDialog = () => {
    setQuoteSuccessDialogOpen(false);
  };
  
  // Handle closing the snackbar
  const handleCloseSnackbar = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbarOpen(false);
  };

  const handleCloseConfirmationDialog = () => {
    setConfirmationDialogOpen(false);
  };

  const handleConfirmMeasurements = async () => {
    setConfirmationDialogOpen(false);
    await processOptimizer();
  };

  const navigate = useNavigate();
  // Handle creating a new quote from the success modal
  const handleNewQuote = () => {
    navigate('/cutlist-edit/new');
  };

  // Handle PDF download from the success modal
  const handleDownloadQuotePdf = () => {
    if (successQuoteData?.pdfUrl) {
      downloadPdf(successQuoteData.pdfUrl, `Quote-${successQuoteData.quoteId}.pdf`);
    }
  };
  
  // Handle sharing to WhatsApp from the success modal
  const handleShareToWhatsApp = async () => {
    if (!successQuoteData?.quoteId || !successQuoteData?.pdfUrl) {
      setSnackbarMessage('Missing quote data for WhatsApp sharing');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }
    
    try {
      // Set loading state
      setIsLoading(true);
      
      // Extract PDF data URL and convert to proper URL if needed
      let pdfUrl = successQuoteData.pdfUrl;
      let finalPdfUrl = pdfUrl;
      
      // If this is a data URL, we need to upload it to the server to get a shareable link
      const isPdfDataUrl = pdfUrl.startsWith('data:application/pdf');
      
      if (isPdfDataUrl) {
        // Show loading message
        setSnackbarMessage('Preparing PDF for sharing...');
        setSnackbarSeverity('info');
        setSnackbarOpen(true);
        
        try {
          // Upload PDF data URL to get a shareable link
          const response = await fetch('/api/quotes/upload-pdf', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              quoteId: successQuoteData.quoteId,
              pdfDataUrl: pdfUrl
            }),
          });
          
          if (!response.ok) {
            throw new Error('Failed to upload PDF');
          }
          
          const result = await response.json();
          finalPdfUrl = result.pdfUrl; // Use the URL returned by the server
          
        } catch (uploadError) {
          console.error('PDF upload error:', uploadError);
          // If upload fails, we'll use a fallback message
          setSnackbarMessage('Failed to prepare PDF for sharing, using fallback method');
          setSnackbarSeverity('warning');
          setSnackbarOpen(true);
        }
      }
      
      // Create a thank you message from HDS stating that the quotation is ready
      let thankYouMessage = `Thank you for choosing HDS Group! Your quotation (ID: ${successQuoteData.quoteId}) is now ready.`;
      
      // Always include the PDF link - either the uploaded URL or the original URL
      thankYouMessage += ` You can view and download your quotation at: ${finalPdfUrl}\n\nWe appreciate your business and look forward to working with you.`;
      
      // Encode the message for the WhatsApp URL
      const encodedMessage = encodeURIComponent(thankYouMessage);
      
      // Create the WhatsApp URL with the encoded message
      const whatsappUrl = `whatsapp://send?text=${encodedMessage}`;
      
      // Clear loading state
      setIsLoading(false);
      
      // Open the URL in a new window/tab
      window.open(whatsappUrl, '_blank');
      
      setSnackbarMessage('WhatsApp sharing initiated with PDF download link');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
      handleCloseQuoteSuccessDialog();
    } catch (error) {
      console.error('WhatsApp sharing error:', error);
      setSnackbarMessage('Failed to initiate WhatsApp sharing');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      setIsLoading(false);
    }
  };

  // This function finds all sections based on separator pieces
  const getSections = () => {
    const sections: { material: string, pieces: CutPiece[], headingIdx: number }[] = [];
    if (!cutPieces) {
      console.log('EditableCutlistTable: No cut pieces available');
      return sections;
    }
    
    console.log('EditableCutlistTable: Processing', cutPieces.length, 'cut pieces for sections');
    console.log('EditableCutlistTable: Separator pieces:', cutPieces.filter(p => p.separator).map(p => p.name || 'Unnamed'));

    let currentPieces: CutPiece[] = [];
    let currentMaterial: string | undefined;
    let currentHeadingIdx: number = -1;

    cutPieces.forEach((piece, idx) => {
      // Debug the current piece
      console.log(`EditableCutlistTable: Processing piece ${idx}:`, { 
        id: piece.id, 
        name: piece.name, 
        separator: piece.separator,
        material: piece.material,
        dimensions: `${piece.length}x${piece.width}`
      });
      
      if (piece.separator) {
        console.log(`EditableCutlistTable: Found separator at index ${idx} for material: ${piece.name}`);
        if (currentMaterial !== undefined && currentHeadingIdx !== -1) {
          sections.push({ material: currentMaterial, pieces: currentPieces, headingIdx: currentHeadingIdx });
          console.log(`EditableCutlistTable: Created section for ${currentMaterial} with ${currentPieces.length} pieces`);
        }
        currentMaterial = piece.name || 'Unknown Material';
        currentHeadingIdx = idx;
        currentPieces = [];
      } else {
        currentPieces.push(piece);
      }
    });

    if (currentMaterial !== undefined && currentHeadingIdx !== -1) {
      sections.push({ material: currentMaterial, pieces: currentPieces, headingIdx: currentHeadingIdx });
      console.log(`EditableCutlistTable: Created final section for ${currentMaterial} with ${currentPieces.length} pieces`);
    }
    
    console.log('EditableCutlistTable: Created', sections.length, 'material sections');
    console.log('EditableCutlistTable: Section materials:', sections.map(s => s.material));
    
    return sections;
  };

  const sections = getSections();

  return (
    <Paper elevation={3}>
      {isMobile ? (
        // Mobile Card View
        <Box sx={{ p: 2 }}>
          {/* Mobile view heading with add material section button */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Cutlist</Typography>
            <Button 
              variant="contained" 
              color="secondary"
              size="small"
              startIcon={<AddIcon />}
              onClick={handleAddMaterialSection}
              disabled={isConfirmed}
              sx={{ fontWeight: 'bold' }}
            >
              Add Material
            </Button>
          </Box>
          
          {console.log('Rendering mobile sections, validation state:', { isValidating, requireMaterialValidation })}
          {sections.map((section, sectionIdx) => (
            <Box key={`section-mobile-${sectionIdx}`} sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                {console.log(`Rendering section ${sectionIdx}, material: ${section.material}, validation: ${(requireMaterialValidation || isValidating) && (!section.material || section.material.trim() === '')}`)}
                
                  <FormControl 
                    fullWidth 
                    size="medium" 
                    required={showMaterialValidation || requireMaterialValidation || isValidating} 
                    error={(showMaterialValidation || requireMaterialValidation || isValidating) && (!section.material || section.material.trim() === '' || !productDescriptions.includes(section.material))}
                    id={`material-dropdown-${sectionIdx}`}
                    sx={{
                      animation: isValidating && (!section.material || section.material.trim() === '') ? 
                        'pulse 1.5s infinite' : 'none',
                      '@keyframes pulse': {
                        '0%': {
                          boxShadow: '0 0 0 0 rgba(211, 47, 47, 0.7)',
                        },
                        '70%': {
                          boxShadow: '0 0 0 10px rgba(211, 47, 47, 0)',
                        },
                        '100%': {
                          boxShadow: '0 0 0 0 rgba(211, 47, 47, 0)',
                        },
                      },
                      mb: (showMaterialValidation || requireMaterialValidation || isValidating) && (!section.material || section.material.trim() === '' || !productDescriptions.includes(section.material)) ? 0 : 2,
                      '& .MuiOutlinedInput-root': {
                        fontSize: '1.1rem',
                        fontWeight: 'bold',
                        border: '3px solid #1976d2',
                        borderRadius: '8px',
                        backgroundColor: '#f8f9ff',
                        '&:hover': {
                          border: '3px solid #1565c0',
                        },
                        '&.Mui-focused': {
                          border: '3px solid #0d47a1',
                          boxShadow: '0 0 0 2px rgba(25, 118, 210, 0.2)',
                        },
                        '&.Mui-error': {
                          border: '3px solid #d32f2f',
                          backgroundColor: '#fff5f5',
                        }
                      },
                      '& .MuiInputLabel-root': {
                        fontSize: '1.1rem',
                        fontWeight: 'bold',
                        color: '#1976d2',
                        '&.Mui-focused': {
                          color: '#0d47a1',
                        },
                        '&.Mui-error': {
                          color: '#d32f2f',
                        }
                      }
                    }}
                  >
                    <InputLabel>Material</InputLabel>
                    <Select
                        value={section.material}
                        onChange={(e) => {
                            const newMaterial = e.target.value;
                            const updatedPieces = [...cutPieces];
                            updatedPieces[section.headingIdx].name = newMaterial;
                            // Update material for all pieces in this section
                            for (let i = section.headingIdx + 1; i < updatedPieces.length; i++) {
                                if (updatedPieces[i].separator) break;
                                updatedPieces[i].material = newMaterial;
                            }
                            setCutPieces(updatedPieces);
                        }}
                        disabled={isConfirmed || loadingMaterials}
                    >
                        {loadingMaterials ? <MenuItem disabled>Loading...</MenuItem> : productDescriptions.map(description => (
                            <MenuItem key={description} value={description}>{description}</MenuItem>
                        ))}
                    </Select>
                    {(showMaterialValidation || requireMaterialValidation || isValidating) && (!section.material || section.material.trim() === '' || !productDescriptions.includes(section.material)) && (
                      <Box sx={{ 
                        mt: 1, 
                        mb: 2,
                        p: 1.5, 
                        backgroundColor: '#ffebee', 
                        border: '2px solid #f44336', 
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        animation: isValidating ? 'pulse 2s infinite' : 'none',
                        '@keyframes pulse': {
                          '0%': { opacity: 1, boxShadow: '0 0 0 0 rgba(244, 67, 54, 0.4)' },
                          '50%': { opacity: 0.8, boxShadow: '0 0 0 10px rgba(244, 67, 54, 0)' },
                          '100%': { opacity: 1, boxShadow: '0 0 0 0 rgba(244, 67, 54, 0)' },
                        },
                      }}>
                        <Typography variant="body2" color="error" sx={{ fontWeight: 'bold', fontSize: '1rem' }}>
                          ⚠️ Materials dropdown needs a selection
                        </Typography>
                      </Box>
                    )}
                  </FormControl>
                  <IconButton
                    aria-label="Delete material section"
                    onClick={() => {
                      if (isConfirmed || loadingMaterials) return;
                      // Delete the entire material section instead of just clearing the name
                      handleDeleteMaterialSection(section.headingIdx);
                    }}
                    color="error"
                    sx={{ ml: 1 }}
                    disabled={isConfirmed || loadingMaterials || sections.length <= 1} // Prevent deleting the last section
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>

              {section.pieces.map((piece, pieceIdx) => (
                <Paper key={piece.id} elevation={2} sx={{ p: 2, mb: 2 }}>
                  <TextField fullWidth label="Name" value={piece.name || ''} onChange={(e) => handleCutPieceChange(piece.id, 'name', e.target.value)} variant="outlined" size="small" sx={{ mb: 1.5 }} disabled={isConfirmed} />
                  <Box sx={{ display: 'flex', gap: 2, mb: 1.5 }}>
                    <TextField label={`Length (${unit})`} type="number" value={piece.length ?? ''} onChange={(e) => handleCutPieceChange(piece.id, 'length', e.target.value)} variant="outlined" size="small" disabled={isConfirmed} />
                    <TextField label={`Width (${unit})`} type="number" value={piece.width ?? ''} onChange={(e) => handleCutPieceChange(piece.id, 'width', e.target.value)} variant="outlined" size="small" disabled={isConfirmed} />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', mb: 1 }}>
                    <FormControlLabel control={<Checkbox checked={!!piece.lengthTick1} onChange={e => handleCutPieceChange(piece.id, 'lengthTick1', e.target.checked)} disabled={isConfirmed} />} label="L1" />
                    <FormControlLabel control={<Checkbox checked={!!piece.lengthTick2} onChange={e => handleCutPieceChange(piece.id, 'lengthTick2', e.target.checked)} disabled={isConfirmed} />} label="L2" />
                    <FormControlLabel control={<Checkbox checked={!!piece.widthTick1} onChange={e => handleCutPieceChange(piece.id, 'widthTick1', e.target.checked)} disabled={isConfirmed} />} label="W1" />
                    <FormControlLabel control={<Checkbox checked={!!piece.widthTick2} onChange={e => handleCutPieceChange(piece.id, 'widthTick2', e.target.checked)} disabled={isConfirmed} />} label="W2" />
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2}}>
                    <TextField label="Quantity" type="number" value={piece.quantity !== undefined && piece.quantity !== null ? piece.quantity : 1} onChange={(e) => handleCutPieceChange(piece.id, 'quantity', e.target.value)} variant="outlined" size="small" inputProps={{ min: 1 }} disabled={isConfirmed} />
                    <IconButton onClick={() => handleDeleteCutPiece(piece.id)} color="error" disabled={isConfirmed}><DeleteIcon /></IconButton>
                  </Box>
                </Paper>
              ))}
            </Box>
          ))}
          <Fab color="primary" aria-label="add cut piece" sx={{ position: 'fixed', bottom: 16, right: 16 }} onClick={() => handleAddCutPiece()} disabled={isConfirmed}><AddIcon /></Fab>
        </Box>
      ) : (
        // Desktop Table View
        <Box sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Cutlist</Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button variant="outlined" startIcon={<AddIcon />} onClick={() => handleAddCutPiece()} disabled={isConfirmed}>Add Piece</Button>
              <Button 
                variant="contained" 
                color="secondary" 
                startIcon={<AddIcon />} 
                onClick={handleAddMaterialSection} 
                disabled={isConfirmed}
                sx={{ fontWeight: 'bold' }}
              >
                Add New Material Section
              </Button>
            </Box>
          </Box>
          {(() => {
            // Get all material sections
            const sections = getSections();
            
            if (sections.length === 0 && cutPieces.length === 0) {
              // No materials or pieces yet, show a welcome message
              return (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="h6" sx={{ mb: 2 }}>No materials added yet</Typography>
                  <Button 
                    variant="contained" 
                    color="primary"
                    startIcon={<AddIcon />}
                    onClick={handleAddMaterialSection}
                  >
                    Add Your First Material Section
                  </Button>
                </Box>
              );
            }
            
            // Return a separate table for each material section
            return sections.map((section, sectionIndex) => (
              <Box key={section.headingIdx} sx={{ mb: 4 }}>
                <Paper elevation={2} sx={{ p: 0, borderRadius: '4px', overflow: 'hidden' }}>
                  {/* Section header */}
                  <Box 
                    sx={{ 
                      bgcolor: 'primary.main', 
                      color: 'white', 
                      px: 2, 
                      py: 1,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {/* Material dropdown for desktop view */}
                      <FormControl 
                        required={showMaterialValidation || requireMaterialValidation} 
                        error={(showMaterialValidation || requireMaterialValidation) && (!section.material || section.material.trim() === '' || !productDescriptions.includes(section.material))}
                        id={`material-dropdown-${sectionIndex}`}
                        sx={{
                          minWidth: 200,
                          mr: 2,
                          '& .MuiOutlinedInput-root': {
                            color: 'white',
                            '& fieldset': {
                              borderColor: 'rgba(255, 255, 255, 0.5)',
                            },
                            '&:hover fieldset': {
                              borderColor: 'white',
                            },
                            '&.Mui-focused fieldset': {
                              borderColor: 'white',
                            },
                            '&.Mui-error fieldset': {
                              borderColor: '#ff6b6b',
                            }
                          },
                          '& .MuiInputLabel-root': {
                            color: 'rgba(255, 255, 255, 0.7)',
                            '&.Mui-focused': {
                              color: 'white',
                            },
                            '&.Mui-error': {
                              color: '#ff6b6b',
                            }
                          },
                          '& .MuiSelect-icon': {
                            color: 'white',
                          }
                        }}
                      >
                        <InputLabel>Material</InputLabel>
                        <Select
                          value={section.material || ''}
                          onChange={(e) => {
                            const newMaterial = e.target.value;
                            const updatedPieces = [...cutPieces];
                            updatedPieces[section.headingIdx].name = newMaterial;
                            // Update material for all pieces in this section
                            for (let i = section.headingIdx + 1; i < updatedPieces.length; i++) {
                              if (updatedPieces[i].separator) break;
                              updatedPieces[i].material = newMaterial;
                            }
                            setCutPieces(updatedPieces);
                          }}
                          disabled={isConfirmed || loadingMaterials}
                          label="Material"
                        >
                          {loadingMaterials ? <MenuItem disabled>Loading...</MenuItem> : productDescriptions.map(description => (
                            <MenuItem key={description} value={description}>{description}</MenuItem>
                          ))}
                        </Select>
                        {(showMaterialValidation || requireMaterialValidation) && (!section.material || section.material.trim() === '' || !productDescriptions.includes(section.material)) && (
                          <Box sx={{ 
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            mt: 1, 
                            p: 1, 
                            backgroundColor: '#ffebee', 
                            border: '2px solid #f44336', 
                            borderRadius: '4px',
                            zIndex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1
                          }}>
                            <Typography variant="body2" color="error" sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}>
                              ⚠️ Materials dropdown needs a selection
                            </Typography>
                          </Box>
                        )}
                      </FormControl>
                      
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
                        Section {sectionIndex + 1}
                      </Typography>
                      {!isConfirmed && sections.length > 1 && (
                        <IconButton 
                          size="small" 
                          onClick={() => handleDeleteMaterialSection(section.headingIdx)}
                          sx={{ ml: 1, color: 'white' }}
                          disabled={isConfirmed}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Box>
                    {!isConfirmed && (
                      <Button 
                        variant="contained" 
                        color="secondary" 
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={() => handleAddCutPiece(section.material)}
                      >
                        Add Piece
                      </Button>
                    )}
                  </Box>
                  
                  {/* Section table */}
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          {!isConfirmed && <TableCell width="5%"></TableCell>}
                          <TableCell width="30%">Name</TableCell>
                          <TableCell width="15%" align="right">Width (mm)</TableCell>
                          <TableCell width="15%" align="right">Length (mm)</TableCell>
                          <TableCell width="10%" align="right">Qty</TableCell>
                          {!isConfirmed && (
                            <>
                              <TableCell width="5%" align="center">L1</TableCell>
                              <TableCell width="5%" align="center">L2</TableCell>
                              <TableCell width="5%" align="center">W1</TableCell>
                              <TableCell width="5%" align="center">W2</TableCell>
                            </>
                          )}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {section.pieces.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={isConfirmed ? 5 : 9} align="center">
                              <Typography sx={{ py: 2, color: 'text.secondary' }}>No pieces added to this material section</Typography>
                            </TableCell>
                          </TableRow>
                        ) : (
                          section.pieces.map((piece, pieceIndex) => {
                            // Calculate global piece index for validation targeting
                            const globalPieceIndex = cutPieces.findIndex(p => p.id === piece.id);
                            return (
                            <TableRow key={piece.id}>
                              {!isConfirmed && (
                                <TableCell>
                                  <IconButton 
                                    size="small" 
                                    onClick={() => handleDeleteCutPiece(piece.id)}
                                    disabled={isConfirmed}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </TableCell>
                              )}
                              <TableCell>
                                <TextField
                                  variant="standard"
                                  value={piece.name || ''}
                                  onChange={(e) => handleCutPieceChange(piece.id, 'name', e.target.value)}
                                  fullWidth
                                  disabled={isConfirmed}
                                />
                              </TableCell>
                              <TableCell align="right">
                                <TextField
                                  variant="standard"
                                  value={piece.width || ''}
                                  onChange={(e) => handleCutPieceChange(piece.id, 'width', Number(e.target.value))}
                                  type="number"
                                  InputProps={{ inputProps: { min: 0, step: 1 } }}
                                  disabled={isConfirmed}
                                />
                              </TableCell>
                              <TableCell align="right">
                                <TextField
                                  variant="standard"
                                  value={piece.length || ''}
                                  onChange={(e) => handleCutPieceChange(piece.id, 'length', Number(e.target.value))}
                                  type="number"
                                  InputProps={{ inputProps: { min: 0, step: 1 } }}
                                  disabled={isConfirmed}
                                />
                              </TableCell>
                              <TableCell align="right">
                                <TextField
                                  id={`quantity-field-${globalPieceIndex}`}
                                  variant="standard"
                                  value={piece.quantity !== undefined && piece.quantity !== null ? piece.quantity : 1}
                                  onChange={(e) => handleCutPieceChange(piece.id, 'quantity', Number(e.target.value))}
                                  type="number"
                                  InputProps={{ inputProps: { min: 1, step: 1 } }}
                                  disabled={isConfirmed}
                                />
                              </TableCell>
                              {!isConfirmed && (
                                <>
                                  <TableCell align="center">
                                    <Checkbox 
                                      checked={!!piece.lengthTick1} 
                                      onChange={(e) => handleCutPieceChange(piece.id, 'lengthTick1', e.target.checked)}
                                      disabled={isConfirmed}
                                    />
                                  </TableCell>
                                  <TableCell align="center">
                                    <Checkbox 
                                      checked={!!piece.lengthTick2} 
                                      onChange={(e) => handleCutPieceChange(piece.id, 'lengthTick2', e.target.checked)}
                                      disabled={isConfirmed}
                                    />
                                  </TableCell>
                                  <TableCell align="center">
                                    <Checkbox 
                                      checked={!!piece.widthTick1} 
                                      onChange={(e) => handleCutPieceChange(piece.id, 'widthTick1', e.target.checked)}
                                      disabled={isConfirmed}
                                    />
                                  </TableCell>
                                  <TableCell align="center">
                                    <Checkbox 
                                      checked={!!piece.widthTick2} 
                                      onChange={(e) => handleCutPieceChange(piece.id, 'widthTick2', e.target.checked)}
                                      disabled={isConfirmed}
                                    />
                                  </TableCell>
                                </>
                              )}
                            </TableRow>
                          );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Box>
            ));
          })()}
          {!isConfirmed && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2, mb: 2 }}>
              <Box>
              </Box>
            </Box>
          )}
        </Box>
      )}

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        
        {!isConfirmed && (
          <Button
            variant="contained"
            color="secondary"
            startIcon={<AddIcon />}
            onClick={handleAddMaterialSection}
          >
            Add New Material Section
          </Button>
        )}
        <Button 
          variant="contained" 
          color="primary" 
          onClick={handleCalculate}
        >
          Confirm Cutlist
        </Button>
        
      </Box>

      <Dialog open={whatsappDialogOpen} onClose={handleCloseWhatsAppDialog}>
        <DialogTitle>Send Cutlist to WhatsApp</DialogTitle>
        <DialogContent>
          <TextField label="Phone Number" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} fullWidth margin="normal" required />
          <TextField label="Customer Name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} fullWidth margin="normal" />
          <TextField label="Project Name" value={projectName} onChange={(e) => setProjectName(e.target.value)} fullWidth margin="normal" />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseWhatsAppDialog}>Cancel</Button>
          <Button onClick={handleSendWhatsApp} color="primary">Send</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={handleCloseSnackbar}>
        <Alert onClose={handleCloseSnackbar} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmationDialogOpen}
        onClose={handleCloseConfirmationDialog}
        aria-labelledby="confirmation-dialog-title"
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle id="confirmation-dialog-title" sx={{ bgcolor: 'primary.main', color: 'white' }}>
          Please Confirm Your Measurements
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Typography variant="h6" gutterBottom>
            Are you sure all measurements and material selections are correct?
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Once confirmed, we will generate your optimal cutting plan and prepare your quotation.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseConfirmationDialog}>Cancel</Button>
          <Button onClick={handleConfirmMeasurements} variant="contained" color="primary">
            Yes, Continue
          </Button>
        </DialogActions>
      </Dialog>

      {/* Quote Success Dialog */}
      <Dialog
        open={quoteSuccessDialogOpen}
        onClose={handleCloseQuoteSuccessDialog}
        aria-labelledby="quote-success-dialog-title"
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle id="quote-success-dialog-title" sx={{ bgcolor: 'primary.main', color: 'white' }}>
          Quotation Generated Successfully
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          <Typography variant="h6" gutterBottom>
            Your quote is ready! What would you like to do with it?
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Quote ID: {successQuoteData?.quoteId}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 3, width: '100%' }}>
            <Box sx={{ flex: 1 }}>
              <Button
                fullWidth
                variant="contained"
                startIcon={<DownloadIcon />}
                onClick={handleDownloadQuotePdf}
                sx={{ py: 2 }}
              >
                Download PDF
              </Button>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Button
                fullWidth
                variant="contained"
                color="success"
                startIcon={<WhatsAppIcon />}
                onClick={handleShareToWhatsApp}
                sx={{ py: 2 }}
              >
                Share via WhatsApp
              </Button>
            </Box>
          </Box>
          {/* Phone number alert message removed as requested */}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleNewQuote} variant="contained" color="secondary" sx={{ mr: 1 }}>
            New Quote
          </Button>
          <Button onClick={handleCloseQuoteSuccessDialog} color="primary">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default EditableCutlistTable;
