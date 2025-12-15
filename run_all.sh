#!/usr/bin/env bash
set -euo pipefail

log() {
  printf "[run_all] %s\n" "$*"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf "[run_all][error] Required command '%s' not found.\n" "$1" >&2
    exit 1
  fi
}

detect_compose() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    echo "docker compose"
    return
  fi
  if command -v docker-compose >/dev/null 2>&1; then
    echo "docker-compose"
    return
  fi
  printf "[run_all][error] Docker Compose is required. Install Docker Desktop for Mac to obtain it.\n" >&2
  exit 1
}

main() {
  require_command docker

  log "Running host setup to ensure Ollama is installed and configured..."
  ./setup_host_ollama.sh

  COMPOSE_CMD=$(detect_compose)
  log "Using compose command: ${COMPOSE_CMD}"

  log "Building client image..."
  ${COMPOSE_CMD} build

  log "Starting client container and streaming output..."
  if [[ "$COMPOSE_CMD" == "docker compose" ]]; then
    docker compose run --rm client
  else
    docker-compose run --rm client
  fi

  log "All steps completed successfully."
}

main "$@"
