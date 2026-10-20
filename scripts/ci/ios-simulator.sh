#!/usr/bin/env bash
# Run inside a disposable hosted iOS simulator. No signing or store upload.
set -euo pipefail
mkdir -p native-results
xcodebuild -version | tee native-results/xcode.txt
xcrun simctl list devices available --json > native-results/simulators.json
udid=$(python3 - <<'PY'
import json
from pathlib import Path
available = json.loads(Path('native-results/simulators.json').read_text())['devices']
# Pin the acceptance runtime rather than accidentally picking tvOS or a beta.
phones = [d for runtime, devices in available.items() if runtime.endswith('iOS-26-2') for d in devices if d.get('isAvailable') and d['name'] == 'iPhone 17']
assert len(phones) == 1, 'Expected one available iPhone 17 / iOS 26.2 simulator'
print(phones[0]['udid'])
PY
)
xcrun simctl boot "$udid"
xcrun simctl bootstatus "$udid" -b
# Preserve failure evidence as well as successful runtime screenshots.
capture_simulator() {
  status=$?
  trap - EXIT
  if ! xcrun simctl io "$udid" screenshot native-results/ios-after-flow.png; then
    printf 'Could not capture simulator screenshot\n' >&2
  fi
  exit "$status"
}
trap capture_simulator EXIT
workspaces=(ios/*.xcworkspace)
test "${#workspaces[@]}" -eq 1
xcodebuild -list -json -workspace "${workspaces[0]}" > native-results/schemes.json
scheme=$(python3 - <<'PY'
import json
from pathlib import Path
schemes = json.loads(Path('native-results/schemes.json').read_text())['workspace']['schemes']
apps = [s for s in schemes if s.lower().replace('-', '').replace(' ', '') == 'wordminenext']
assert len(apps) == 1, f'Expected WordMineNext app scheme; got {schemes}'
print(apps[0])
PY
)
xcodebuild -workspace "${workspaces[0]}" -scheme "$scheme" -configuration Release \
  -sdk iphonesimulator -destination "id=$udid" -derivedDataPath ios-build \
  CODE_SIGNING_ALLOWED=NO build 2>&1 | tee native-results/ios-build.log
apps=(ios-build/Build/Products/Release-iphonesimulator/*.app)
test "${#apps[@]}" -eq 1
xcrun simctl install "$udid" "${apps[0]}"
# Simulator artifacts cannot be installed on physical devices or submitted.
ditto -c -k --sequesterRsrc --keepParent "${apps[0]}" native-results/wordmine-ios-simulator.zip
shasum -a 256 native-results/wordmine-ios-simulator.zip > native-results/ios-simulator.sha256
MAESTRO_CLI_NO_ANALYTICS=1 maestro --device "$udid" test --format junit \
  --output native-results/ios-runtime.xml --debug-output native-results/maestro .maestro/study.yaml
