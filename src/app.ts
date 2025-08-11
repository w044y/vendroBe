import 'reflect-metadata';
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { initializeDatabase } from './config/database';

// Import routes (we'll create these next)
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import spotRoutes from './routes/spots';
import tripRoutes from './routes/trips';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';

class App {
    public app: express.Application;
    private readonly port: number;

    constructor() {
        this.app = express();
        this.port = parseInt(process.env.PORT || '3000');

        this.initializeMiddleware();
        this.initializeRoutes();
        this.initializeErrorHandling();
    }

    private initializeMiddleware(): void {
        // Security middleware
        this.app.use(helmet({
            crossOriginResourcePolicy: { policy: 'cross-origin' },
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrc: ["'self'"],
                    imgSrc: ["'self'", "data:", "https:"],
                },
            },
        }));

        // CORS configuration
        this.app.use(cors({
            origin: [
                process.env.FRONTEND_URL || 'http://localhost:3000',
                'exp://192.168.1.100:8081', // Expo development
                /^https:\/\/.*\.exp\.direct$/, // Expo tunnels
                /^https:\/\/.*\.ngrok\.io$/, // ngrok tunnels
            ],
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        }));

        // Rate limiting
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // Limit each IP to 100 requests per windowMs
            message: {
                error: 'Too many requests from this IP, please try again later.',
            },
            standardHeaders: true,
            legacyHeaders: false,
        });
        this.app.use(limiter);

        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Request logging in development
        if (process.env.NODE_ENV === 'development') {
            this.app.use((req, res, next) => {
                console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
                next();
            });
        }
    }

    private initializeRoutes(): void {
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.status(200).json({
                status: 'OK',
                timestamp: new Date().toISOString(),
                service: 'HitchHub API',
                version: '1.0.0',
                environment: process.env.NODE_ENV || 'development',
            });
        });

        // API routes with versioning
        const apiV1 = '/api/v1';
        this.app.use(`${apiV1}/auth`, authRoutes);
        this.app.use(`${apiV1}/users`, userRoutes);
        this.app.use(`${apiV1}/spots`, spotRoutes);
        this.app.use(`${apiV1}/trips`, tripRoutes);

        // Root endpoint
        this.app.get('/', (req, res) => {
            res.json({
                message: 'Welcome to Vendro API',
                version: '1.0.0',
                documentation: '/api/v1/docs',
                health: '/health',
            });
        });
    }

    private initializeErrorHandling(): void {
        // 404 handler (must come before error handler)
        this.app.use(notFoundHandler);

        // Global error handler (must come last)
        this.app.use(errorHandler);
    }

    public async start(): Promise<void> {
        try {
            // Initialize database connection
            await initializeDatabase();

            // Start server
            this.app.listen(this.port, () => {
                console.log(`
🚀 Vendro API Server Started!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📡 Server: http://localhost:${this.port}
🏥 Health: http://localhost:${this.port}/health
📚 API: http://localhost:${this.port}/api/v1
🌍 Environment: ${process.env.NODE_ENV || 'development'}
🗄️ Database: Connected ✅
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        `);
            });
        } catch (error) {
            console.error('❌ Failed to start server:', error);
            process.exit(1);
        }
    }
}

// Create and start the app
const app = new App();
app.start().catch((error) => {
    console.error('❌ Application startup failed:', error);
    process.exit(1);
});

export default app;