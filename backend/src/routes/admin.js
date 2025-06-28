// backend/src/routes/admin.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { getProcessorStats, triggerMessageProcessing } = require('../services/messageProcessor');
const { sendTestEmail } = require('../services/emailService');

const prisma = new PrismaClient();
const router = express.Router();

// Simple admin authentication middleware
const adminAuth = (req, res, next) => {
    const adminKey = req.header('X-Admin-Key');
    if (adminKey !== process.env.ADMIN_SECRET_KEY) {
        return res.status(403).json({ error: 'Admin access denied' });
    }
    next();
};

// Get system stats
router.get('/stats', adminAuth, async (req, res) => {
    try {
        const [
            totalUsers,
            totalMessages,
            scheduledMessages,
            deliveredMessages,
            failedMessages,
            recentUsers,
            recentMessages
        ] = await Promise.all([
            prisma.user.count(),
            prisma.message.count(),
            prisma.message.count({ where: { status: 'SCHEDULED' } }),
            prisma.message.count({ where: { status: 'DELIVERED' } }),
            prisma.message.count({ where: { status: 'FAILED' } }),
            prisma.user.count({
                where: {
                    createdAt: {
                        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
                    }
                }
            }),
            prisma.message.count({
                where: {
                    createdAt: {
                        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
                    }
                }
            })
        ]);

        const processorStats = getProcessorStats();

        res.json({
            users: {
                total: totalUsers,
                recentWeek: recentUsers
            },
            messages: {
                total: totalMessages,
                scheduled: scheduledMessages,
                delivered: deliveredMessages,
                failed: failedMessages,
                recentWeek: recentMessages
            },
            processor: processorStats,
            system: {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                nodeVersion: process.version,
                environment: process.env.NODE_ENV
            }
        });
    } catch (error) {
        console.error('Error getting admin stats:', error);
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

// Get recent activity
router.get('/activity', adminAuth, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        
        const [recentUsers, recentMessages, recentDeliveries] = await Promise.all([
            prisma.user.findMany({
                take: limit,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    createdAt: true,
                    _count: {
                        select: { messages: true }
                    }
                }
            }),
            prisma.message.findMany({
                take: limit,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    deliveryDateTime: true,
                    status: true,
                    createdAt: true,
                    user: {
                        select: { email: true, name: true }
                    }
                }
            }),
            prisma.message.findMany({
                take: limit,
                where: { status: 'DELIVERED' },
                orderBy: { deliveredAt: 'desc' },
                select: {
                    id: true,
                    deliveredAt: true,
                    user: {
                        select: { email: true, name: true }
                    }
                }
            })
        ]);

        res.json({
            recentUsers,
            recentMessages,
            recentDeliveries
        });
    } catch (error) {
        console.error('Error getting admin activity:', error);
        res.status(500).json({ error: 'Failed to get activity' });
    }
});

// Trigger message processing manually
router.post('/process-messages', adminAuth, async (req, res) => {
    try {
        await triggerMessageProcessing();
        res.json({ message: 'Message processing triggered successfully' });
    } catch (error) {
        console.error('Error triggering message processing:', error);
        res.status(500).json({ error: 'Failed to trigger processing' });
    }
});

// Send test email
router.post('/test-email', adminAuth, async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email address required' });
        }

        await sendTestEmail(email);
        res.json({ message: `Test email sent to ${email}` });
    } catch (error) {
        console.error('Error sending test email:', error);
        res.status(500).json({ error: 'Failed to send test email' });
    }
});

// Get failed messages for debugging
router.get('/failed-messages', adminAuth, async (req, res) => {
    try {
        const failedMessages = await prisma.message.findMany({
            where: { status: 'FAILED' },
            orderBy: { createdAt: 'desc' },
            take: 100,
            select: {
                id: true,
                deliveryDateTime: true,
                createdAt: true,
                recipientEmail: true,
                user: {
                    select: { email: true, name: true }
                }
            }
        });

        res.json({ failedMessages });
    } catch (error) {
        console.error('Error getting failed messages:', error);
        res.status(500).json({ error: 'Failed to get failed messages' });
    }
});

// Retry failed message
router.post('/retry-message/:messageId', adminAuth, async (req, res) => {
    try {
        const { messageId } = req.params;
        
        const message = await prisma.message.findUnique({
            where: { id: messageId, status: 'FAILED' }
        });

        if (!message) {
            return res.status(404).json({ error: 'Failed message not found' });
        }

        // Reset to scheduled status
        await prisma.message.update({
            where: { id: messageId },
            data: { status: 'SCHEDULED' }
        });

        res.json({ message: 'Message reset to scheduled status' });
    } catch (error) {
        console.error('Error retrying message:', error);
        res.status(500).json({ error: 'Failed to retry message' });
    }
});

module.exports = router;