export interface StockPiece {
  id: string;
  width: number;
  length: number;
  quantity: number;
  material?: string;
}

export interface CutPiece {
  id: string;
  width?: number;
  length?: number;
  quantity?: number;
  name?: string;
  description?: string; // Original description from OCR or input
  edging?: number; // in mm, always 1mm
  separator?: boolean;
  lengthTick1?: boolean;
  lengthTick2?: boolean;
  widthTick1?: boolean;
  widthTick2?: boolean;
  material?: string; // Section material
}

export interface Material {
  id: string;
  name: string;
  type: string;
  thickness: number;
}

export interface CutlistData {
  stockPieces: StockPiece[];
  cutPieces: CutPiece[];
  materials: Material[];
  unit: string;
  customerName?: string;
  projectName?: string;
  rawText?: string; // OCR text for direct parsing
}

export interface EditableCutlistTableProps {
  initialData: CutlistData;
  onSave: (data: CutlistData) => void;
  onSendWhatsApp?: (phoneNumber: string, data: CutlistData, customerName?: string, projectName?: string) => void;
  isMobile?: boolean;
  isConfirmed?: boolean;
  branchData?: any | null;
  selectedBranch?: string;
  requireMaterialValidation?: boolean;
  initialPhoneNumber?: string;
}
