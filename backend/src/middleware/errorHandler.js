// backend/src/middleware/errorHandler.js
const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    // Prisma specific errors
    if (err.code === 'P2002') {
        return res.status(409).json({
            error: 'A record with this information already exists'
        });
    }

    if (err.code === 'P2025') {
        return res.status(404).json({
            error: 'Record not found'
        });
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            error: 'Invalid token'
        });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            error: 'Token expired'
        });
    }

    // Validation errors
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Validation failed',
            details: err.message
        });
    }

    // Default error
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};

const notFound = (req, res, next) => {
    const error = new Error(`Not found - ${req.originalUrl}`);
    error.status = 404;
    next(error);
};

module.exports = { errorHandler, notFound };