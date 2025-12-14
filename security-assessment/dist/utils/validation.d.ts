/**
 * Validation utilities for configuration and input validation
 */
import { SecurityConfiguration, AnalysisConfiguration } from '../types';
export declare function validateSecurityConfiguration(config: SecurityConfiguration): string[];
export declare function validateAnalysisConfiguration(config: AnalysisConfiguration): string[];
export declare function isValidContainerId(containerId: string): boolean;
export declare function sanitizePath(path: string): string;
//# sourceMappingURL=validation.d.ts.map