import { Request, Response } from 'express';

/**
 * POST /api/sketch/render
 * Body: { svg: string }
 * Renders SVG to PNG using sharp, uploads to Supabase Storage, returns public URL.
 */
export const renderSketch = async (req: Request, res: Response): Promise<void> => {
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
    let sharpModule: any;
    try {
      sharpModule = await import('sharp');
    } catch (importErr: any) {
      res.status(500).json({ 
        success: false, 
        error: 'sharp module failed to load: ' + (importErr.message || String(importErr)),
        step: 'import'
      });
      return;
    }

    const sharp = sharpModule.default || sharpModule;

    let pngBuffer: Buffer;
    try {
      pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
    } catch (renderErr: any) {
      res.status(500).json({ 
        success: false, 
        error: 'sharp render failed: ' + (renderErr.message || String(renderErr)),
        step: 'render'
      });
      return;
    }

    // Upload to Supabase
    const { createClient } = await import('@supabase/supabase-js');
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
  } catch (error: any) {
    console.error('Sketch render error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to render sketch',
      step: 'unknown'
    });
  }
};
