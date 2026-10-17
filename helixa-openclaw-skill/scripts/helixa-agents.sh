#!/usr/bin/env bash
set -euo pipefail

limit="${1:-20}"
page="${2:-1}"

"$(dirname "$0")/helixa-get.sh" "/api/v2/agents" "limit=$limit&page=$page"
