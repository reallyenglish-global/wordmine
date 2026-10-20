#!/usr/bin/env bash
# Must run INSIDE android-emulator-runner, before its post-action kills the AVD.
# Diagnostics are best-effort; never replace the installation/test exit status.
set -uo pipefail
mkdir -p native-results
if adb install -r native-results/wordmine-emulator.apk; then
  maestro test --format junit --output native-results/android-runtime.xml \
    --debug-output native-results/maestro .maestro/study.yaml
  rc=$?
else
  rc=$?
fi
if ! adb logcat -d > native-results/android-logcat.txt; then
  printf 'Could not capture emulator logcat\n' >&2
fi
if ! adb exec-out screencap -p > native-results/android-after-flow.png; then
  printf 'Could not capture emulator screenshot\n' >&2
fi
exit "$rc"
