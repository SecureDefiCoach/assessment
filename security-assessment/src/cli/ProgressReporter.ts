/**
 * Progress reporting for CLI operations
 */

import { ProgressUpdate } from './types';

export class ProgressReporter {
  private verbose: boolean;
  private startTime: Date;

  constructor(verbose: boolean = false) {
    this.verbose = verbose;
    this.startTime = new Date();
  }

  /**
   * Report progress update to console
   */
  public reportProgress(update: ProgressUpdate): void {
    const elapsed = Date.now() - this.startTime.getTime();
    const elapsedSeconds = Math.floor(elapsed / 1000);
    
    if (this.verbose) {
      console.log(`[${elapsedSeconds}s] ${update.stage}: ${update.message} (${update.progress}%)`);
    } else {
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
  public reportError(error: string): void {
    console.error(`❌ Error: ${error}`);
  }

  /**
   * Report success message
   */
  public reportSuccess(message: string): void {
    console.log(`✅ ${message}`);
  }

  /**
   * Report warning message
   */
  public reportWarning(message: string): void {
    console.warn(`⚠️  Warning: ${message}`);
  }

  /**
   * Report info message
   */
  public reportInfo(message: string): void {
    if (this.verbose) {
      console.log(`ℹ️  ${message}`);
    }
  }

  /**
   * Create a simple progress bar
   */
  private createProgressBar(progress: number, width: number = 20): string {
    const filled = Math.floor((progress / 100) * width);
    const empty = width - filled;
    return `[${'█'.repeat(filled)}${' '.repeat(empty)}]`;
  }

  /**
   * Start timing for a new operation
   */
  public startOperation(): void {
    this.startTime = new Date();
  }

  /**
   * Get elapsed time since start
   */
  public getElapsedTime(): number {
    return Date.now() - this.startTime.getTime();
  }
}