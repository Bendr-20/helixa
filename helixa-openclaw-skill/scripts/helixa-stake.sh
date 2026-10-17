#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: helixa-stake.sh <id>" >&2
  echo "Example: helixa-stake.sh 1" >&2
  exit 1
fi

echo "CredStakingV2 is paused; no supported public staking API is available." >&2
exit 2
