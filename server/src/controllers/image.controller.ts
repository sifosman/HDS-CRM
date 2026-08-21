import { Request, Response } from 'express';

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
export const padImage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
      res.status(400).json({ success: false, error: 'Missing "url" query parameter' });
      return;
    }

    // Target dimensions (default: 1125x600 = 1.91:1, WhatsApp carousel landscape)
    const targetWidth = parseInt(req.query.w as string, 10) || 1125;
    const targetHeight = parseInt(req.query.h as string, 10) || 600;
    const background = (req.query.bg as string) || 'white';
    const quality = parseInt(req.query.quality as string, 10) || 80;

    // Validate URL to prevent SSRF — only allow Supabase Storage and HDS website
    const allowedHosts = [
      'xzsibbbghotreolzwnyk.supabase.co',
      'hdsgroup.co.za',
    ];
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
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
      // Return 404 for not-found images (so callers can distinguish missing
      // images from server errors); 502 for other upstream failures.
      const status = imageRes.status === 404 ? 404 : 502;
      res.status(status).json({ success: false, error: `Failed to fetch image: ${imageRes.status}` });
      return;
    }

    const imageBuffer = Buffer.from(await imageRes.arrayBuffer());

    // Process with sharp
    const sharp = (await import('sharp')).default;

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

    let fitWidth: number;
    let fitHeight: number;

    if (origRatio > targetRatio) {
      // Original is wider than target — fit to width
      fitWidth = targetWidth;
      fitHeight = Math.round(targetWidth / origRatio);
    } else {
      // Original is taller than (or same as) target — fit to height
      fitHeight = targetHeight;
      fitWidth = Math.round(targetHeight * origRatio);
    }

    // Resize the original image to fit within the target, then extend the canvas
    // to the full target size with the specified background color.
    const processedBuffer = await sharp(imageBuffer)
      .resize(fitWidth, fitHeight, {
        fit: 'contain',
        background: background as any,
      })
      .extend({
        top: Math.floor((targetHeight - fitHeight) / 2),
        bottom: Math.ceil((targetHeight - fitHeight) / 2),
        left: Math.floor((targetWidth - fitWidth) / 2),
        right: Math.ceil((targetWidth - fitWidth) / 2),
        background: background as any,
      })
      .jpeg({ quality, progressive: true })
      .toBuffer();

    // Set caching headers — 30 days
    res.set('Content-Type', 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=2592000, s-maxage=2592000');
    res.set('Access-Control-Allow-Origin', '*');
    res.status(200).send(processedBuffer);
  } catch (error: any) {
    console.error('Image pad error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process image',
    });
  }
};
