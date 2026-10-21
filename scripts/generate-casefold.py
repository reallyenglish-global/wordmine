"""Regenerate pinned full casefold data using Python's Unicode 16.0.0 tables.

Generated character data is covered by Unicode License V3 in UNICODE_LICENSE.txt.
No network access. Refuse regeneration on another Unicode version.
"""
import json
from pathlib import Path
import sys
import unicodedata

assert unicodedata.unidata_version == '16.0.0', 'Requires Unicode 16.0.0 Python'
folds = {chr(i): chr(i).casefold() for i in range(sys.maxunicode + 1) if chr(i).casefold() != chr(i)}
whitespace = ''.join(chr(i) for i in range(sys.maxunicode + 1) if chr(i).isspace())
content = json.dumps({'unicodeVersion':'16.0.0','folds':folds,'whitespace':whitespace}, ensure_ascii=True, separators=(',', ':')) + '\n'
path = Path(__file__).resolve().parents[1] / 'src/package/casefold.unicode16.json'
if '--check' in sys.argv:
    assert path.read_text() == content, 'casefold data drift'
else:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)
print(f'{len(folds)} full casefold mappings; Unicode {unicodedata.unidata_version}')
