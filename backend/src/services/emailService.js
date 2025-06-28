// backend/src/services/emailService.js
const sgMail = require('@sendgrid/mail');
const { format } = require('date-fns');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendFutureMessage(recipientEmail, subject, message, userName = 'Future You') {
    try {
        console.log(`📧 Sending email to ${recipientEmail} with subject: ${subject}`);

        const emailHTML = generateEmailHTML(subject, message, userName);
        const emailText = generateEmailText(subject, message, userName);

        const msg = {
            to: recipientEmail,
            from: {
                email: process.env.FROM_EMAIL,
                name: process.env.FROM_NAME
            },
            subject: `📧 ${subject}`,
            text: emailText,
            html: emailHTML,
            // Add tracking and analytics
            trackingSettings: {
                clickTracking: {
                    enable: false
                },
                openTracking: {
                    enable: false
                }
            },
            // Custom headers
            headers: {
                'X-Message-Source': 'FutureMe-Scheduler',
                'X-Priority': '3'
            }
        };

        const result = await sgMail.send(msg);
        console.log(`✅ Email sent successfully to ${recipientEmail}`);
        return result;

    } catch (error) {
        console.error(`❌ Failed to send email to ${recipientEmail}:`, error);
        
        // Log specific SendGrid errors
        if (error.response) {
            console.error('SendGrid error details:', {
                status: error.response.status,
                body: error.response.body
            });
        }
        
        throw error;
    }
}

function generateEmailHTML(subject, message, userName) {
    const currentDate = format(new Date(), 'MMMM dd, yyyy');
    
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Message from Your Past Self</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                line-height: 1.6;
                color: #333;
                background-color: #f5f5f5;
            }
            .container {
                max-width: 600px;
                margin: 20px auto;
                background: white;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 4px 25px rgba(0, 0, 0, 0.1);
            }
            .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 40px 30px;
                text-align: center;
            }
            .header h1 {
                font-size: 28px;
                margin-bottom: 10px;
                font-weight: 600;
            }
            .header p {
                font-size: 16px;
                opacity: 0.9;
            }
            .content {
                padding: 40px 30px;
            }
            .message-meta {
                background: #f8f9ff;
                border-left: 4px solid #667eea;
                padding: 15px 20px;
                margin-bottom: 30px;
                border-radius: 0 8px 8px 0;
            }
            .message-meta strong {
                color: #667eea;
            }
            .message-body {
                background: #fafafa;
                padding: 25px;
                border-radius: 8px;
                margin: 25px 0;
                border: 1px solid #e1e5e9;
                white-space: pre-wrap;
                font-size: 16px;
                line-height: 1.7;
            }
            .footer {
                background: #f8f9fa;
                padding: 25px 30px;
                text-align: center;
                font-size: 14px;
                color: #666;
                border-top: 1px solid #e1e5e9;
            }
            .footer a {
                color: #667eea;
                text-decoration: none;
            }
            .emoji {
                font-size: 24px;
                margin-bottom: 10px;
                display: block;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <span class="emoji">📧</span>
                <h1>Message from Your Past Self</h1>
                <p>You scheduled this message to arrive today!</p>
            </div>
            
            <div class="content">
                <div class="message-meta">
                    <strong>From:</strong> ${userName}<br>
                    <strong>Delivered:</strong> ${currentDate}
                </div>
                
                <h2 style="color: #333; margin-bottom: 20px; font-size: 22px;">${subject}</h2>
                
                <div class="message-body">${message.replace(/\n/g, '<br>')}</div>
            </div>
            
            <div class="footer">
                <p>
                    This message was scheduled and delivered by 
                    <a href="https://futureme.app">FutureMe</a>
                </p>
                <p style="margin-top: 10px; font-size: 12px;">
                    ⏰ Schedule your next message to the future
                </p>
            </div>
        </div>
    </body>
    </html>
    `;
}

function generateEmailText(subject, message, userName) {
    const currentDate = format(new Date(), 'MMMM dd, yyyy');
    
    return `
📧 MESSAGE FROM YOUR PAST SELF

From: ${userName}
Delivered: ${currentDate}

Subject: ${subject}

${message}

---
This message was scheduled and delivered by FutureMe
Visit https://futureme.app to schedule your next message to the future
    `.trim();
}

// Test email function for development
async function sendTestEmail(recipientEmail) {
    try {
        return await sendFutureMessage(
            recipientEmail,
            'Test Message from FutureMe',
            'This is a test message to verify email delivery is working correctly.\n\nIf you received this, everything is set up properly!',
            'Test User'
        );
    } catch (error) {
        console.error('Test email failed:', error);
        throw error;
    }
}

// Send welcome email when user signs up
async function sendWelcomeEmail(recipientEmail, userName) {
    try {
        const welcomeMessage = `Welcome to FutureMe, ${userName}!

You've just joined thousands of people who are connecting with their future selves.

Here's how it works:
• Write a message to yourself
• Choose when you want to receive it (days, months, or years from now)  
• We'll deliver it right to your inbox at the perfect time

Your first message could be:
• A reminder of your current goals and dreams
• Advice for your future self
• A snapshot of what your life is like right now
• Encouragement for challenges you know you'll face

Start your first message at https://futureme.app

Welcome to the journey of self-discovery through time!`;

        return await sendFutureMessage(
            recipientEmail,
            'Welcome to FutureMe! 🎉',
            welcomeMessage,
            'The FutureMe Team'
        );
    } catch (error) {
        console.error('Welcome email failed:', error);
        // Don't throw error for welcome email - it's not critical
    }
}

module.exports = { 
    sendFutureMessage, 
    sendTestEmail,
    sendWelcomeEmail
};