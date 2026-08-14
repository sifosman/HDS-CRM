import express, { Router, RequestHandler } from 'express';
import * as sketchController from '../controllers/sketch.controller';

const router: Router = express.Router();

// POST render SVG to PNG and upload to Supabase Storage
router.post('/render', sketchController.renderSketch as RequestHandler);

// GET test endpoint
router.get('/test', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Sketch render endpoint is working!',
    timestamp: new Date().toISOString()
  });
});

export default router;
