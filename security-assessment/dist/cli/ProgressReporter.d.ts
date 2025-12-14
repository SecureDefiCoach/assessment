/**
 * Progress reporting for CLI operations
 */
import { ProgressUpdate } from './types';
export declare class ProgressReporter {
    private verbose;
    private startTime;
    constructor(verbose?: boolean);
    /**
     * Report progress update to console
     */
    reportProgress(update: ProgressUpdate): void;
    /**
     * Report error message
     */
    reportError(error: string): void;
    /**
     * Report success message
     */
    reportSuccess(message: string): void;
    /**
     * Report warning message
     */
    reportWarning(message: string): void;
    /**
     * Report info message
     */
    reportInfo(message: string): void;
    /**
     * Create a simple progress bar
     */
    private createProgressBar;
    /**
     * Start timing for a new operation
     */
    startOperation(): void;
    /**
     * Get elapsed time since start
     */
    getElapsedTime(): number;
}
//# sourceMappingURL=ProgressReporter.d.ts.map