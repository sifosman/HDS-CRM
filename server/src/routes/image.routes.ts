import express, { Router, RequestHandler } from 'express';
import * as imageController from '../controllers/image.controller';

const router: Router = express.Router();

// GET pad an image to 1.91:1 (or custom) aspect ratio with white background
router.get('/pad', imageController.padImage as RequestHandler);

export default router;
