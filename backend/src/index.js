require('dotenv').config();
const app = require('./app');
const { PrismaClient } = require('@prisma/client');
const { startMessageProcessor } = require('./services/messageProcessor');

const prisma = new PrismaClient();

async function startServer() {
    try {
        // Test database connection
        await prisma.$connect();
        console.log('✅ Database connected successfully');

        // Start the message processor
        startMessageProcessor();

        // Start the server
        const PORT = process.env.PORT || 3001;
        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📧 FutureMe API ready at http://localhost:${PORT}`);
        });

    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🛑 SIGTERM received, shutting down gracefully...');
    await prisma.$disconnect();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('🛑 SIGINT received, shutting down gracefully...');
    await prisma.$disconnect();
    process.exit(0);
});

startServer();