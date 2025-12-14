/**
 * Tests for WorkflowExecutor
 */

import { WorkflowExecutor } from '../../workflows/WorkflowExecutor';
import { PredefinedWorkflows } from '../../workflows/PredefinedWorkflows';
import { AssessmentEnvironment } from '../../types';

describe('WorkflowExecutor', () => {
  let executor: WorkflowExecutor;

  beforeEach(() => {
    executor = new WorkflowExecutor();
  });

  describe('workflow management', () => {
    it('should get available workflows', () => {
      const workflows = executor.getAvailableWorkflows();
      
      expect(workflows).toBeDefined();
      expect(workflows.length).toBeGreaterThan(0);
      expect(workflows[0]).toHaveProperty('name');
      expect(workflows[0]).toHaveProperty('description');
      expect(workflows[0]).toHaveProperty('steps');
    });

    it('should get specific workflow by name', () => {
      const workflow = executor.getWorkflow('nodejs-standard');
      
      expect(workflow).toBeDefined();
      expect(workflow?.name).toBe('nodejs-standard');
      expect(workflow?.codebaseTypes).toContain('nodejs');
    });

    it('should return undefined for non-existent workflow', () => {
      const workflow = executor.getWorkflow('non-existent-workflow');
      
      expect(workflow).toBeUndefined();
    });
  });

  describe('predefined workflows', () => {
    it('should have nodejs workflow', () => {
      const workflow = PredefinedWorkflows.getNodeJSWorkflow();
      
      expect(workflow.name).toBe('nodejs-standard');
      expect(workflow.codebaseTypes).toContain('nodejs');
      expect(workflow.steps.length).toBeGreaterThan(0);
    });

    it('should have solidity workflow', () => {
      const workflow = PredefinedWorkflows.getSolidityWorkflow();
      
      expect(workflow.name).toBe('solidity-standard');
      expect(workflow.codebaseTypes).toContain('solidity');
      expect(workflow.steps.length).toBeGreaterThan(0);
    });

    it('should auto-select appropriate workflow', () => {
      const nodejsWorkflow = PredefinedWorkflows.autoSelectWorkflow('nodejs', ['javascript'], []);
      expect(nodejsWorkflow.name).toBe('nodejs-standard');

      const solidityWorkflow = PredefinedWorkflows.autoSelectWorkflow('solidity', ['solidity'], []);
      expect(solidityWorkflow.name).toBe('solidity-standard');

      const mixedWorkflow = PredefinedWorkflows.autoSelectWorkflow('mixed', ['javascript', 'solidity'], []);
      expect(mixedWorkflow.name).toBe('mixed-comprehensive');
    });
  });
});