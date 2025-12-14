#!/bin/bash
# Environment Management Script for Security Assessment Containers
# Provides commands to start, stop, and manage assessment environments

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.yml"
OVERRIDE_FILE="$PROJECT_DIR/docker-compose.override.yml"

# Default values
DEFAULT_CODEBASE_PATH="./workspace"
DEFAULT_CONTRACTS_PATH="./contracts"
DEFAULT_TESTS_PATH="./tests"
DEFAULT_LOG_LEVEL="info"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $*"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*"
}

# Help function
show_help() {
    cat << EOF
Security Assessment Environment Manager

Usage: $0 [COMMAND] [OPTIONS]

Commands:
    start-security      Start security assessment container
    start-blockchain    Start blockchain assessment container
    start-all          Start all assessment containers
    stop               Stop all containers
    status             Show container status
    logs               Show container logs
    clean              Clean up containers and volumes
    build              Build container images
    shell              Open shell in running container

Options:
    --codebase PATH    Path to codebase to analyze (default: $DEFAULT_CODEBASE_PATH)
    --contracts PATH   Path to smart contracts (default: $DEFAULT_CONTRACTS_PATH)
    --tests PATH       Path to test files (default: $DEFAULT_TESTS_PATH)
    --log-level LEVEL  Log level: debug, info, warn, error (default: $DEFAULT_LOG_LEVEL)
    --dev              Use development configuration with network access
    --help             Show this help message

Examples:
    $0 start-security --codebase /path/to/code
    $0 start-blockchain --contracts /path/to/contracts --dev
    $0 logs security-assessment
    $0 shell security-assessment

EOF
}

# Parse command line arguments
parse_args() {
    COMMAND=""
    CODEBASE_PATH="$DEFAULT_CODEBASE_PATH"
    CONTRACTS_PATH="$DEFAULT_CONTRACTS_PATH"
    TESTS_PATH="$DEFAULT_TESTS_PATH"
    LOG_LEVEL="$DEFAULT_LOG_LEVEL"
    DEV_MODE=false
    CONTAINER_NAME=""

    while [[ $# -gt 0 ]]; do
        case $1 in
            start-security|start-blockchain|start-all|stop|status|logs|clean|build|shell)
                COMMAND="$1"
                shift
                ;;
            --codebase)
                CODEBASE_PATH="$2"
                shift 2
                ;;
            --contracts)
                CONTRACTS_PATH="$2"
                shift 2
                ;;
            --tests)
                TESTS_PATH="$2"
                shift 2
                ;;
            --log-level)
                LOG_LEVEL="$2"
                shift 2
                ;;
            --dev)
                DEV_MODE=true
                shift
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                if [[ -z "$CONTAINER_NAME" && "$COMMAND" =~ ^(logs|shell)$ ]]; then
                    CONTAINER_NAME="$1"
                else
                    log_error "Unknown option: $1"
                    show_help
                    exit 1
                fi
                shift
                ;;
        esac
    done

    if [[ -z "$COMMAND" ]]; then
        log_error "No command specified"
        show_help
        exit 1
    fi
}

# Setup environment variables
setup_env() {
    export CODEBASE_PATH="$(realpath "$CODEBASE_PATH" 2>/dev/null || echo "$CODEBASE_PATH")"
    export CONTRACTS_PATH="$(realpath "$CONTRACTS_PATH" 2>/dev/null || echo "$CONTRACTS_PATH")"
    export TESTS_PATH="$(realpath "$TESTS_PATH" 2>/dev/null || echo "$TESTS_PATH")"
    export LOG_LEVEL="$LOG_LEVEL"
    export COMPOSE_PROJECT_NAME="security-assessment"
}

# Get Docker Compose command
get_compose_cmd() {
    local cmd="docker-compose -f $COMPOSE_FILE"
    if [[ "$DEV_MODE" == "true" && -f "$OVERRIDE_FILE" ]]; then
        cmd="$cmd -f $OVERRIDE_FILE"
        log_info "Using development configuration"
    fi
    echo "$cmd"
}

# Validate paths
validate_paths() {
    if [[ "$COMMAND" =~ ^(start-security|start-all)$ ]]; then
        if [[ ! -d "$CODEBASE_PATH" ]]; then
            log_error "Codebase path does not exist: $CODEBASE_PATH"
            exit 1
        fi
    fi

    if [[ "$COMMAND" =~ ^(start-blockchain|start-all)$ ]]; then
        if [[ ! -d "$CONTRACTS_PATH" ]]; then
            log_warning "Contracts path does not exist: $CONTRACTS_PATH"
        fi
    fi
}

# Build container images
build_images() {
    log_info "Building container images..."
    
    local compose_cmd
    compose_cmd=$(get_compose_cmd)
    
    if ! $compose_cmd build; then
        log_error "Failed to build container images"
        exit 1
    fi
    
    log_success "Container images built successfully"
}

# Start security assessment container
start_security() {
    log_info "Starting security assessment container..."
    log_info "Codebase path: $CODEBASE_PATH"
    
    local compose_cmd
    compose_cmd=$(get_compose_cmd)
    
    if ! $compose_cmd up -d security-assessment; then
        log_error "Failed to start security assessment container"
        exit 1
    fi
    
    log_success "Security assessment container started"
}

# Start blockchain assessment container
start_blockchain() {
    log_info "Starting blockchain assessment container..."
    log_info "Contracts path: $CONTRACTS_PATH"
    log_info "Tests path: $TESTS_PATH"
    
    local compose_cmd
    compose_cmd=$(get_compose_cmd)
    
    if ! $compose_cmd up -d blockchain-assessment; then
        log_error "Failed to start blockchain assessment container"
        exit 1
    fi
    
    log_success "Blockchain assessment container started"
}

# Start all containers
start_all() {
    log_info "Starting all assessment containers..."
    
    local compose_cmd
    compose_cmd=$(get_compose_cmd)
    
    if ! $compose_cmd up -d; then
        log_error "Failed to start containers"
        exit 1
    fi
    
    log_success "All assessment containers started"
}

# Stop containers
stop_containers() {
    log_info "Stopping assessment containers..."
    
    local compose_cmd
    compose_cmd=$(get_compose_cmd)
    
    if ! $compose_cmd down; then
        log_error "Failed to stop containers"
        exit 1
    fi
    
    log_success "Assessment containers stopped"
}

# Show container status
show_status() {
    log_info "Container status:"
    
    local compose_cmd
    compose_cmd=$(get_compose_cmd)
    
    $compose_cmd ps
}

# Show container logs
show_logs() {
    local container="${CONTAINER_NAME:-}"
    
    if [[ -z "$container" ]]; then
        log_info "Showing logs for all containers:"
        local compose_cmd
        compose_cmd=$(get_compose_cmd)
        $compose_cmd logs -f
    else
        log_info "Showing logs for container: $container"
        docker logs -f "$container" 2>/dev/null || {
            log_error "Container not found: $container"
            exit 1
        }
    fi
}

# Clean up containers and volumes
clean_up() {
    log_warning "This will remove all containers and volumes. Are you sure? (y/N)"
    read -r response
    
    if [[ "$response" =~ ^[Yy]$ ]]; then
        log_info "Cleaning up containers and volumes..."
        
        local compose_cmd
        compose_cmd=$(get_compose_cmd)
        
        $compose_cmd down -v --remove-orphans
        docker system prune -f
        
        log_success "Cleanup completed"
    else
        log_info "Cleanup cancelled"
    fi
}

# Open shell in container
open_shell() {
    local container="${CONTAINER_NAME:-security-assessment-main}"
    
    log_info "Opening shell in container: $container"
    
    if ! docker exec -it "$container" /bin/sh; then
        log_error "Failed to open shell in container: $container"
        log_info "Make sure the container is running: $0 status"
        exit 1
    fi
}

# Main execution
main() {
    parse_args "$@"
    setup_env
    validate_paths
    
    case "$COMMAND" in
        build)
            build_images
            ;;
        start-security)
            start_security
            ;;
        start-blockchain)
            start_blockchain
            ;;
        start-all)
            start_all
            ;;
        stop)
            stop_containers
            ;;
        status)
            show_status
            ;;
        logs)
            show_logs
            ;;
        clean)
            clean_up
            ;;
        shell)
            open_shell
            ;;
        *)
            log_error "Unknown command: $COMMAND"
            show_help
            exit 1
            ;;
    esac
}

# Execute main function
main "$@"