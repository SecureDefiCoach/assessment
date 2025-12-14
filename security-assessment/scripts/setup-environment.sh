#!/bin/bash
# Security Assessment Environment Setup Script
# Automatically configures tools and environment for code analysis

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="/app/results/setup.log"
CONFIG_DIR="/app/config"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# Error handling
error_exit() {
    log "ERROR: $1"
    exit 1
}

# Check if running as non-root user
check_user() {
    if [[ $EUID -eq 0 ]]; then
        error_exit "This script should not be run as root for security reasons"
    fi
    log "Running as user: $(whoami) (UID: $EUID)"
}

# Verify required tools are installed
verify_tools() {
    log "Verifying required tools..."
    
    local tools=("node" "npm" "python3" "pip3")
    for tool in "${tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            error_exit "$tool is not installed or not in PATH"
        fi
        log "$tool: $(command -v "$tool")"
    done
}

# Setup Node.js environment
setup_nodejs() {
    log "Setting up Node.js environment..."
    
    # Verify Node.js version
    local node_version
    node_version=$(node --version)
    log "Node.js version: $node_version"
    
    # Configure npm for security
    npm config set audit-level moderate
    npm config set fund false
    npm config set update-notifier false
    
    # Verify global tools
    local npm_tools=("hardhat" "truffle" "eslint" "retire")
    for tool in "${npm_tools[@]}"; do
        if npm list -g "$tool" &> /dev/null; then
            log "$tool: installed globally"
        else
            log "WARNING: $tool not found globally"
        fi
    done
}

# Setup Python security tools
setup_python_tools() {
    log "Setting up Python security tools..."
    
    # Verify Python version
    local python_version
    python_version=$(python3 --version)
    log "Python version: $python_version"
    
    # Verify security tools
    local python_tools=("slither" "mythril" "bandit" "safety")
    for tool in "${python_tools[@]}"; do
        if command -v "$tool" &> /dev/null; then
            log "$tool: $(command -v "$tool")"
        else
            log "WARNING: $tool not found in PATH"
        fi
    done
}

# Setup blockchain tools
setup_blockchain_tools() {
    log "Setting up blockchain development tools..."
    
    # Verify Solidity compiler
    if command -v solc &> /dev/null; then
        local solc_version
        solc_version=$(solc --version | head -n1)
        log "Solidity compiler: $solc_version"
    else
        log "WARNING: Solidity compiler not found"
    fi
    
    # Test Hardhat installation
    if command -v hardhat &> /dev/null; then
        log "Hardhat: $(hardhat --version 2>/dev/null || echo 'installed')"
    else
        log "WARNING: Hardhat not found"
    fi
    
    # Test Truffle installation
    if command -v truffle &> /dev/null; then
        log "Truffle: $(truffle version 2>/dev/null | head -n1 || echo 'installed')"
    else
        log "WARNING: Truffle not found"
    fi
}

# Create necessary directories
setup_directories() {
    log "Setting up directory structure..."
    
    local dirs=("/app/workspace" "/app/results" "/app/tools" "/app/config")
    for dir in "${dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            mkdir -p "$dir" || error_exit "Failed to create directory: $dir"
        fi
        log "Directory ready: $dir"
    done
}

# Setup analysis configuration
setup_analysis_config() {
    log "Setting up analysis configuration..."
    
    # Create ESLint configuration
    cat > "$CONFIG_DIR/eslint.config.js" << 'EOF'
module.exports = {
    env: {
        node: true,
        es2021: true
    },
    extends: [
        'eslint:recommended'
    ],
    parserOptions: {
        ecmaVersion: 12,
        sourceType: 'module'
    },
    rules: {
        'no-eval': 'error',
        'no-implied-eval': 'error',
        'no-new-func': 'error',
        'no-script-url': 'error'
    }
};
EOF

    # Create Hardhat configuration template
    cat > "$CONFIG_DIR/hardhat.config.template.js" << 'EOF'
require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ethers");
require("hardhat-gas-reporter");
require("hardhat-contract-sizer");

module.exports = {
    solidity: {
        version: "0.8.21",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200
            }
        }
    },
    networks: {
        hardhat: {
            chainId: 31337
        }
    },
    gasReporter: {
        enabled: true,
        currency: 'USD'
    },
    contractSizer: {
        alphaSort: true,
        runOnCompile: true,
        disambiguatePaths: false
    }
};
EOF

    log "Analysis configuration files created"
}

# Main execution
main() {
    log "Starting security assessment environment setup..."
    
    check_user
    verify_tools
    setup_directories
    setup_nodejs
    setup_python_tools
    setup_blockchain_tools
    setup_analysis_config
    
    log "Environment setup completed successfully"
    log "Ready for security assessment operations"
}

# Execute main function
main "$@"