// backend/src/services/messageProcessor.js
const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { decryptText } = require('../utils/encryption');
const { sendFutureMessage } = require('./emailService');

const prisma = new PrismaClient();

// Track processor state
let isProcessing = false;
let processCount = 0;
let lastProcessTime = null;

async function processScheduledMessages() {
    if (isProcessing) {
        console.log('⏳ Message processor already running, skipping...');
        return;
    }

    isProcessing = true;
    const startTime = new Date();
    
    try {
        console.log(`🔄 [${startTime.toISOString()}] Checking for messages to deliver...`);
        
        // Find messages that are due for delivery
        const dueMessages = await prisma.message.findMany({
            where: {
                status: 'SCHEDULED',
                deliveryDateTime: {
                    lte: new Date()
                }
            },
            include: {
                user: {
                    select: {
                        email: true,
                        name: true
                    }
                }
            },
            orderBy: {
                deliveryDateTime: 'asc'
            }
        });

        console.log(`📬 Found ${dueMessages.length} messages to deliver`);

        if (dueMessages.length === 0) {
            return;
        }

        let successCount = 0;
        let failureCount = 0;

        // Process each message
        for (const message of dueMessages) {
            try {
                console.log(`📤 Processing message ${message.id} for ${message.recipientEmail}`);

                // Decrypt message content
                const subject = decryptText(message.encryptedSubject);
                const messageContent = decryptText(message.encryptedMessage);

                // Send email
                await sendFutureMessage(
                    message.recipientEmail,
                    subject,
                    messageContent,
                    message.user.name
                );

                // Update status to delivered
                await prisma.message.update({
                    where: { id: message.id },
                    data: {
                        status: 'DELIVERED',
                        deliveredAt: new Date()
                    }
                });

                successCount++;
                console.log(`✅ Successfully delivered message ${message.id}`);

                // Add small delay between emails to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));

            } catch (error) {
                failureCount++;
                console.error(`❌ Failed to deliver message ${message.id}:`, error.message);
                
                // Update status to failed
                try {
                    await prisma.message.update({
                        where: { id: message.id },
                        data: { 
                            status: 'FAILED'
                        }
                    });
                } catch (updateError) {
                    console.error(`Failed to update message status for ${message.id}:`, updateError.message);
                }
            }
        }

        const endTime = new Date();
        const duration = endTime - startTime;
        
        console.log(`🎯 Processing complete: ${successCount} delivered, ${failureCount} failed (${duration}ms)`);
        
        processCount++;
        lastProcessTime = endTime;

    } catch (error) {
        console.error('💥 Critical error in message processor:', error);
    } finally {
        isProcessing = false;
    }
}

function startMessageProcessor() {
    console.log('⏰ Starting message processor...');
    
    // Run every minute
    const cronJob = cron.schedule('* * * * *', async () => {
        await processScheduledMessages();
    }, {
        scheduled: false,
        timezone: 'UTC'
    });

    // Start the cron job
    cronJob.start();

    // Also run once immediately on startup
    setTimeout(processScheduledMessages, 5000);

    console.log('✅ Message processor started (runs every minute)');
    
    return cronJob;
}

function stopMessageProcessor(cronJob) {
    if (cronJob) {
        cronJob.stop();
        console.log('🛑 Message processor stopped');
    }
}

// Get processor stats
function getProcessorStats() {
    return {
        isProcessing,
        processCount,
        lastProcessTime,
        uptime: process.uptime()
    };
}

// Manual trigger for testing
async function triggerMessageProcessing() {
    console.log('🔧 Manually triggering message processing...');
    await processScheduledMessages();
}

module.exports = { 
    startMessageProcessor, 
    stopMessageProcessor,
    getProcessorStats,
    triggerMessageProcessing
};