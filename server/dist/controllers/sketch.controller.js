"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderSketch = void 0;
const sharp_1 = __importDefault(require("sharp"));
const supabase_js_1 = require("@supabase/supabase-js");
// Initialize Supabase client for storage uploads
const supabaseUrl = process.env.SUPABASE_URL || 'https://xzsibbbghotreolzwnyk.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
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
        // Render SVG to PNG using sharp
        const pngBuffer = await (0, sharp_1.default)(Buffer.from(svg))
            .png()
            .toBuffer();
        // Generate unique filename
        const timestamp = Date.now();
        const fileName = `sketch-${timestamp}.png`;
        // Upload to Supabase Storage (hdsquotes bucket - already public)
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
