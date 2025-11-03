import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || (
  window.location.hostname === 'localhost'
    ? 'http://localhost:5000/api'
    : '/api'
);

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Project endpoints
export const getProjects = async () => {
  const response = await api.get('/projects');
  return response.data;
};

export const getProject = async (id: string) => {
  const response = await api.get(`/projects/${id}`);
  return response.data;
};

export const createProject = async (projectData: any) => {
  const response = await api.post('/projects', projectData);
  return response.data;
};

export const updateProject = async (id: string, projectData: any) => {
  const response = await api.put(`/projects/${id}`, projectData);
  return response.data;
};

export const deleteProject = async (id: string) => {
  const response = await api.delete(`/projects/${id}`);
  return response.data;
};

// Optimizer endpoints
export const optimizeCutting = async (data: any): Promise<any> => {
  const response = await api.post('/optimizer/optimize', data);
  return response.data;
};

// Generate a complete quote with optimization, pricing, and PDF
export const generateQuote = async (quoteData: any): Promise<any> => {
  const response = await api.post('/optimizer/quote', quoteData);
  return response.data;
};

export const getPdfUrl = (pdfId: string) => {
  return `${API_URL}/optimizer/pdf/${pdfId}`;
};

// IQ Software endpoints
export const exportIQData = async (solution: any, unit: number, width: number, layout: number): Promise<any> => {
  const response = await api.post('/optimizer/export-iq', { solution, unit, width, layout });
  return response.data;
};

export const importIQData = async (iqData: any): Promise<any> => {
  const response = await api.post('/optimizer/import-iq', iqData);
  return response.data;
};

// Botsailor endpoints
export const getBotsailorStatus = async (): Promise<any> => {
  const response = await api.get('/botsailor/status');
  return response.data;
};

export const syncWithBotsailor = async (projectId: string, direction: 'push' | 'pull'): Promise<any> => {
  const response = await api.post(`/botsailor/sync/${projectId}`, { direction });
  return response.data;
};

export const getBotsailorMaterials = async (): Promise<any> => {
  const response = await api.get('/botsailor/materials');
  return response.data;
};

export const getBotsailorStockPieces = async (materialId: string): Promise<any> => {
  const response = await api.get(`/botsailor/stock?materialId=${materialId}`);
  return response.data;
};

// OCR endpoints
export const getOCRStatus = async (id: string): Promise<any> => {
  const response = await api.get(`/ocr/status/${id}`);
  return response.data;
};

export const updateCutlistData = async (cutlistData: any): Promise<any> => {
  const response = await api.put('/ocr/update', { cutlistData });
  return response.data;
};

export const sendWhatsAppConfirmation = async (
  phoneNumber: string,
  cutlistData: any,
  customerName?: string,
  projectName?: string
): Promise<any> => {
  const response = await api.post('/ocr/send-whatsapp', {
    phoneNumber,
    cutlistData,
    customerName,
    projectName
  });
  return response.data;
};

// Material options endpoint
export const getMaterialOptions = async (): Promise<any> => {
  const response = await api.get('/supabase/materials/options');
  return response.data;
};

// Product pricing endpoint
export const getProductPricing = async (materialName: string): Promise<any> => {
  try {
    // First try exact match, include the sizes column in the response
    const response = await api.get(`/supabase/products/pricing?description=${encodeURIComponent(materialName)}&includeSizes=true`);
    return response.data;
  } catch (error) {
    console.error('Error fetching product pricing:', error);
    return { success: false, error: 'Failed to get product pricing' };
  }
};

// Get all product descriptions from the database
export const getAllProductDescriptions = async (): Promise<string[]> => {
  try {
    console.log('Fetching product descriptions from API...');
    const response = await api.get('/supabase/products/descriptions');
    console.log('API response:', response.data);
    
    if (response.data.success && Array.isArray(response.data.data)) {
      const descriptions = response.data.data.map((product: any) => product.description);
      console.log(`Found ${descriptions.length} product descriptions:`, descriptions);
      return descriptions;
    }
    
    console.warn('No product descriptions found in API response:', response.data);
    return [];
  } catch (error) {
    console.error('Error fetching product descriptions:', error);
    return [];
  }
};

// Branch data endpoint
export const getBranchByTradingAs = async (tradingAs: string): Promise<any> => {
  const response = await api.get(`/supabase/branches/by-trading-as/${encodeURIComponent(tradingAs)}`);
  return response.data;
};

// List quote PDFs from storage bucket
export const listQuotePdfs = async (prefix: string = ''): Promise<any> => {
  const qs = prefix ? `?prefix=${encodeURIComponent(prefix)}` : '';
  const response = await api.get(`/supabase/quotes/storage${qs}`);
  return response.data;
};

export default api;
