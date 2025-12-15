#!/usr/bin/env bash
set -euo pipefail

BREW_INSTALL_URL="https://brew.sh/"
OLLAMA_MODEL="qwen2.5:14b"
API_HEALTH_URL="http://127.0.0.1:11434/api/tags"
MAX_RETRIES=30
SLEEP_SECONDS=2

log() {
  printf "[setup_host_ollama] %s\n" "$*"
}

die() {
  printf "[setup_host_ollama][error] %s\n" "$*" >&2
  exit 1
}

check_brew() {
  if ! command -v brew >/dev/null 2>&1; then
    die "Homebrew is required. Install it from ${BREW_INSTALL_URL} and rerun this script."
  fi
  log "Homebrew detected at $(command -v brew)."
}

install_ollama() {
  if ! brew list --formula | grep -q '^ollama$'; then
    log "Installing Ollama via Homebrew..."
    brew install ollama
  else
    log "Ollama already installed. Ensuring it is up to date..."
    brew upgrade ollama || log "Ollama already the latest version."
  fi
}

configure_host_binding() {
  local desired_host="0.0.0.0"
  if [[ "${OLLAMA_HOST:-}" != "$desired_host" ]]; then
    export OLLAMA_HOST="$desired_host"
    log "Temporarily exporting OLLAMA_HOST=$desired_host."
  fi

  local current_launchctl
  current_launchctl=$(launchctl getenv OLLAMA_HOST || true)
  if [[ "$current_launchctl" != "$desired_host" ]]; then
    log "Setting persistent OLLAMA_HOST for brew service via launchctl..."
    launchctl setenv OLLAMA_HOST "$desired_host"
  else
    log "launchctl already configured with OLLAMA_HOST=$desired_host."
  fi
}

start_service() {
  log "(Re)starting Ollama via brew services..."
  brew services restart ollama >/dev/null 2>&1 || brew services start ollama
}

wait_for_service() {
  log "Waiting for Ollama API to become healthy..."
  for ((i=1; i<=MAX_RETRIES; i++)); do
    if curl -fs "${API_HEALTH_URL}" >/dev/null 2>&1; then
      log "Ollama service is responsive."
      return
    fi
    sleep "$SLEEP_SECONDS"
  done
  die "Ollama service did not become ready after $((MAX_RETRIES * SLEEP_SECONDS)) seconds."
}

pull_model() {
  log "Pulling model ${OLLAMA_MODEL} (this may take a while)..."
  ollama pull "$OLLAMA_MODEL"
  log "Model ${OLLAMA_MODEL} is available locally."
}

main() {
  check_brew
  install_ollama
  configure_host_binding
  start_service
  wait_for_service
  pull_model
  log "Host setup complete. Ollama is listening on all interfaces."
}

main "$@"
