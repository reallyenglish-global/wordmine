#!/usr/bin/env bash
# Install one pinned, checksummed public release into the ephemeral CI runner.
set -euo pipefail
version=cli-2.11.0
sha=5384593cb4e7a106489e75a821d157dd43f4e438df6bc308b72e82c685e1283a
archive="$RUNNER_TEMP/maestro.zip"
curl --fail --location --retry 3 "https://github.com/mobile-dev-inc/maestro/releases/download/$version/maestro.zip" --output "$archive"
python3 - "$archive" "$sha" <<'PY'
import hashlib, pathlib, sys
assert hashlib.sha256(pathlib.Path(sys.argv[1]).read_bytes()).hexdigest() == sys.argv[2], 'Maestro checksum mismatch'
PY
unzip -q "$archive" -d "$RUNNER_TEMP/wordmine-tools"
printf '%s\n' "$RUNNER_TEMP/wordmine-tools/maestro/bin" >> "$GITHUB_PATH"
