/**
 * Workflow-specific type definitions
 */

import { AnalysisResults } from '../types';
import { ProgressUpdate } from '../cli/types';

export interface WorkflowStep {
  name: string;
  description: string;
  tool: string;
  config: Record<string, any>;
  condition?: WorkflowCondition;
  timeout?: number;
  retries?: number;
}

export interface WorkflowCondition {
  type: 'file-exists' | 'language-detected' | 'framework-detected' | 'custom';
  value: string;
  operator?: 'equals' | 'contains' | 'matches';
}

export interface WorkflowDefinition {
  name: string;
  description: string;
  version: string;
  codebaseTypes: string[];
  steps: WorkflowStep[];
  parallelSteps?: string[][];
  cleanup?: WorkflowStep[];
}

export interface WorkflowContext {
  workspacePath: string;
  outputPath: string;
  codebaseType: string;
  detectedLanguages: string[];
  detectedFrameworks: string[];
  environment: Record<string, string>;
}

export interface WorkflowResult {
  success: boolean;
  results: AnalysisResults;
  executedSteps: string[];
  skippedSteps: string[];
  errors: WorkflowError[];
  duration: number;
}

export interface WorkflowError {
  step: string;
  error: string;
  timestamp: Date;
  recoverable: boolean;
}

export type ProgressCallback = (update: ProgressUpdate) => void;