#!/usr/bin/env node
"use strict";
/**
 * CLI entry point for security assessment container
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssessmentCLI = void 0;
const AssessmentCLI_1 = require("./cli/AssessmentCLI");
Object.defineProperty(exports, "AssessmentCLI", { enumerable: true, get: function () { return AssessmentCLI_1.AssessmentCLI; } });
async function main() {
    const cli = new AssessmentCLI_1.AssessmentCLI();
    const args = process.argv.slice(2);
    try {
        await cli.run(args);
    }
    catch (error) {
        console.error('CLI Error:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
    }
}
// Run CLI if this file is executed directly
if (require.main === module) {
    main();
}
//# sourceMappingURL=cli.js.map