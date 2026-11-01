import { packagePayloadFiles, readPackage, type ContentPackage } from './reader';

export type DownloadedPackage = { content: ContentPackage; files: Record<string, Uint8Array>; totalBytes: number };
const MAX_MANIFEST_BYTES = 256 * 1024;
const MAX_PACKAGE_BYTES = 128 * 1024 * 1024;

function safeHttpUrl(value: string): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('Package download failed'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.hash) {
    throw new Error('Package download failed');
  }
  return url;
}

async function responseBytes(response: Response, maximum: number): Promise<Uint8Array> {
  if (!response.ok) throw new Error('Package download failed');
  const length = response.headers.get('content-length');
  if (length && /^\d+$/.test(length) && Number(length) > maximum) throw new Error('Package rejected: response size limit');
  const reader = response.body?.getReader();
  if (!reader) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > maximum) throw new Error('Package rejected: response size limit');
    return bytes;
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximum) {
        await reader.cancel();
        throw new Error('Package rejected: response size limit');
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

/** The manifest host is a trust decision. Browser callers default to this page's origin;
 * callers using another publisher/CDN origin must explicitly allow it.
 */
export type PackageFetchOptions = { allowedOrigins?: readonly string[] };

/** Fetches same-origin payload files and validates the whole package before returning it.
 * SHA-256 checks detect corruption, not publisher authenticity; only use an explicitly trusted origin.
 */
export async function fetchOnlinePackage(
  manifestUrl: string,
  fetcher: typeof fetch = fetch,
  options: PackageFetchOptions = {},
): Promise<DownloadedPackage> {
  const manifestLocation = safeHttpUrl(manifestUrl);
  const allowedOrigins = options.allowedOrigins ?? (typeof location === 'undefined' ? [] : [location.origin]);
  if (!allowedOrigins.includes(manifestLocation.origin)) throw new Error('Package download failed');
  const request = async (url: URL, limit: number) => {
    let response: Response;
    try {
      response = await fetcher(url.href, {method:'GET', cache:'no-store', credentials:'omit', referrerPolicy:'no-referrer', redirect:'error'});
    } catch { throw new Error('Package download failed'); }
    return responseBytes(response, limit);
  };
  const manifestBytes = await request(manifestLocation, MAX_MANIFEST_BYTES);
  const entries = packagePayloadFiles(manifestBytes);
  const files: Record<string, Uint8Array> = {'manifest.json':manifestBytes};
  let totalBytes = manifestBytes.byteLength;
  for (const entry of entries) {
    const location = new URL(entry.path, manifestLocation);
    if (location.origin !== manifestLocation.origin || location.username || location.password || location.hash) {
      throw new Error('Package rejected: unsafe payload URL');
    }
    const bytes = await request(location, Math.min(entry.bytes, 16 * 1024 * 1024));
    if (bytes.byteLength !== entry.bytes) throw new Error('Package rejected: file byte count');
    totalBytes += bytes.byteLength;
    if (totalBytes > MAX_PACKAGE_BYTES) throw new Error('Package rejected: package size limit');
    files[entry.path] = bytes;
  }
  const content = readPackage(files);
  return {content, files, totalBytes};
}

export const packageDownloadKey = (content: ContentPackage): string =>
  `${content.manifest.packageId}:${content.manifest.contentVersion}:${content.manifestHash}`;

export function defaultSamplePackageUrl(base: string): string {
  const url = new URL('./sample-pack/manifest.json', base);
  return url.href;
}
