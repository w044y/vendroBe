import { Request, Response, NextFunction } from 'express';

export interface ApiError extends Error {
    statusCode?: number;
    isOperational?: boolean;
}

export const errorHandler = (
    err: ApiError,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    const statusCode = err.statusCode || 500;
    const isProduction = process.env.NODE_ENV === 'production';

    console.error('❌ Error:', {
        message: err.message,
        statusCode,
        stack: err.stack,
        url: req.url,
        method: req.method,
        timestamp: new Date().toISOString(),
    });

    res.status(statusCode).json({
        error: {
            message: isProduction && statusCode === 500
                ? 'Internal server error'
                : err.message,
            statusCode,
            timestamp: new Date().toISOString(),
            path: req.path,
            ...(isProduction ? {} : { stack: err.stack }),
        },
    });
};

export const createError = (message: string, statusCode: number = 500): ApiError => {
    const error: ApiError = new Error(message);
    error.statusCode = statusCode;
    error.isOperational = true;
    return error;
};