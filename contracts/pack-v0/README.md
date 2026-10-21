# Experimental offline practice package v0

This is the **synthetic-only WM-PACK-01 consumer subset**, not a deployed publisher protocol, legacy exporter or secure assessment format. It does not change `wordmine.local-pack.v0` or the existing activity schema.

## Stored payload

```text
manifest.json
lists.json
words.json
questions.json
answers.json
assets/tile.png
```

`package.schema.json` is draft 2020-12. Its root validates a manifest; the four other JSON documents use `$defs.lists`, `words`, `questions`, `answers`. Each document repeats `contentVersion`. The manifest declares each payload's relative path, role, MIME type, bytes and SHA-256 over **exact stored bytes** (not reserialized JSON). The manifest does not hash itself. Asset declarations add a unique asset ID and individual rights/provenance.

- **Lists:** stable IDs, localized titles and ordered unique word IDs; multiple lists can reuse a word record.
- **Words:** stable word/sense IDs, language-tagged headword, definitions, translations, examples, optional lexical/calibration metadata and local asset references. Learner items and results are excluded.
- **Questions:** stable IDs, word/sense references, template kind and parameters. Definition prompts resolve from the sense instead of duplicating the word deck. Meaning choices carry independent stable IDs and localized labels.
- **Practice keys:** one matching key per question, separate from prompts. Choice keys point to valid choice IDs; spelling keys explicitly list accepted forms. Offline keys are discoverable and inappropriate for protected exams.
- **Assets:** declared PNG/JPEG/MP3/WAV, checksummed; the current generated colour tile is not meaningful vocabulary imagery. No production content or remote assets are included.

`requiredCapabilities` initially allows `meaning-from-definition@1` and `spelling-from-definition@1`. Unknown required capabilities reject the pack. All eight legacy training families are not claimed as supported. UI language is an app preference; target/explanation languages belong to the package. Mandarin input/answer policies remain undefined.

## Reader and limits

`src/package/reader.ts` consumes an in-memory map of own path keys to byte arrays. It performs structural validation plus identity, ownership, language, capability, answer and asset-reference checks. It returns a frozen content object only on success. It does **not** access filesystem paths, symlinks, archives or URLs; path validation is a format rule, not proof of safe archive extraction.

Limits: 256 KiB manifest, 1,024 payload files, 16 MiB per payload, 128 MiB total declared payload; JSON nesting at most 64. Reject extra/missing files, duplicate JSON keys (including escaped duplicates), non-finite numbers, invalid UTF-8, checksum/size mismatch, duplicate identities and unresolved references. These limits are guards, not measured safe memory budgets for mobile; only the tiny bundled fixture is enabled in the app.

PNG/JPEG/WAV signatures are smoke-checked. Codec/decoding, dimensions/duration, accessibility, MP3 frames, decompression safety and rights verification are **not implemented**. A license/review-status field is an assertion, not permission. Integrity is not authenticity; do not accept arbitrary untrusted packages without a separate trust and installer design.

Closed structures deliberately catch typos and learner-data leakage. Additions need a reviewed schema/consumer version; this is not the existing activity envelope's strip-unknown-fields policy. Package identity for progress is `(packageId, contentVersion, manifest SHA-256, listId)`; changed bytes never silently attach old practice to changed questions. Same ID/version plus different hash uses separate storage rather than overwriting old evidence; catalog conflict/activation policy is not implemented.

`en-nfc-trim-casefold-v1` uses NFC, Unicode **16.0.0** whitespace trimming and full casefold, exact comparison after normalization. Preserve accents, punctuation and internal spaces. Do not replace it with JavaScript lowercasing, legacy accent folding or a Mandarin approximation. The generated mapping includes Unicode License V3. Python generation requires Unicode 16.0.0; no Python is needed to run the app.

## Verification

```sh
npm run typecheck
npm test
npm run contract:check
npx tsx scripts/bundle-package.ts --check
npm run build:web
npm run test:browser
```

The test suite compares generated bundled source bytes to the checked-in fixture; changing payloads requires recalculating the manifest and regenerating with `npx tsx scripts/bundle-package.ts`. Optional table reproducibility: `python3 scripts/generate-casefold.py --check`.

Current UI displays the first list, supports recognition/spelling, locks first answers, preserves its own content-pinned local session, and explicitly labels denied storage as temporary. Original local study storage remains unchanged. ZIP transport/activation, signatures, real-content export, large-pack performance, native package runtime and production trust/rights gates remain separate work.
