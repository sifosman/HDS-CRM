import { Router } from 'express';
import { testQueryParams } from '../controllers/test.controller';

const router = Router();

// Test endpoint to verify query parameter extraction
router.get('/test-query', testQueryParams);

export default router;
