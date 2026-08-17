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
const path_1 = require("path");
/**
 * POST /api/sketch/render
 * Body: { svg: string }
 * Renders SVG to PNG using @resvg/resvg-js (WASM-based, Vercel-safe),
 * uploads to Supabase Storage, returns public URL.
 *
 * Fonts: DejaVu Sans (regular + bold) are bundled in src/fonts/ and loaded
 * explicitly because Vercel serverless functions have no system fonts.
 * Without this, all <text> elements in the SVG are silently dropped.
 */
let cachedFontsDir = null;
function getFontsDir() {
    if (cachedFontsDir)
        return cachedFontsDir;
    // In compiled dist/, __dirname is dist/controllers, fonts are in dist/fonts
    // In Vercel serverless, the path is resolved from the function bundle
    cachedFontsDir = (0, path_1.join)(__dirname, '..', 'fonts');
    return cachedFontsDir;
}
const renderSketch = async (req, res) => {
    var _a;
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
        // Sanitize SVG: escape raw & that aren't part of an entity (e.g. "HDS Cut & Edge")
        // resvg uses strict XML parsing, unlike sharp which was lenient.
        const sanitizedSvg = svg.replace(/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;');
        // Replace Arial/Helvetica/sans-serif font-family references with DejaVu Sans
        // since that's the font we bundle for Vercel serverless rendering.
        // Handles both style="font-family: 'Arial', 'Helvetica', sans-serif;" and
        // font-family="Arial" attribute syntax.
        const fontFixedSvg = sanitizedSvg
            .replace(/style="font-family:\s*'Arial',\s*'Helvetica',\s*sans-serif;"/gi, 'style="font-family: DejaVu Sans;"')
            .replace(/font-family:\s*'Arial'/gi, 'font-family: DejaVu Sans')
            .replace(/font-family:\s*"Arial"/gi, 'font-family: DejaVu Sans')
            .replace(/font-family:\s*'Helvetica'/gi, 'font-family: DejaVu Sans')
            .replace(/font-family:\s*"Helvetica"/gi, 'font-family: DejaVu Sans')
            .replace(/font-family:\s*sans-serif/gi, 'font-family: DejaVu Sans')
            .replace(/font-family="Arial"/gi, 'font-family="DejaVu Sans"')
            .replace(/font-family="Helvetica"/gi, 'font-family="DejaVu Sans"');
        // resvg-js is a pure-Rust/WASM SVG renderer with no native binaries,
        // so it works reliably in Vercel serverless functions (unlike sharp).
        let Resvg;
        try {
            const resvgModule = await Promise.resolve().then(() => __importStar(require('@resvg/resvg-js')));
            Resvg = resvgModule.Resvg || ((_a = resvgModule.default) === null || _a === void 0 ? void 0 : _a.Resvg) || resvgModule.default;
        }
        catch (importErr) {
            res.status(500).json({
                success: false,
                error: 'resvg module failed to load: ' + (importErr.message || String(importErr)),
                step: 'import',
            });
            return;
        }
        // Load bundled fonts (DejaVu Sans) — Vercel has no system fonts.
        // fontDirs with absolute paths works reliably in serverless environments.
        const fontsDir = getFontsDir();
        let pngBuffer;
        try {
            const renderer = new Resvg(fontFixedSvg, {
                fitTo: { mode: 'width', value: 2000 },
                background: 'white',
                font: {
                    fontDirs: [fontsDir],
                    loadSystemFonts: false,
                    defaultFontFamily: 'DejaVu Sans',
                },
            });
            const rendered = renderer.render();
            pngBuffer = rendered.asPng();
        }
        catch (renderErr) {
            res.status(500).json({
                success: false,
                error: 'resvg render failed: ' + (renderErr.message || String(renderErr)),
                step: 'render',
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
                step: 'supabase_init',
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
                step: 'upload',
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
            step: 'unknown',
        });
    }
};
exports.renderSketch = renderSketch;
