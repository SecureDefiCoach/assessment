/**
 * CLI command definitions and handlers
 */
import { AssessmentCommand } from './types';
export declare class CLICommands {
    private containerManager;
    private securityEngine;
    private analysisOrchestrator;
    private workflowExecutor;
    constructor();
    /**
     * Get all available CLI commands
     */
    getCommands(): AssessmentCommand[];
    /**
     * Handle assess command
     */
    private handleAssess;
    /**
     * Handle status command
     */
    private handleStatus;
    /**
     * Handle stop command
     */
    private handleStop;
    /**
     * Handle cleanup command
     */
    private handleCleanup;
    /**
     * Handle extract command
     */
    private handleExtract;
    /**
     * Create security configuration from CLI options
     */
    private createSecurityConfiguration;
    /**
     * Create analysis configuration from CLI options
     */
    private createAnalysisConfiguration;
    /**
     * Auto-detect codebase type based on files present
     */
    private detectCodebaseType;
    /**
     * Extract results from assessment environment
     */
    private extractResults;
    /**
     * Generate formatted report
     */
    private generateReport;
    /**
     * Generate HTML report
     */
    private generateHTMLReport;
    /**
     * Generate text report
     */
    private generateTextReport;
}
//# sourceMappingURL=CLICommands.d.ts.map