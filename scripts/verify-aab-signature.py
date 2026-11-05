"""Fail-closed JAR/AAB signature verification against the trusted upload keystore."""
import subprocess
import sys


def verify_archive(archive, keystore):
    result = subprocess.run(
        ['jarsigner', '-J-Duser.language=en', '-J-Duser.country=US', '-verify', '-strict', '-keystore', keystore,
         '-storepass:env', 'ANDROID_UPLOAD_STORE_PASSWORD', archive],
        capture_output=True, text=True, env=None,
    )
    # jarsigner returns ZERO for a wholly unsigned archive even with -strict.
    # Require its affirmative verification message as well as strict exit status.
    if result.returncode != 0 or 'jar verified.' not in result.stdout.lower():
        raise ValueError('Archive lacks a valid, fully signed trusted JAR signature')
    print('Strict trusted archive signature verified.')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit('Usage: verify-aab-signature.py ARCHIVE KEYSTORE')
    verify_archive(sys.argv[1], sys.argv[2])
