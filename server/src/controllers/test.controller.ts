import { Request, Response } from 'express';

// Test endpoint to verify query parameter extraction
export const testQueryParams = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('Test query parameters:', req.query);
    console.log('Test request body:', req.body);
    console.log('Test request method:', req.method);
    
    const { quoteId } = req.query;
    
    res.json({
      message: 'Query parameter test',
      quoteId: quoteId || 'Not provided',
      allQueryParams: req.query
    });
  } catch (error) {
    console.error('Error in test endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
