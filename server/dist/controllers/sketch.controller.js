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
        if (!svg.includes('<svg') || !svg.includes('</svg>')) {
            res.status(400).json({ success: false, error: 'Invalid SVG: must contain <svg> tags' });
            return;
        }
        // Try sharp with dynamic import
        let sharpModule;
        try {
            sharpModule = await Promise.resolve().then(() => __importStar(require('sharp')));
        }
        catch (importErr) {
            res.status(500).json({
                success: false,
                error: 'sharp module failed to load: ' + (importErr.message || String(importErr)),
                step: 'import'
            });
            return;
        }
        const sharp = sharpModule.default || sharpModule;
        let pngBuffer;
        try {
            pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
        }
        catch (renderErr) {
            res.status(500).json({
                success: false,
                error: 'sharp render failed: ' + (renderErr.message || String(renderErr)),
                step: 'render'
            });
            return;
        }
        // Upload to Supabase
        const { createClient } = await Promise.resolve().then(() => __importStar(require('@supabase/supabase-js')));
        const supabaseUrl = process.env.SUPABASE_URL || 'https://xzsibbbghotreolzwnyk.supabase.co';
        const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
        if (!supabaseKey) {
            res.status(500).json({
                success: false,
                error: 'SUPABASE_ANON_KEY not set',
                step: 'supabase_init'
            });
            return;
        }
        const supabase = createClient(supabaseUrl, supabaseKey);
        const timestamp = Date.now();
        const fileName = `sketch-${timestamp}.png`;
        const { error: uploadError } = await supabase.storage
            .from('hdsquotes')
            .upload(fileName, pngBuffer, {
            contentType: 'image/png',
            upsert: true,
        });
        if (uploadError) {
            res.status(500).json({
                success: false,
                error: 'Upload failed: ' + uploadError.message,
                step: 'upload'
            });
            return;
        }
        const { data: urlData } = supabase.storage
            .from('hdsquotes')
            .getPublicUrl(fileName);
        res.status(200).json({
            success: true,
            url: urlData.publicUrl,
            fileName: fileName,
            size: pngBuffer.length,
        });
    }
    catch (error) {
        console.error('Sketch render error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to render sketch',
            step: 'unknown'
        });
    }
};
exports.renderSketch = renderSketch;
