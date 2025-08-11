import { Request, Response } from 'express';

export const notFoundHandler = (req: Request, res: Response): void => {
    res.status(404).json({
        error: {
            message: `Route ${req.method} ${req.path} not found`,
            statusCode: 404,
            timestamp: new Date().toISOString(),
            availableRoutes: [
                'GET /',
                'GET /health',
                'GET /api/v1/auth/*',
                'GET /api/v1/users/*',
                'GET /api/v1/spots/*',
                'GET /api/v1/trips/*',
            ],
        },
    });
};