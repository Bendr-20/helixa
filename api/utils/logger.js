/**
 * Simple logger utility
 * Replaces raw console.log calls with structured logging
 */
const log = {
    info: (...args) => console.log('[INFO]', ...args),
    error: (...args) => console.error('[ERROR]', ...args),
    debug: (...args) => {} // Silent in production
};

module.exports = log;