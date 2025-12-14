/**
 * CLI-specific type definitions
 */
export interface CLIOptions {
    codebasePath: string;
    outputPath?: string;
    analysisType?: 'nodejs' | 'solidity' | 'mixed' | 'auto';
    securityLevel?: 'basic' | 'standard' | 'strict';
    networkAccess?: boolean;
    customWorkflow?: string;
    verbose?: boolean;
    format?: 'json' | 'html' | 'text';
}
export interface AssessmentCommand {
    name: string;
    description: string;
    options: CLIOptionDefinition[];
    handler: (options: any) => Promise<CLIResult>;
}
export interface CLIOptionDefinition {
    name: string;
    alias?: string;
    description: string;
    type: 'string' | 'boolean' | 'number';
    required?: boolean;
    default?: any;
    choices?: string[];
}
export interface ProgressUpdate {
    stage: string;
    progress: number;
    message: string;
    timestamp: Date;
}
export interface CLIResult {
    success: boolean;
    assessmentId?: string;
    outputPath?: string;
    summary?: string;
    error?: string;
}
//# sourceMappingURL=types.d.ts.map