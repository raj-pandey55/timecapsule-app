// backend/src/routes/auth.js
const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { authMiddleware } = require('../middleware/auth');

const prisma = new PrismaClient();
const router = express.Router();

// Configure Google Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
}, async (accessToken, refreshToken, profile, done) => {
    try {
        console.log('Google OAuth callback received for:', profile.emails[0].value);
        
        let user = await prisma.user.findUnique({
            where: { googleId: profile.id }
        });

        if (!user) {
            // Check if user exists with same email but different Google ID
            const existingUser = await prisma.user.findUnique({
                where: { email: profile.emails[0].value }
            });

            if (existingUser) {
                // Update existing user with Google ID
                user = await prisma.user.update({
                    where: { email: profile.emails[0].value },
                    data: {
                        googleId: profile.id,
                        name: profile.displayName,
                        avatar: profile.photos[0]?.value
                    }
                });
            } else {
                // Create new user
                user = await prisma.user.create({
                    data: {
                        googleId: profile.id,
                        email: profile.emails[0].value,
                        name: profile.displayName,
                        avatar: profile.photos[0]?.value
                    }
                });
            }
            console.log('Created new user:', user.email);
        } else {
            // Update existing user info
            user = await prisma.user.update({
                where: { googleId: profile.id },
                data: {
                    name: profile.displayName,
                    avatar: profile.photos[0]?.value
                }
            });
            console.log('Updated existing user:', user.email);
        }

        return done(null, user);
    } catch (error) {
        console.error('Error in Google OAuth strategy:', error);
        return done(error, null);
    }
}));

// Serialize/deserialize user (required by Passport)
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await prisma.user.findUnique({ where: { id } });
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

// Routes
router.get('/google', (req, res, next) => {
    console.log('Initiating Google OAuth...');
    passport.authenticate('google', {
        scope: ['profile', 'email'],
        accessType: 'offline',
        prompt: 'consent'
    })(req, res, next);
});

router.get('/google/callback', 
    passport.authenticate('google', { 
        session: false,
        failureRedirect: `${process.env.FRONTEND_URL}/login?error=auth_failed`
    }),
    (req, res) => {
        try {
            console.log('Google OAuth successful for:', req.user.email);
            
            const token = jwt.sign(
                { 
                    userId: req.user.id,
                    email: req.user.email
                },
                process.env.JWT_SECRET,
                { expiresIn: '7d' }
            );

            // Redirect to frontend with token
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            res.redirect(`${frontendUrl}/auth/success?token=${token}`);
            
        } catch (error) {
            console.error('Error in auth callback:', error);
            res.redirect(`${process.env.FRONTEND_URL}/login?error=token_generation_failed`);
        }
    }
);

// Get current user info
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.userId },
            select: {
                id: true,
                email: true,
                name: true,
                avatar: true,
                createdAt: true
            }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ user });
    } catch (error) {
        console.error('Error getting user profile:', error);
        res.status(500).json({ error: 'Failed to get user profile' });
    }
});

// Logout (invalidate token - client-side)
router.post('/logout', authMiddleware, (req, res) => {
    res.json({ message: 'Logged out successfully' });
});

// Refresh token
router.post('/refresh', authMiddleware, (req, res) => {
    try {
        const newToken = jwt.sign(
            { 
                userId: req.user.userId,
                email: req.user.email
            },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({ token: newToken });
    } catch (error) {
        console.error('Error refreshing token:', error);
        res.status(500).json({ error: 'Failed to refresh token' });
    }
});

// Delete account
router.delete('/account', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        
        // Delete all user's messages first (due to foreign key constraint)
        await prisma.message.deleteMany({
            where: { userId }
        });

        // Delete user account
        await prisma.user.delete({
            where: { id: userId }
        });

        res.json({ message: 'Account deleted successfully' });
    } catch (error) {
        console.error('Error deleting account:', error);
        res.status(500).json({ error: 'Failed to delete account' });
    }
});

module.exports = router;