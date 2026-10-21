import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

export function requireValid(value: unknown, message: string): asserts value {
  if (!value) throw new Error(`Package rejected: ${message}`);
}
// Portable to Hermes: deliberately do not depend on DOM TextEncoder/TextDecoder or Node Buffer.
export function encodeUtf8(text: string): Uint8Array {
  const encoded = encodeURIComponent(text);
  const bytes: number[] = [];
  for (let i = 0; i < encoded.length; i++) {
    if (encoded[i] === '%') { bytes.push(parseInt(encoded.slice(i + 1, i + 3), 16)); i += 2; }
    else bytes.push(encoded.charCodeAt(i));
  }
  return Uint8Array.from(bytes);
}
export const hashBytes = (bytes: Uint8Array) => bytesToHex(sha256(bytes));

/** Reject duplicates (including escaped keys) before allowing JSON into schema validation. */
export function parseJson(bytes: Uint8Array): unknown {
  let text: string;
  try { text = decodeURIComponent(Array.from(bytes, b => `%${b.toString(16).padStart(2, '0')}`).join('')); }
  catch { throw new Error('Package rejected: invalid UTF-8'); }
  const value: unknown = JSON.parse(text);
  const tokens = text.match(/"(?:\\.|[^"\\])*"|true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}\[\],:]/g) ?? [];
  let index = 0;
  function visit(depth: number) {
    requireValid(depth <= 64, 'JSON nesting limit');
    const token = tokens[index++];
    if (token === '{') {
      const keys = new Set<string>();
      while (tokens[index] !== '}') {
        const key = JSON.parse(tokens[index++]) as string;
        requireValid(!keys.has(key), 'duplicate JSON key'); keys.add(key);
        index++; // colon; JSON.parse already validated syntax
        visit(depth + 1);
        if (tokens[index] === ',') index++;
      }
      index++;
    } else if (token === '[') {
      while (tokens[index] !== ']') { visit(depth + 1); if (tokens[index] === ',') index++; }
      index++;
    } else if (/^-?\d/.test(token)) requireValid(Number.isFinite(Number(token)), 'nonfinite JSON number');
  }
  visit(0);
  return value;
}
