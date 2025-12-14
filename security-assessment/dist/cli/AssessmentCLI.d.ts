/**
 * Main CLI interface for security assessment operations
 */
export declare class AssessmentCLI {
    private commands;
    private availableCommands;
    constructor();
    /**
     * Parse command line arguments and execute appropriate command
     */
    run(args: string[]): Promise<void>;
    /**
     * Parse command line arguments
     */
    private parseArguments;
    /**
     * Validate required options for a command
     */
    private validateOptions;
    /**
     * Parse string value to appropriate type
     */
    private parseValue;
    /**
     * Convert kebab-case to camelCase
     */
    private camelCase;
    /**
     * Show help information
     */
    private showHelp;
    /**
     * Show version information
     */
    private showVersion;
    /**
     * Show help for a specific command
     */
    showCommandHelp(commandName: string): void;
}
//# sourceMappingURL=AssessmentCLI.d.ts.map