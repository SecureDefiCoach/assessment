#!/bin/bash
# Container Startup Script for Security Assessment
# Handles container initialization and tool preparation

set -euo pipefail

# Configuration
CONTAINER_TYPE="${ASSESSMENT_MODE:-security}"
LOG_FILE="/app/results/container-startup.log"
WORKSPACE_DIR="/app/workspace"
RESULTS_DIR="/app/results"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [STARTUP] $*" | tee -a "$LOG_FILE"
}

# Error handling
error_exit() {
    log "ERROR: $1"
    exit 1
}

# Signal handlers for graceful shutdown
cleanup() {
    log "Received shutdown signal, cleaning up..."
    # Kill any running analysis processes
    pkill -f "eslint\|hardhat\|truffle\|slither" || true
    log "Cleanup completed"
    exit 0
}

trap cleanup SIGTERM SIGINT

# Initialize container environment
initialize_container() {
    log "Initializing $CONTAINER_TYPE assessment container..."
    
    # Verify user permissions
    if [[ $EUID -eq 0 ]]; then
        error_exit "Container should not run as root"
    fi
    
    # Check required directories
    local required_dirs=("$WORKSPACE_DIR" "$RESULTS_DIR")
    for dir in "${required_dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            error_exit "Required directory not found: $dir"
        fi
    done
    
    log "Container initialized successfully"
}

# Setup environment variables
setup_environment() {
    log "Setting up environment variables..."
    
    # Security settings
    export NODE_ENV="${NODE_ENV:-production}"
    export NPM_CONFIG_AUDIT_LEVEL="${NPM_CONFIG_AUDIT_LEVEL:-moderate}"
    export NPM_CONFIG_FUND=false
    export NPM_CONFIG_UPDATE_NOTIFIER=false
    
    # Analysis settings
    export MAX_ANALYSIS_TIME="${MAX_ANALYSIS_TIME:-3600}"
    export LOG_LEVEL="${LOG_LEVEL:-info}"
    
    # Blockchain-specific settings
    if [[ "$CONTAINER_TYPE" == "blockchain" ]]; then
        export HARDHAT_NETWORK="${HARDHAT_NETWORK:-localhost}"
        export SOLC_VERSION="${SOLC_VERSION:-0.8.21}"
        export GAS_LIMIT="${GAS_LIMIT:-8000000}"
    fi
    
    log "Environment variables configured"
}

# Verify tool availability
verify_tools() {
    log "Verifying tool availability for $CONTAINER_TYPE assessment..."
    
    # Common tools
    local common_tools=("node" "npm" "python3")
    for tool in "${common_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            error_exit "Required tool not found: $tool"
        fi
    done
    
    # Container-specific tools
    if [[ "$CONTAINER_TYPE" == "blockchain" ]]; then
        local blockchain_tools=("solc" "hardhat")
        for tool in "${blockchain_tools[@]}"; do
            if ! command -v "$tool" &> /dev/null; then
                error_exit "Required blockchain tool not found: $tool"
            fi
        done
    fi
    
    log "All required tools are available"
}

# Setup workspace permissions
setup_workspace() {
    log "Setting up workspace permissions..."
    
    # Ensure proper ownership (should already be set by Docker)
    local current_user
    current_user=$(id -u)
    
    # Verify read access to workspace
    if [[ ! -r "$WORKSPACE_DIR" ]]; then
        error_exit "Cannot read workspace directory: $WORKSPACE_DIR"
    fi
    
    # Verify write access to results
    if [[ ! -w "$RESULTS_DIR" ]]; then
        error_exit "Cannot write to results directory: $RESULTS_DIR"
    fi
    
    log "Workspace permissions verified"
}

# Create analysis configuration
create_analysis_config() {
    log "Creating analysis configuration..."
    
    # Create analysis metadata
    cat > "$RESULTS_DIR/analysis-metadata.json" << EOF
{
    "container_type": "$CONTAINER_TYPE",
    "started_at": "$(date -Iseconds)",
    "node_version": "$(node --version)",
    "npm_version": "$(npm --version)",
    "python_version": "$(python3 --version)",
    "user_id": "$(id -u)",
    "group_id": "$(id -g)",
    "environment": {
        "NODE_ENV": "$NODE_ENV",
        "MAX_ANALYSIS_TIME": "$MAX_ANALYSIS_TIME",
        "LOG_LEVEL": "$LOG_LEVEL"
    }
}
EOF

    # Blockchain-specific metadata
    if [[ "$CONTAINER_TYPE" == "blockchain" ]]; then
        local solc_version=""
        if command -v solc &> /dev/null; then
            solc_version=$(solc --version | head -n1 | cut -d' ' -f2 || echo "unknown")
        fi
        
        cat > "$RESULTS_DIR/blockchain-metadata.json" << EOF
{
    "solc_version": "$solc_version",
    "hardhat_network": "$HARDHAT_NETWORK",
    "gas_limit": "$GAS_LIMIT",
    "tools_available": {
        "solc": $(command -v solc &> /dev/null && echo "true" || echo "false"),
        "hardhat": $(command -v hardhat &> /dev/null && echo "true" || echo "false"),
        "truffle": $(command -v truffle &> /dev/null && echo "true" || echo "false"),
        "slither": $(command -v slither &> /dev/null && echo "true" || echo "false")
    }
}
EOF
    fi
    
    log "Analysis configuration created"
}

# Wait for analysis commands
wait_for_commands() {
    log "Container ready for analysis commands"
    log "Workspace: $WORKSPACE_DIR"
    log "Results: $RESULTS_DIR"
    log "Container type: $CONTAINER_TYPE"
    
    # Keep container running and wait for signals
    while true; do
        sleep 30
        # Health check - verify critical directories still exist
        if [[ ! -d "$WORKSPACE_DIR" ]] || [[ ! -d "$RESULTS_DIR" ]]; then
            error_exit "Critical directories missing, container integrity compromised"
        fi
    done
}

# Main execution
main() {
    log "Starting container startup sequence..."
    
    initialize_container
    setup_environment
    verify_tools
    setup_workspace
    create_analysis_config
    wait_for_commands
}

# Execute main function
main "$@"