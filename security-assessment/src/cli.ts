#!/usr/bin/env node

/**
 * CLI entry point for security assessment container
 */

import { AssessmentCLI } from './cli/AssessmentCLI';

async function main() {
  const cli = new AssessmentCLI();
  const args = process.argv.slice(2);
  
  try {
    await cli.run(args);
  } catch (error) {
    console.error('CLI Error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// Run CLI if this file is executed directly
if (require.main === module) {
  main();
}

export { AssessmentCLI };