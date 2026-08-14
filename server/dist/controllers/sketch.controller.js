"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderSketch = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
// Initialize Supabase client for storage uploads (lazy init)
let supabaseClient = null;
function getSupabase() {
    if (!supabaseClient) {
        const supabaseUrl = process.env.SUPABASE_URL || 'https://xzsibbbghotreolzwnyk.supabase.co';
        const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
        supabaseClient = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
    }
    return supabaseClient;
}
const BUCKET = 'hdsquotes';
/**
 * POST /api/sketch/render
 * Body: { svg: string }
 * Renders SVG to PNG using sharp, uploads to Supabase Storage, returns public URL.
 */
const renderSketch = async (req, res) => {
    try {
        const { svg } = req.body;
        if (!svg || typeof svg !== 'string') {
            res.status(400).json({ success: false, error: 'SVG string is required in request body' });
            return;
        }
        // Validate SVG looks reasonable (basic check)
        if (!svg.includes('<svg') || !svg.includes('</svg>')) {
            res.status(400).json({ success: false, error: 'Invalid SVG: must contain <svg> tags' });
            return;
        }
        // Dynamic import of sharp (avoids loading native module at startup)
        const sharp = (await Promise.resolve().then(() => __importStar(require('sharp')))).default;
        // Render SVG to PNG
        const pngBuffer = await sharp(Buffer.from(svg))
            .png()
            .toBuffer();
        // Generate unique filename
        const timestamp = Date.now();
        const fileName = `sketch-${timestamp}.png`;
        // Upload to Supabase Storage
        const supabase = getSupabase();
        const { error: uploadError } = await supabase.storage
            .from(BUCKET)
            .upload(fileName, pngBuffer, {
            contentType: 'image/png',
            upsert: true,
        });
        if (uploadError) {
            console.error('Error uploading sketch to Supabase Storage:', uploadError);
            res.status(500).json({ success: false, error: 'Failed to upload sketch: ' + uploadError.message });
            return;
        }
        // Get public URL
        const { data: urlData } = supabase.storage
            .from(BUCKET)
            .getPublicUrl(fileName);
        const publicUrl = urlData.publicUrl;
        console.log(`Sketch rendered and uploaded: ${fileName} (${pngBuffer.length} bytes)`);
        res.status(200).json({
            success: true,
            url: publicUrl,
            fileName: fileName,
            size: pngBuffer.length,
        });
    }
    catch (error) {
        console.error('Sketch render error:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to render sketch' });
    }
};
exports.renderSketch = renderSketch;
