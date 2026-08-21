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
exports.padImage = void 0;
/**
 * GET /api/image/pad?url=<image_url>&w=1125&h=600&bg=white&quality=80
 *
 * Downloads an image from the given URL, pads it to the target aspect ratio
 * (default 1.91:1 = 1125x600) with a white background, and returns the
 * processed JPEG. This prevents WhatsApp carousel from cropping the image
 * edges/corners where branding is typically placed.
 *
 * The response is cached for 30 days (Cache-Control: public, max-age=2592000)
 * so subsequent requests are served from Vercel's CDN.
 */
const padImage = async (req, res) => {
    try {
        const { url } = req.query;
        if (!url || typeof url !== 'string') {
            res.status(400).json({ success: false, error: 'Missing "url" query parameter' });
            return;
        }
        // Target dimensions (default: 1125x600 = 1.91:1, WhatsApp carousel landscape)
        const targetWidth = parseInt(req.query.w, 10) || 1125;
        const targetHeight = parseInt(req.query.h, 10) || 600;
        const background = req.query.bg || 'white';
        const quality = parseInt(req.query.quality, 10) || 80;
        // Validate URL to prevent SSRF — only allow Supabase Storage and HDS website
        const allowedHosts = [
            'xzsibbbghotreolzwnyk.supabase.co',
            'hdsgroup.co.za',
        ];
        let parsedUrl;
        try {
            parsedUrl = new URL(url);
        }
        catch (_a) {
            res.status(400).json({ success: false, error: 'Invalid URL' });
            return;
        }
        if (!allowedHosts.some(h => parsedUrl.hostname === h || parsedUrl.hostname.endsWith('.' + h))) {
            res.status(403).json({ success: false, error: 'URL host not allowed' });
            return;
        }
        // Download the original image
        const imageRes = await fetch(url);
        if (!imageRes.ok) {
            // Any non-200 upstream response means the image is not available
            // (404 not found, 400 bad request, 403 forbidden, etc.). Return 404 so
            // callers can distinguish "image missing" from a genuine server error.
            res.status(404).json({ success: false, error: `Failed to fetch image: ${imageRes.status}` });
            return;
        }
        const imageBuffer = Buffer.from(await imageRes.arrayBuffer());
        // Process with sharp
        const sharp = (await Promise.resolve().then(() => __importStar(require('sharp')))).default;
        // Get original image metadata
        const metadata = await sharp(imageBuffer).metadata();
        const origWidth = metadata.width || 0;
        const origHeight = metadata.height || 0;
        if (origWidth === 0 || origHeight === 0) {
            res.status(400).json({ success: false, error: 'Could not read image dimensions' });
            return;
        }
        // Calculate the fit dimensions (contain within target, preserve aspect ratio)
        const targetRatio = targetWidth / targetHeight;
        const origRatio = origWidth / origHeight;
        let fitWidth;
        let fitHeight;
        if (origRatio > targetRatio) {
            // Original is wider than target — fit to width
            fitWidth = targetWidth;
            fitHeight = Math.round(targetWidth / origRatio);
        }
        else {
            // Original is taller than (or same as) target — fit to height
            fitHeight = targetHeight;
            fitWidth = Math.round(targetHeight * origRatio);
        }
        // Resize the original image to fit within the target, then extend the canvas
        // to the full target size with the specified background color.
        const processedBuffer = await sharp(imageBuffer)
            .resize(fitWidth, fitHeight, {
            fit: 'contain',
            background: background,
        })
            .extend({
            top: Math.floor((targetHeight - fitHeight) / 2),
            bottom: Math.ceil((targetHeight - fitHeight) / 2),
            left: Math.floor((targetWidth - fitWidth) / 2),
            right: Math.ceil((targetWidth - fitWidth) / 2),
            background: background,
        })
            .jpeg({ quality, progressive: true })
            .toBuffer();
        // Set caching headers — 30 days
        res.set('Content-Type', 'image/jpeg');
        res.set('Cache-Control', 'public, max-age=2592000, s-maxage=2592000');
        res.set('Access-Control-Allow-Origin', '*');
        res.status(200).send(processedBuffer);
    }
    catch (error) {
        console.error('Image pad error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to process image',
        });
    }
};
exports.padImage = padImage;
