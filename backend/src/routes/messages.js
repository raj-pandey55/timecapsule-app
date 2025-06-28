// backend/src/routes/messages.js
const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { encryptText, decryptText } = require('../utils/encryption');
const { validateMessageData } = require('../utils/validation');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const router = express.Router();

// Create new message
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { subject, message, deliveryDateTime, recipientEmail } = req.body;
        const userId = req.user.userId;

        // Validate input data
        const validation = validateMessageData({ subject, message, deliveryDateTime });
        if (!validation.isValid) {
            return res.status(400).json({
                error: 'Validation failed',
                details: validation.errors
            });
        }

        // Get user email if no recipient specified (send to self)
        let finalRecipientEmail = recipientEmail;
        if (!finalRecipientEmail) {
            const user = await prisma.user.findUnique({
                where: { id: userId }
            });
            finalRecipientEmail = user.email;
        }

        // Encrypt sensitive data
        const encryptedSubject = encryptText(subject.trim());
        const encryptedMessage = encryptText(message.trim());

        const newMessage = await prisma.message.create({
            data: {
                userId,
                recipientEmail: finalRecipientEmail,
                encryptedSubject,
                encryptedMessage,
                deliveryDateTime: new Date(deliveryDateTime)
            }
        });

        res.status(201).json({
            id: newMessage.id,
            deliveryDateTime: newMessage.deliveryDateTime,
            status: newMessage.status,
            message: 'Message scheduled successfully'
        });

    } catch (error) {
        console.error('Error creating message:', error);
        res.status(500).json({ error: 'Failed to schedule message' });
    }
});

// Get user's scheduled messages count (no content shown)
router.get('/count', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        
        const [scheduledCount, deliveredCount, failedCount] = await Promise.all([
            prisma.message.count({
                where: { userId, status: 'SCHEDULED' }
            }),
            prisma.message.count({
                where: { userId, status: 'DELIVERED' }
            }),
            prisma.message.count({
                where: { userId, status: 'FAILED' }
            })
        ]);

        res.json({ 
            scheduledCount,
            deliveredCount,
            failedCount,
            totalCount: scheduledCount + deliveredCount + failedCount
        });
    } catch (error) {
        console.error('Error getting message count:', error);
        res.status(500).json({ error: 'Failed to get message count' });
    }
});

// Get user's message timeline (delivery dates only, no content)
router.get('/timeline', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        
        const messages = await prisma.message.findMany({
            where: { userId },
            select: {
                id: true,
                deliveryDateTime: true,
                status: true,
                createdAt: true,
                deliveredAt: true
            },
            orderBy: { deliveryDateTime: 'asc' }
        });

        res.json({ messages });
    } catch (error) {
        console.error('Error getting message timeline:', error);
        res.status(500).json({ error: 'Failed to get message timeline' });
    }
});

// Cancel a scheduled message (only if not yet delivered)
router.delete('/:messageId', authMiddleware, async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user.userId;

        const message = await prisma.message.findFirst({
            where: {
                id: messageId,
                userId,
                status: 'SCHEDULED'
            }
        });

        if (!message) {
            return res.status(404).json({
                error: 'Scheduled message not found or already delivered'
            });
        }

        await prisma.message.delete({
            where: { id: messageId }
        });

        res.json({ message: 'Message cancelled successfully' });

    } catch (error) {
        console.error('Error cancelling message:', error);
        res.status(500).json({ error: 'Failed to cancel message' });
    }
});

// Get user profile with message stats
router.get('/profile', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;

        const [user, messageStats] = await Promise.all([
            prisma.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    avatar: true,
                    createdAt: true
                }
            }),
            prisma.message.groupBy({
                by: ['status'],
                where: { userId },
                _count: { status: true }
            })
        ]);

        const stats = messageStats.reduce((acc, stat) => {
            acc[stat.status.toLowerCase()] = stat._count.status;
            return acc;
        }, { scheduled: 0, delivered: 0, failed: 0 });

        res.json({
            user,
            stats
        });

    } catch (error) {
        console.error('Error getting profile:', error);
        res.status(500).json({ error: 'Failed to get profile' });
    }
});

module.exports = router;