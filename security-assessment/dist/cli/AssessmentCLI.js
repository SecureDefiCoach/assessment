"use strict";
/**
 * Main CLI interface for security assessment operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssessmentCLI = void 0;
const CLICommands_1 = require("./CLICommands");
class AssessmentCLI {
    constructor() {
        this.commands = new CLICommands_1.CLICommands();
        this.availableCommands = this.commands.getCommands();
    }
    /**
     * Parse command line arguments and execute appropriate command
     */
    async run(args) {
        try {
            const { command, options } = this.parseArguments(args);
            if (!command) {
                this.showHelp();
                return;
            }
            if (command === 'help' || command === '--help' || command === '-h') {
                this.showHelp();
                return;
            }
            if (command === 'version' || command === '--version' || command === '-V') {
                this.showVersion();
                return;
            }
            const commandDef = this.availableCommands.find(cmd => cmd.name === command);
            if (!commandDef) {
                console.error(`Unknown command: ${command}`);
                console.error('Run "security-assessment help" for available commands');
                process.exit(1);
            }
            // Check for command-specific help
            if (options.help) {
                this.showCommandHelp(command);
                return;
            }
            // Validate required options
            this.validateOptions(commandDef, options);
            // Execute command
            const result = await commandDef.handler(options);
            if (!result.success) {
                console.error(`Command failed: ${result.error}`);
                process.exit(1);
            }
        }
        catch (error) {
            console.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            process.exit(1);
        }
    }
    /**
     * Parse command line arguments
     */
    parseArguments(args) {
        if (args.length === 0) {
            return { options: {} };
        }
        const command = args[0];
        const options = {};
        for (let i = 1; i < args.length; i++) {
            const arg = args[i];
            if (arg.startsWith('--')) {
                const key = arg.substring(2);
                const nextArg = args[i + 1];
                if (nextArg && !nextArg.startsWith('-')) {
                    // Value argument
                    options[this.camelCase(key)] = this.parseValue(nextArg);
                    i++; // Skip next argument as it's the value
                }
                else {
                    // Boolean flag
                    options[this.camelCase(key)] = true;
                }
            }
            else if (arg.startsWith('-') && arg.length === 2) {
                // Short option
                const shortOpt = arg.substring(1);
                const commandDef = this.availableCommands.find(cmd => cmd.name === command);
                if (commandDef) {
                    const optionDef = commandDef.options.find(opt => opt.alias === shortOpt);
                    if (optionDef) {
                        const nextArg = args[i + 1];
                        if (optionDef.type === 'boolean') {
                            options[this.camelCase(optionDef.name)] = true;
                        }
                        else if (nextArg && !nextArg.startsWith('-')) {
                            options[this.camelCase(optionDef.name)] = this.parseValue(nextArg);
                            i++; // Skip next argument as it's the value
                        }
                    }
                }
            }
        }
        return { command, options };
    }
    /**
     * Validate required options for a command
     */
    validateOptions(commandDef, options) {
        for (const optionDef of commandDef.options) {
            const optionKey = this.camelCase(optionDef.name);
            if (optionDef.required && !(optionKey in options)) {
                throw new Error(`Required option missing: --${optionDef.name}`);
            }
            // Set default values
            if (!(optionKey in options) && optionDef.default !== undefined) {
                options[optionKey] = optionDef.default;
            }
            // Validate choices
            if (optionDef.choices && options[optionKey] && !optionDef.choices.includes(options[optionKey])) {
                throw new Error(`Invalid value for --${optionDef.name}. Must be one of: ${optionDef.choices.join(', ')}`);
            }
        }
    }
    /**
     * Parse string value to appropriate type
     */
    parseValue(value) {
        // Try to parse as number
        if (/^\d+$/.test(value)) {
            return parseInt(value, 10);
        }
        if (/^\d+\.\d+$/.test(value)) {
            return parseFloat(value);
        }
        // Parse boolean strings
        if (value.toLowerCase() === 'true')
            return true;
        if (value.toLowerCase() === 'false')
            return false;
        // Return as string
        return value;
    }
    /**
     * Convert kebab-case to camelCase
     */
    camelCase(str) {
        return str.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
    }
    /**
     * Show help information
     */
    showHelp() {
        console.log('Security Assessment Container CLI');
        console.log('');
        console.log('Usage: security-assessment <command> [options]');
        console.log('');
        console.log('Commands:');
        this.availableCommands.forEach(cmd => {
            console.log(`  ${cmd.name.padEnd(12)} ${cmd.description}`);
        });
        console.log('');
        console.log('Global Options:');
        console.log('  -h, --help     Show help information');
        console.log('  -V, --version  Show version information');
        console.log('');
        console.log('Use "security-assessment <command> --help" for command-specific help');
    }
    /**
     * Show version information
     */
    showVersion() {
        // Read version from package.json
        try {
            const packageJson = require('../../package.json');
            console.log(`Security Assessment Container v${packageJson.version}`);
        }
        catch {
            console.log('Security Assessment Container v1.0.0');
        }
    }
    /**
     * Show help for a specific command
     */
    showCommandHelp(commandName) {
        const commandDef = this.availableCommands.find(cmd => cmd.name === commandName);
        if (!commandDef) {
            console.error(`Unknown command: ${commandName}`);
            return;
        }
        console.log(`Usage: security-assessment ${commandName} [options]`);
        console.log('');
        console.log(commandDef.description);
        console.log('');
        if (commandDef.options.length > 0) {
            console.log('Options:');
            commandDef.options.forEach(option => {
                const flags = option.alias ?
                    `-${option.alias}, --${option.name}` :
                    `    --${option.name}`;
                let description = option.description;
                if (option.required) {
                    description += ' (required)';
                }
                if (option.default !== undefined) {
                    description += ` (default: ${option.default})`;
                }
                if (option.choices) {
                    description += ` (choices: ${option.choices.join(', ')})`;
                }
                console.log(`  ${flags.padEnd(20)} ${description}`);
            });
        }
        console.log('');
    }
}
exports.AssessmentCLI = AssessmentCLI;
//# sourceMappingURL=AssessmentCLI.js.map