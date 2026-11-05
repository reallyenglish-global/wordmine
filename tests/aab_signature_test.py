"""Exercise the real JDK verifier: signed, unsigned, injected and wrong signer."""
import importlib.util
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location('aab_verify', Path(__file__).parents[1] / 'scripts/verify-aab-signature.py')
assert spec is not None and spec.loader is not None
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ArchiveSignatureTests(unittest.TestCase):
    def test_real_signatures_fail_closed(self):
        with tempfile.TemporaryDirectory(prefix='wm-signature-test-') as directory:
            root = Path(directory)
            password = 'temporary-test-password-not-a-real-secret'
            old = os.environ.get('ANDROID_UPLOAD_STORE_PASSWORD')
            os.environ['ANDROID_UPLOAD_STORE_PASSWORD'] = password
            try:
                for name in ['expected', 'other']:
                    subprocess.run(['keytool', '-genkeypair', '-keystore', str(root / (name+'.p12')),
                                    '-storetype', 'PKCS12', '-storepass:env', 'ANDROID_UPLOAD_STORE_PASSWORD',
                                    '-alias', 'upload', '-keyalg', 'RSA', '-keysize', '2048',
                                    '-validity', '2', '-dname', 'CN=Temporary Test', '-noprompt'], check=True, capture_output=True)
                unsigned = root / 'unsigned.jar'
                with zipfile.ZipFile(unsigned, 'w') as archive:
                    archive.writestr('payload.txt', 'test data')
                for name, signer in [('signed', 'expected'), ('wrong', 'other')]:
                    target = root / (name+'.jar')
                    shutil.copyfile(unsigned, target)
                    subprocess.run(['jarsigner', '-keystore', str(root / (signer+'.p12')),
                                    '-storepass:env', 'ANDROID_UPLOAD_STORE_PASSWORD', str(target), 'upload'], check=True, capture_output=True)
                trusted = str(root / 'expected.p12')
                module.verify_archive(str(root / 'signed.jar'), trusted)
                injected = root / 'injected.jar'
                shutil.copyfile(root / 'signed.jar', injected)
                with zipfile.ZipFile(injected, 'a') as archive:
                    archive.writestr('unsigned-injection.txt', 'test data')
                for name in ['unsigned.jar', 'injected.jar', 'wrong.jar']:
                    with self.subTest(name=name), self.assertRaises(ValueError):
                        module.verify_archive(str(root / name), trusted)
            finally:
                if old is None:
                    os.environ.pop('ANDROID_UPLOAD_STORE_PASSWORD', None)
                else:
                    os.environ['ANDROID_UPLOAD_STORE_PASSWORD'] = old


if __name__ == '__main__':
    unittest.main()
