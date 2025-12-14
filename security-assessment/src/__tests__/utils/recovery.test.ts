/**
 * Tests for recovery manager utilities
 */

import { RecoveryManager, RecoveryStrategy, RecoveryResult } from '../../utils/recovery';
import { SecurityAssessmentError, ErrorRecoveryState, ContainerCreationError } from '../../utils/errors';
import { WorkflowStep } from '../../types';

describe('RecoveryManager', () => {
  let recoveryManager: RecoveryManager;

  beforeEach(() => {
    recoveryManager = new RecoveryManager();
  });

  describe('checkpoint management', () => {
    it('should create and retrieve checkpoints', () => {
      const containerId = 'test-container';
      const stepName = 'test-step';
      const state = { key: 'value' };
      const results = { result: 'data' };

      recoveryManager.createCheckpoint(containerId, stepName, state, results);

      const checkpoint = recoveryManager.getLatestCheckpoint(containerId);
      expect(checkpoint).toBeDefined();
      expect(checkpoint!.stepName).toBe(stepName);
      expect(checkpoint!.state).toEqual(state);
      expect(checkpoint!.results).toEqual(results);
      expect(checkpoint!.timestamp).toBeInstanceOf(Date);
    });

    it('should limit checkpoint history', () => {
      const containerId = 'test-container';

      // Create 15 checkpoints (more than the limit of 10)
      for (let i = 0; i < 15; i++) {
        recoveryManager.createCheckpoint(containerId, `step-${i}`, { step: i });
      }

      const checkpoints = recoveryManager.getCheckpoints(containerId);
      expect(checkpoints.length).toBe(10); // Should be limited to 10
      expect(checkpoints[0].stepName).toBe('step-5'); // Should start from step 5
      expect(checkpoints[9].stepName).toBe('step-14'); // Should end at step 14
    });

    it('should return empty array for non-existent container', () => {
      const checkpoints = recoveryManager.getCheckpoints('non-existent');
      expect(checkpoints).toEqual([]);
    });

    it('should return undefined for latest checkpoint of non-existent container', () => {
      const checkpoint = recoveryManager.getLatestCheckpoint('non-existent');
      expect(checkpoint).toBeUndefined();
    });
  });

  describe('recovery attempts', () => {
    it('should fail recovery when max attempts exceeded', async () => {
      const error = new ContainerCreationError('Test error');
      const recoveryState: ErrorRecoveryState = {
        containerId: 'test-container',
        completedSteps: [],
        failedSteps: [],
        recoveryAttempts: 5,
        maxRecoveryAttempts: 3, // Already exceeded
      };

      const result = await recoveryManager.attemptRecovery(error, recoveryState);

      expect(result.success).toBe(false);
      expect(result.shouldContinue).toBe(false);
      expect(result.message).toContain('Maximum recovery attempts');
    });

    it('should attempt recovery with available strategies', async () => {
      const error = new ContainerCreationError('Test error');
      const recoveryState: ErrorRecoveryState = {
        containerId: 'test-container',
        completedSteps: [],
        failedSteps: [],
        recoveryAttempts: 1,
        maxRecoveryAttempts: 3,
      };

      // The default container-recreation strategy should be available
      const result = await recoveryManager.attemptRecovery(error, recoveryState);

      expect(result.success).toBe(true);
      expect(result.shouldContinue).toBe(true);
      expect(result.message).toBe('Container recreated successfully');
    });

    it('should register and use custom recovery strategies', async () => {
      const customStrategy: RecoveryStrategy = {
        name: 'custom-strategy',
        canRecover: (error, state) => error.code === 'CUSTOM_ERROR',
        recover: async (error, state) => ({
          success: true,
          message: 'Custom recovery successful',
          shouldContinue: true,
        }),
      };

      recoveryManager.registerRecoveryStrategy(customStrategy);

      // Create a concrete error class for testing
      class CustomError extends SecurityAssessmentError {
        constructor(message: string) {
          super(message, 'CUSTOM_ERROR', 'medium');
        }
      }
      const error = new CustomError('Custom error');
      const recoveryState: ErrorRecoveryState = {
        containerId: 'test-container',
        completedSteps: [],
        failedSteps: [],
        recoveryAttempts: 1,
        maxRecoveryAttempts: 3,
      };

      const result = await recoveryManager.attemptRecovery(error, recoveryState);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Custom recovery successful');
    });
  });

  describe('degradation planning', () => {
    const createMockStep = (name: string, type: 'analysis' | 'test' | 'build' | 'custom', continueOnError = false): WorkflowStep => ({
      name,
      type,
      command: ['echo', 'test'],
      timeout: 30000,
      continueOnError,
      outputCapture: true,
    });

    it('should create degradation plan with skippable steps', () => {
      const error = new ContainerCreationError('Test error');
      const recoveryState: ErrorRecoveryState = {
        containerId: 'test-container',
        completedSteps: [],
        failedSteps: [],
        recoveryAttempts: 1,
        maxRecoveryAttempts: 3,
      };

      const remainingSteps = [
        createMockStep('critical-analysis', 'analysis'),
        createMockStep('optional-test', 'test', true), // Can be skipped
        createMockStep('enhancement-step', 'custom'), // Can be skipped (contains 'enhancement')
      ];

      const plan = recoveryManager.createDegradationPlan(error, recoveryState, remainingSteps);

      expect(plan.canContinue).toBe(true);
      expect(plan.skippedSteps).toContain('optional-test');
      expect(plan.skippedSteps).toContain('enhancement-step');
      expect(plan.modifiedSteps).toHaveLength(1);
      expect(plan.modifiedSteps[0].name).toBe('critical-analysis');
    });

    it('should modify steps for degraded operation', () => {
      const error = new ContainerCreationError('Test error');
      const recoveryState: ErrorRecoveryState = {
        containerId: 'test-container',
        completedSteps: [],
        failedSteps: [],
        recoveryAttempts: 1,
        maxRecoveryAttempts: 3,
      };

      const remainingSteps = [
        {
          name: 'long-analysis',
          type: 'analysis' as const,
          command: ['analyze', '--timeout=60000', '--memory=1g'],
          timeout: 60000,
          continueOnError: false,
          outputCapture: true,
        },
      ];

      const plan = recoveryManager.createDegradationPlan(error, recoveryState, remainingSteps);

      expect(plan.modifiedSteps).toHaveLength(1);
      const modifiedStep = plan.modifiedSteps[0];
      expect(modifiedStep.timeout).toBe(30000); // Reduced from 60000
      expect(modifiedStep.continueOnError).toBe(true); // Changed to true
      expect(modifiedStep.command).toContain('--memory=256m'); // Memory reduced
    });
  });

  describe('partial results preservation', () => {
    it('should preserve partial results and create appropriate error', () => {
      const containerId = 'test-container';
      const completedSteps = ['step1', 'step2'];
      const partialResults = { findings: ['issue1', 'issue2'] };
      const error = new ContainerCreationError('Test error');

      // Create a checkpoint first
      recoveryManager.createCheckpoint(containerId, 'step2', { completed: true }, partialResults);

      const preservedError = recoveryManager.preservePartialResults(
        containerId,
        completedSteps,
        partialResults,
        error
      );

      expect(preservedError.code).toBe('PARTIAL_ANALYSIS_FAILURE');
      expect(preservedError.context?.completedSteps).toEqual(completedSteps);
      expect(preservedError.context?.failedSteps).toEqual(['CONTAINER_CREATION_FAILED']);
      expect(preservedError.context?.preservedData).toBeDefined();
    });
  });

  describe('cleanup', () => {
    it('should clear recovery data for container', () => {
      const containerId = 'test-container';

      // Create some data
      recoveryManager.createCheckpoint(containerId, 'test-step', { key: 'value' });

      // Verify data exists
      expect(recoveryManager.getLatestCheckpoint(containerId)).toBeDefined();

      // Clear data
      recoveryManager.clearRecoveryData(containerId);

      // Verify data is cleared
      expect(recoveryManager.getLatestCheckpoint(containerId)).toBeUndefined();
      expect(recoveryManager.getCheckpoints(containerId)).toEqual([]);
    });
  });
});