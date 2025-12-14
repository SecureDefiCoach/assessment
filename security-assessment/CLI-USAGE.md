# Security Assessment Container CLI

This document provides usage instructions for the Security Assessment Container CLI tool.

## Installation

After building the project:

```bash
npm run build
```

You can run the CLI using:

```bash
node dist/cli.js <command> [options]
```

Or if installed globally:

```bash
security-assessment <command> [options]
```

## Available Commands

### assess

Start a security assessment of a codebase.

```bash
security-assessment assess --codebase /path/to/code [options]
```

**Options:**
- `-c, --codebase` (required): Path to the codebase to assess
- `-o, --output`: Output directory for results (default: ./assessment-results)
- `-t, --type`: Type of analysis (nodejs, solidity, mixed, auto) (default: auto)
- `-s, --security-level`: Security isolation level (basic, standard, strict) (default: standard)
- `-n, --network`: Allow network access for package installation (default: false)
- `-w, --workflow`: Custom workflow configuration file
- `-v, --verbose`: Enable verbose output (default: false)
- `-f, --format`: Output format (json, html, text) (default: json)

**Examples:**

```bash
# Basic assessment with auto-detection
security-assessment assess --codebase ./my-project

# Solidity-specific assessment with strict security
security-assessment assess --codebase ./defi-project --type solidity --security-level strict

# Custom workflow with verbose output
security-assessment assess --codebase ./app --workflow ./custom-workflow.json --verbose

# Assessment with network access for dependency installation
security-assessment assess --codebase ./node-app --network --format html
```

### status

Check the status of running assessments.

```bash
security-assessment status [options]
```

**Options:**
- `-i, --assessment-id`: Specific assessment ID to check

**Examples:**

```bash
# List all active assessments
security-assessment status

# Check specific assessment
security-assessment status --assessment-id assessment-123456
```

### stop

Stop a running assessment.

```bash
security-assessment stop --assessment-id <id>
```

**Options:**
- `-i, --assessment-id` (required): Assessment ID to stop

### cleanup

Clean up assessment environments and resources.

```bash
security-assessment cleanup [options]
```

**Options:**
- `-a, --all`: Clean up all environments
- `-i, --assessment-id`: Specific assessment to clean up

**Examples:**

```bash
# Clean up all environments
security-assessment cleanup --all

# Clean up specific assessment
security-assessment cleanup --assessment-id assessment-123456
```

### extract

Extract results from a completed assessment.

```bash
security-assessment extract --assessment-id <id> --output <path> [options]
```

**Options:**
- `-i, --assessment-id` (required): Assessment ID to extract results from
- `-o, --output` (required): Output directory for extracted results
- `-f, --format`: Output format (json, html, text) (default: json)

## Workflow Configuration

You can create custom workflow configuration files to define specific analysis steps.

### Example Workflow File

```json
{
  "name": "custom-nodejs-workflow",
  "description": "Custom Node.js security assessment",
  "version": "1.0.0",
  "codebaseTypes": ["nodejs"],
  "steps": [
    {
      "name": "setup",
      "description": "Set up analysis environment",
      "tool": "setup",
      "config": {
        "nodeVersion": "lts",
        "installDependencies": true,
        "createOutputDir": true
      }
    },
    {
      "name": "dependency-audit",
      "description": "Audit dependencies for vulnerabilities",
      "tool": "npm-audit",
      "config": {
        "auditLevel": "moderate",
        "outputFormat": "json"
      },
      "condition": {
        "type": "file-exists",
        "value": "package.json"
      }
    },
    {
      "name": "static-analysis",
      "description": "Run static code analysis",
      "tool": "eslint",
      "config": {
        "extensions": [".js", ".ts"],
        "outputFormat": "json"
      }
    }
  ],
  "parallelSteps": [
    ["static-analysis", "security-scan"]
  ]
}
```

### Workflow Step Tools

Available tools for workflow steps:

- `setup`: Initialize analysis environment
- `npm-audit`: Run npm security audit
- `eslint`: Run ESLint static analysis
- `semgrep`: Run Semgrep security analysis
- `slither`: Run Slither smart contract analysis
- `mythx`: Run MythX smart contract analysis
- `solidity-compiler`: Compile Solidity contracts
- `gas-analyzer`: Analyze gas usage
- `test-runner`: Run test suites
- `hardhat-test`: Run Hardhat tests

### Predefined Workflows

The system includes several predefined workflows:

- `nodejs-standard`: Standard Node.js security assessment
- `solidity-standard`: Standard Solidity smart contract assessment
- `mixed-comprehensive`: Comprehensive assessment for mixed projects
- `quick-scan`: Fast security scan
- `deep-analysis`: Comprehensive deep security analysis

## Security Levels

### Basic
- Minimal isolation
- Network access allowed
- Higher resource limits
- Suitable for trusted code

### Standard (Default)
- Network isolation enabled
- Controlled network access for package installation
- Moderate resource limits
- Balanced security and functionality

### Strict
- Complete network isolation
- Minimal resource limits
- Maximum security restrictions
- Suitable for untrusted code

## Output Formats

### JSON (Default)
Structured JSON output suitable for programmatic processing.

### HTML
Human-readable HTML report with styling and formatting.

### Text
Plain text report suitable for console output or simple processing.

## Examples

### Assess a DeFi Project

```bash
security-assessment assess \
  --codebase ./defi-project \
  --type mixed \
  --security-level strict \
  --workflow ./workflows/defi-assessment.json \
  --output ./security-reports \
  --format html \
  --verbose
```

### Quick Security Scan

```bash
security-assessment assess \
  --codebase ./suspicious-code \
  --workflow ./workflows/quick-scan.json \
  --security-level strict \
  --format text
```

### Comprehensive Node.js Assessment

```bash
security-assessment assess \
  --codebase ./node-app \
  --type nodejs \
  --network \
  --output ./detailed-report \
  --format html
```

## Troubleshooting

### Common Issues

1. **Container creation fails**: Ensure Docker is running and accessible
2. **Permission denied**: Check file permissions on codebase directory
3. **Network issues**: Use `--network` flag if dependency installation is needed
4. **Out of resources**: Try a lower security level or increase Docker resource limits

### Getting Help

```bash
# General help
security-assessment --help

# Command-specific help
security-assessment assess --help
security-assessment status --help
```

### Verbose Output

Use the `--verbose` flag to get detailed information about the assessment process:

```bash
security-assessment assess --codebase ./code --verbose
```

This will show:
- Step-by-step progress
- Tool execution details
- Intermediate results
- Timing information
- Debug messages