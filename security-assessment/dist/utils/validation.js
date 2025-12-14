"use strict";
/**
 * Validation utilities for configuration and input validation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateSecurityConfiguration = validateSecurityConfiguration;
exports.validateAnalysisConfiguration = validateAnalysisConfiguration;
exports.isValidContainerId = isValidContainerId;
exports.sanitizePath = sanitizePath;
function validateSecurityConfiguration(config) {
    const errors = [];
    if (!config.resourceLimits) {
        errors.push('Resource limits are required');
    }
    else {
        if (!config.resourceLimits.cpu) {
            errors.push('CPU limit is required');
        }
        if (!config.resourceLimits.memory) {
            errors.push('Memory limit is required');
        }
        if (!config.resourceLimits.diskSpace) {
            errors.push('Disk space limit is required');
        }
    }
    if (!config.filesystemAccess) {
        errors.push('Filesystem access configuration is required');
    }
    if (typeof config.networkIsolation !== 'boolean') {
        errors.push('Network isolation must be a boolean value');
    }
    return errors;
}
function validateAnalysisConfiguration(config) {
    const errors = [];
    const validCodebaseTypes = ['nodejs', 'solidity', 'mixed'];
    if (!validCodebaseTypes.includes(config.codebaseType)) {
        errors.push(`Invalid codebase type. Must be one of: ${validCodebaseTypes.join(', ')}`);
    }
    if (!Array.isArray(config.analysisTools)) {
        errors.push('Analysis tools must be an array');
    }
    if (!Array.isArray(config.testFrameworks)) {
        errors.push('Test frameworks must be an array');
    }
    if (!Array.isArray(config.reportFormats)) {
        errors.push('Report formats must be an array');
    }
    return errors;
}
function isValidContainerId(containerId) {
    // Container ID should be alphanumeric with hyphens, reasonable length
    const containerIdRegex = /^[a-zA-Z0-9-_]+$/;
    return containerIdRegex.test(containerId) && containerId.length >= 5 && containerId.length <= 100;
}
function sanitizePath(path) {
    // Basic path sanitization - remove dangerous characters and path traversal
    return path
        .replace(/\.\./g, '') // Remove path traversal
        .replace(/[^a-zA-Z0-9\/\-_.]/g, '') // Remove other dangerous characters
        .replace(/\/+/g, '/'); // Replace multiple slashes with single slash
}
//# sourceMappingURL=validation.js.map