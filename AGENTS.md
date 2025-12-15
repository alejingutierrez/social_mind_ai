# Repository Agent Instructions

These instructions apply to the entire `social_mind_ai` repository unless a subdirectory defines
its own `AGENTS.md`.

- Use Bash-compatible shell scripts with `#!/usr/bin/env bash`, `set -euo pipefail` and concise log
  messaging.
- Favor `requests` for Python HTTP interactions unless a different client is explicitly required.
- Keep documentation bilingual friendliness in mind (English default, Spanish clarifications if
  needed) and highlight where host-native services run versus containerized components.
- After making significant workflow changes, update `README.md` accordingly and note any validation
  commands executed.
