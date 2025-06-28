// backend/src/utils/validation.js
const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

const validateMessageData = (data) => {
    const errors = [];

    if (!data.subject || data.subject.trim().length === 0) {
        errors.push('Subject is required');
    }

    if (data.subject && data.subject.length > 200) {
        errors.push('Subject must be less than 200 characters');
    }

    if (!data.message || data.message.trim().length === 0) {
        errors.push('Message content is required');
    }

    if (data.message && data.message.length > 10000) {
        errors.push('Message must be less than 10,000 characters');
    }

    if (!data.deliveryDateTime) {
        errors.push('Delivery date and time is required');
    }

    const deliveryDate = new Date(data.deliveryDateTime);
    if (isNaN(deliveryDate.getTime())) {
        errors.push('Invalid delivery date format');
    }

    if (deliveryDate <= new Date()) {
        errors.push('Delivery date must be in the future');
    }

    // Can't schedule more than 50 years in the future
    const fiftyYearsFromNow = new Date();
    fiftyYearsFromNow.setFullYear(fiftyYearsFromNow.getFullYear() + 50);
    if (deliveryDate > fiftyYearsFromNow) {
        errors.push('Delivery date cannot be more than 50 years in the future');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};

const validateTimeZone = (timeZone) => {
    try {
        Intl.DateTimeFormat(undefined, { timeZone });
        return true;
    } catch (error) {
        return false;
    }
};

module.exports = {
    validateEmail,
    validateMessageData,
    validateTimeZone
};