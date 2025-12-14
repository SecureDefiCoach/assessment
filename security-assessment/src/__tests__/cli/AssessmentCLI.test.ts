/**
 * Tests for AssessmentCLI
 */

import { AssessmentCLI } from '../../cli/AssessmentCLI';

describe('AssessmentCLI', () => {
  let cli: AssessmentCLI;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    cli = new AssessmentCLI();
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('help system', () => {
    it('should show general help when no command is provided', async () => {
      await cli.run([]);
      
      expect(consoleSpy).toHaveBeenCalledWith('Security Assessment Container CLI');
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Usage: security-assessment <command> [options]'));
    });

    it('should show help when help command is used', async () => {
      await cli.run(['help']);
      
      expect(consoleSpy).toHaveBeenCalledWith('Security Assessment Container CLI');
    });

    it('should show command-specific help', async () => {
      await cli.run(['assess', '--help']);
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Usage: security-assessment assess [options]'));
      expect(consoleSpy).toHaveBeenCalledWith('Start a security assessment of a codebase');
    });
  });

  describe('version', () => {
    it('should show version information', async () => {
      await cli.run(['version']);
      
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Security Assessment Container'));
    });
  });

  describe('argument parsing', () => {
    it('should parse command and options correctly', () => {
      const result = (cli as any).parseArguments(['assess', '--codebase', '/path/to/code', '--verbose']);
      
      expect(result.command).toBe('assess');
      expect(result.options.codebase).toBe('/path/to/code');
      expect(result.options.verbose).toBe(true);
    });

    it('should handle short options', () => {
      const result = (cli as any).parseArguments(['assess', '-c', '/path/to/code', '-v']);
      
      expect(result.command).toBe('assess');
      expect(result.options.codebase).toBe('/path/to/code');
      expect(result.options.verbose).toBe(true);
    });
  });
});