import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Paper,
  Button,
  CircularProgress,
  Alert,
  Snackbar,
  Breadcrumbs,
  Link,
  useTheme,
  useMediaQuery,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Tabs,
  Tab
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import CheckIcon from '@mui/icons-material/Check';
import HomeIcon from '@mui/icons-material/Home';
import EditableCutlistTable from '../components/EditableCutlistTable';
import type { SelectChangeEvent } from '@mui/material';
import { getBranchByTradingAs } from '../services/api';

interface StockPiece {
  id: string;
  width: number;
  length: number;
  quantity: number;
  material?: string;
}

interface CutPiece {
  id: string;
  width: number;
  length: number;
  quantity: number;
  name?: string;
}

interface Material {
  id: string;
  name: string;
  type: string;
  thickness: number;
}

interface CutlistData {
  _id?: string; // Added to reflect MongoDB ID if present
  stockPieces: StockPiece[];
  cutPieces: CutPiece[];
  materials: Material[];
  unit: string;
  customerName?: string;
  projectName?: string;
  isConfirmed?: boolean; // To track confirmation status from backend eventually
  rawText?: string; // Added rawText field
}

const CutlistEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // If id is 'new' or undefined, treat as new cutlist
  const isNewCutlist = !id || id === 'new';

  const emptyCutlistData: CutlistData = {
    stockPieces: [],
    cutPieces: [],
    materials: [],
    unit: 'mm',
    customerName: '',
    projectName: ''
  };

  const [cutlistData, setCutlistData] = useState<CutlistData | null>(isNewCutlist ? emptyCutlistData : null);
  const [loading, setLoading] = useState(!isNewCutlist);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'info' | 'warning'>('success');
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [isDataConfirmed, setIsDataConfirmed] = useState(false); // Local confirmation state
  const [ocrEmptyDialogOpen, setOcrEmptyDialogOpen] = useState(false);
  
  // Branch selection state
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [selectedBranchData, setSelectedBranchData] = useState<any | null>(null);
  const [branches] = useState([
    { trading_as: "HDS Alberton" },
    { trading_as: "HDS Bloemfontein" },
    { trading_as: "HDS Brits" },
    { trading_as: "HDS Burgersfort" },
    { trading_as: "HDS Church Street" },
    { trading_as: "HDS De Deur" },
    { trading_as: "HDS Empangeni" },
    { trading_as: "HDS Ermelo" },
    { trading_as: "HDS Hammanskraal" },
    { trading_as: "HDS Klerksdorp" },
    { trading_as: "HDS Krugersdorp" },
    { trading_as: "HDS Kya Sands" },
    { trading_as: "HDS Ladysmith" },
    { trading_as: "HDS Louis Trichardt" },
    { trading_as: "HDS Mafikeng" },
    { trading_as: "HDS Main Reef" },
    { trading_as: "HDS Marula" },
    { trading_as: "HDS Nelspruit" },
    { trading_as: "HDS Newcastle" },
    { trading_as: "HDS Piet Retief" },
    { trading_as: "HDS PMB" },
    { trading_as: "HDS PMB Express" },
    { trading_as: "HDS Secunda" },
    { trading_as: "HDS South Coast" },
    { trading_as: "HDS Soweto" },
    { trading_as: "HDS Springs" },
    { trading_as: "HDS Sunderland" },
    { trading_as: "HDS Tembisa" },
    { trading_as: "HDS Vanderbijlpark" },
    { trading_as: "HDS Waltloo" },
    { trading_as: "HDS Welkom" },
    { trading_as: "HDS Witbank" },
    { trading_as: "HDS Wynberg" },
    { trading_as: "Studio Cut & Edge" }
  ]);
  
  // Fetch full branch data when selectedBranch changes
  useEffect(() => {
    const fetchBranchData = async () => {
      if (selectedBranch) {
        try {
          const data = await getBranchByTradingAs(selectedBranch);
          if (data && data.success && data.data) {
            setSelectedBranchData(data.data);
          } else {
            setSelectedBranchData(null);
            showSnackbar('Branch not found in database', 'warning');
          }
        } catch (err) {
          setSelectedBranchData(null);
          showSnackbar('Failed to fetch branch data', 'error');
        }
      } else {
        setSelectedBranchData(null);
      }
    };
    fetchBranchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranch]);
  const showSnackbar = useCallback((message: string, severity: 'success' | 'error' | 'info' | 'warning') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  }, []); // Empty array as setters are stable

  const fetchCutlistData = useCallback(async () => {
    if (isNewCutlist) {
      setCutlistData(emptyCutlistData);
      setLoading(false);
      setError(null);
      return;
    }
    if (!id) {
      setError('No cutlist ID provided');
      showSnackbar('No cutlist ID provided', 'error');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      console.log('Fetching cutlist data for ID:', id);
      
      const response = await fetch(`/api/cutlist/data/${id}`);
      console.log('API response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Error: ${response.status} ${response.statusText} - ${errorData}`);
      }
      
      const result = await response.json();
      console.log('API response data:', JSON.stringify(result, null, 2));
      
      if (!result.success || !result.cutlist) {
        throw new Error(result.message || 'Failed to load cutlist data: structure incorrect or cutlist missing.');
      }
      
      const rawCutlist = result.cutlist;
      if (!rawCutlist.cutPieces && rawCutlist.dimensions) {
        console.log('Found dimensions but no cutPieces, using dimensions as cutPieces');
        rawCutlist.cutPieces = rawCutlist.dimensions;
      }
      
      const ensureIds = (items: any[], prefix: string): any[] => {
        if (!Array.isArray(items)) return [];
        return items.map((item, index) => ({
          ...item,
          id: item.id || item._id || `${prefix}-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 9)}`
        }));
      };
      
      const safeData: CutlistData = {
        ...rawCutlist,
        rawText: rawCutlist.ocrText, // Explicitly map ocrText to rawText
        cutPieces: ensureIds(rawCutlist.cutPieces || [], 'cp'),
        stockPieces: ensureIds(rawCutlist.stockPieces || [], 'sp'),
      };

      // If we have rawText from OCR, prefer re-parsing on the client
      // This ensures the latest Length x Width parsing rules are applied
      if (safeData.rawText && safeData.rawText.trim().length > 0) {
        console.log('Raw OCR text present — clearing server cutPieces to force client re-parse (LxW).');
        safeData.cutPieces = [];
      }
      
      console.log('Safe data object created:', JSON.stringify(safeData, null, 2));
      setCutlistData(safeData);
      if (safeData.isConfirmed) {
        setIsDataConfirmed(true); // Set local confirmed state if data from backend is confirmed
        showSnackbar('This cutlist was previously confirmed.', 'info');
      }
      setError(null);
    } catch (err) {
      console.error('Error fetching cutlist data:', err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred while fetching data.';
      setError(errorMessage);
      showSnackbar(errorMessage, 'error');
      setCutlistData(null);
    } finally {
      setLoading(false);
    }
  }, [id, showSnackbar]); // Added showSnackbar to dependency array as it's used inside useCallback

  useEffect(() => {
    // Scroll to top when data loading is complete and there's no error
    if (!loading && !error) {
      window.scrollTo(0, 0);
    }
  }, [loading, error]);

  useEffect(() => {
    fetchCutlistData();
  }, [fetchCutlistData]);
  
  // Show dialog if there are no cut pieces (only for existing cutlists, not "/cutlist-edit/new")
  useEffect(() => {
    if (!isNewCutlist && !loading && !error && cutlistData) {
      const noCuts = !Array.isArray(cutlistData.cutPieces) || cutlistData.cutPieces.length === 0;
      if (noCuts) {
        setOcrEmptyDialogOpen(true);
      }
    }
  }, [isNewCutlist, loading, error, cutlistData]);
  
  const handleSaveCutlist = async (dataToSave: CutlistData) => {
    if (!id) {
      showSnackbar('Cannot save: No cutlist ID provided', 'error');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      console.log('Saving cutlist data:', JSON.stringify(dataToSave, null, 2));
      
      const response = await fetch(`/api/cutlist/update/${id}`, {
        method: 'POST', // As per cutlist.routes.ts
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cutlistData: dataToSave }), // Send the whole object
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Error: ${response.status} ${response.statusText} - ${errorData}`);
      }
      
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || 'Failed to save cutlist data');
      }
      
      console.log('Save successful:', result);
      // The backend should return the updated cutlist, or at least confirm success.
      // For now, optimistically update frontend state or re-fetch.
      setCutlistData(dataToSave); // Optimistic update
      showSnackbar('Cutlist data saved successfully!', 'success');
    } catch (err) {
      console.error('Error saving cutlist data:', err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred while saving.';
      setError(errorMessage);
      showSnackbar(errorMessage, 'error');
    } finally {
      setSaving(false);
    }
  };
  
  const handleSendWhatsApp = async (phoneNumber: string, currentData: CutlistData) => {
    if (!id) {
      showSnackbar('Cannot send: No cutlist ID provided', 'error');
      return;
    }
    if (!phoneNumber || !/^\+[1-9]\d{1,14}$/.test(phoneNumber)) {
        showSnackbar('Invalid phone number. Please use international format (e.g., +27123456789).', 'error');
        return;
    }
    try {
      showSnackbar('Sending link to WhatsApp...', 'info');
      const response = await fetch(`/api/cutlist/send-whatsapp/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          phoneNumber,
          customerName: currentData.customerName || 'N/A',
          projectName: currentData.projectName || 'N/A',
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Error: ${response.status} ${response.statusText} - ${errorData}`);
      }
      
      const result = await response.json();
      if (result.success) {
        showSnackbar('WhatsApp message sent successfully!', 'success');
      } else {
        throw new Error(result.message || 'Failed to send WhatsApp message');
      }
    } catch (err) {
      console.error('Error sending WhatsApp message:', err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred while sending WhatsApp message.';
      showSnackbar(errorMessage, 'error');
    }
  };
  
  const handleSnackbarClose = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbarOpen(false);
  };
  
  const handleBack = () => {
    navigate('/');
  };
  
  const handleOpenConfirmDialog = () => {
    if (cutlistData) {
      setConfirmDialogOpen(true);
    } else {
      showSnackbar('No cutlist data to confirm.', 'error');
    }
  };
  
  const handleConfirmDialogClose = () => {
    setConfirmDialogOpen(false);
  };
  
  const handleConfirmDialogConfirm = async () => {
    setConfirmDialogOpen(false);
    // TODO: Implement backend call to mark cutlist as confirmed
    // For now, just update local state and show success message
    setIsDataConfirmed(true);
    if (cutlistData) {
        const updatedData = { ...cutlistData, isConfirmed: true };
        setCutlistData(updatedData);
        // Optionally, call handleSaveCutlist here if confirmation should also save other changes
        // await handleSaveCutlist(updatedData); 
    }
    showSnackbar('Cutlist data confirmed successfully!', 'success');
  };

  const handleOpenWhatsApp = () => {
    const phone = '27769789389'; // international format without '+' for wa.me
    const text = encodeURIComponent('image');
    const url = `https://wa.me/${phone}?text=${text}`;
    // Prefer opening in same tab on mobile to ensure app handoff; new tab fallback on desktop
    window.location.href = url;
  };
  
  return (
    <Container maxWidth="md" sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', py: 3 }}>
      {/* Simple header with just the title - no breadcrumbs or buttons */}
      <Box sx={{ 
        mb: 3,
        p: 2,
        borderBottom: `1px solid ${theme.palette.divider}`
      }}>
        <Typography variant={isMobile ? "h6" : "h5"} component="h1" align="center">
          HDS Cutlist Quotation
        </Typography>
      </Box>

      {/* Conditional Content Area - Below Header */}
      {loading && (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="40vh" sx={{mt: 3}}>
          <CircularProgress />
          <Typography sx={{ ml: 2 }}>Loading cutlist data...</Typography>
        </Box>
      )}

      {!loading && error && (
        <Alert severity="error" sx={{ mb: 2, mt: 3 }}>
          <Typography variant="h6">Error Loading Cutlist</Typography>
          {error}
          <Button onClick={fetchCutlistData} variant="outlined" sx={{mt: 2, ml:1}}>Try Again</Button>
        </Alert>
      )}

      {/* Branch Dropdown - Required Validation */}
      {!loading && !error && (
        <Box sx={{ p: 3, pb: 0 }}>
          <FormControl fullWidth required error={!selectedBranch} sx={{ mb: 2 }} data-testid="branch-dropdown">
            <InputLabel>Select your branch</InputLabel>
            <Select
              value={selectedBranch}
              label="Select your branch"
              onChange={e => setSelectedBranch(e.target.value)}
              disabled={isDataConfirmed}
            >
              {branches.map(branch => (
                <MenuItem key={branch.trading_as} value={branch.trading_as}>{branch.trading_as}</MenuItem>
              ))}
            </Select>
            {!selectedBranch && <FormHelperText>Branch is required</FormHelperText>}
          </FormControl>
        </Box>
      )}

      {!loading && !error && cutlistData && (
        <Paper elevation={3} sx={{ mb: 4, mt: 3, width: '100%' }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', width: '100%' }}>
            <Tabs
              value={0} // Assuming only one tab for now
              aria-label="cutlist tabs"
              sx={{ 
                backgroundColor: theme.palette.grey[100],
                '& .MuiTab-root': {
                  py: isMobile ? 1.5 : 1.5,
                  fontSize: isMobile ? '0.9rem' : '1rem',
                  minWidth: isMobile ? 0 : 'auto',
                  flexGrow: isMobile ? 1 : 'initial',
                }
              }}
              textColor="primary"
              indicatorColor="primary"
              variant={isMobile ? "fullWidth" : "standard"}
            >
              <Tab label="Edit Cutlist" />
            </Tabs>
          </Box>

          {/* Editable Cutlist Table - Pass validation prop */}
          <EditableCutlistTable
            initialData={cutlistData}
            onSave={handleSaveCutlist}
            onSendWhatsApp={handleSendWhatsApp}
            isMobile={isMobile}
            isConfirmed={isDataConfirmed}
            branchData={selectedBranchData}
            selectedBranch={selectedBranch}
            requireMaterialValidation={true}
          />
        </Paper>
      )}

      {/* OCR Empty Dialog */}
      <Dialog open={ocrEmptyDialogOpen} onClose={() => setOcrEmptyDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>We need to process your image again</DialogTitle>
        <DialogContent>
          <DialogContentText>
            We couldn’t find any measurements in your image. Please send the image to us on WhatsApp and we’ll re-process it right away.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOcrEmptyDialogOpen(false)}>Close</Button>
          <Button variant="contained" color="success" startIcon={<WhatsAppIcon />} onClick={handleOpenWhatsApp}>
            Send image on WhatsApp
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default CutlistEdit;
