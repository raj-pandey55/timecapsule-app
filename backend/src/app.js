// backend/src/app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const passport = require('passport');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const messageRoutes = require('./routes/messages');
const adminRoutes = require('./routes/admin');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();

// Security middleware
app.use(helmet({
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
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? process.env.FRONTEND_URL 
        : ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize Passport
app.use(passport.initialize());

// API Routes
app.use('/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/admin', adminRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        version: process.env.npm_package_version || '1.0.0'
    });
});

// API info endpoint
app.get('/api', (req, res) => {
    res.json({
        name: 'FutureMe API',
        version: '1.0.0',
        description: 'Send messages to your future self',
        endpoints: {
            auth: '/auth/google',
            messages: '/api/messages',
            health: '/health'
        }
    });
});

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

module.exports = app;