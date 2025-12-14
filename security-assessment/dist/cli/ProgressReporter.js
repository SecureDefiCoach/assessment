"use strict";
/**
 * Progress reporting for CLI operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProgressReporter = void 0;
class ProgressReporter {
    constructor(verbose = false) {
        this.verbose = verbose;
        this.startTime = new Date();
    }
    /**
     * Report progress update to console
     */
    reportProgress(update) {
        const elapsed = Date.now() - this.startTime.getTime();
        const elapsedSeconds = Math.floor(elapsed / 1000);
        if (this.verbose) {
            console.log(`[${elapsedSeconds}s] ${update.stage}: ${update.message} (${update.progress}%)`);
        }
        else {
            // Simple progress bar for non-verbose mode
            const progressBar = this.createProgressBar(update.progress);
            process.stdout.write(`\r${update.stage}: ${progressBar} ${update.progress}%`);
            if (update.progress === 100) {
                console.log(); // New line when complete
            }
        }
    }
    /**
     * Report error message
     */
    reportError(error) {
        console.error(`❌ Error: ${error}`);
    }
    /**
     * Report success message
     */
    reportSuccess(message) {
        console.log(`✅ ${message}`);
    }
    /**
     * Report warning message
     */
    reportWarning(message) {
        console.warn(`⚠️  Warning: ${message}`);
    }
    /**
     * Report info message
     */
    reportInfo(message) {
        if (this.verbose) {
            console.log(`ℹ️  ${message}`);
        }
    }
    /**
     * Create a simple progress bar
     */
    createProgressBar(progress, width = 20) {
        const filled = Math.floor((progress / 100) * width);
        const empty = width - filled;
        return `[${'█'.repeat(filled)}${' '.repeat(empty)}]`;
    }
    /**
     * Start timing for a new operation
     */
    startOperation() {
        this.startTime = new Date();
    }
    /**
     * Get elapsed time since start
     */
    getElapsedTime() {
        return Date.now() - this.startTime.getTime();
    }
}
exports.ProgressReporter = ProgressReporter;
//# sourceMappingURL=ProgressReporter.js.map