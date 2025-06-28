const CryptoJS = require('crypto-js');

const ENCRYPTION_KEY = process.env.APP_ENCRYPTION_KEY;

function encryptText(text) {
    return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
}

function decryptText(encryptedText) {
    const bytes = CryptoJS.AES.decrypt(encryptedText, ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
}

module.exports = { encryptText, decryptText };