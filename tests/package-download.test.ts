import assert from 'node:assert/strict';
import test from 'node:test';
import { syntheticFiles } from '../src/package/synthetic.generated';
import { encodeUtf8 } from '../src/package/bytes';
import { fetchOnlinePackage, packageDownloadKey } from '../src/package/download';

type PackageFiles = Record<string, Uint8Array>;
function fixture(): PackageFiles {
  return Object.fromEntries(Object.entries(syntheticFiles).map(([name, data]) =>
    [name, typeof data === 'string' ? encodeUtf8(data) : Uint8Array.from(data)]));
}
function manifestEntries(files: PackageFiles): { path: string; bytes: number }[] {
  const manifest = JSON.parse(new TextDecoder().decode(files['manifest.json']));
  return manifest.files.map((file: { path: string; bytes: number }) => ({ path: file.path, bytes: file.bytes }));
}
function fixtureFetcher(files: PackageFiles, requests: { url: string; init?: RequestInit }[]): typeof fetch {
  return async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    requests.push({ url: url.href, init });
    const prefix = '/packs/synthetic/';
    const name = url.pathname.startsWith(prefix) ? url.pathname.slice(prefix.length) : '';
    const payload = files[name];
    if (!payload) return new Response('missing fixture', { status: 404 });
    const body = new ArrayBuffer(payload.byteLength);
    new Uint8Array(body).set(payload);
    return new Response(body, { status: 200 });
  };
}

const manifestUrl = 'https://wordmine.test/packs/synthetic/manifest.json';
const fetchFixturePackage = (files: PackageFiles, requests: { url: string; init?: RequestInit }[] = []) =>
  fetchOnlinePackage(manifestUrl, fixtureFetcher(files, requests), {allowedOrigins:[new URL(manifestUrl).origin]});

test('non-browser fetch fails closed when no origin allowlist is configured', async () => {
  let requests = 0;
  const fetcher: typeof fetch = async () => {
    requests++;
    return new Response(new ArrayBuffer(0), {status:200});
  };
  await assert.rejects(fetchOnlinePackage(manifestUrl, fetcher));
  assert.equal(requests, 0);
});

test('a manifest outside the explicit origin allowlist is rejected before requesting it', async () => {
  let requests = 0;
  const fetcher: typeof fetch = async () => {
    requests++;
    return new Response(new ArrayBuffer(0), {status:200});
  };
  await assert.rejects(fetchOnlinePackage('https://untrusted.example/packs/manifest.json', fetcher,
    {allowedOrigins:[new URL(manifestUrl).origin]}));
  assert.equal(requests, 0);
});

test('online package fetch downloads only declared same-origin files and validates before returning', async () => {
  const files = fixture();
  const requests: { url: string; init?: RequestInit }[] = [];
  const result = await fetchFixturePackage(files, requests);

  assert.equal(result.content.manifest.packageId, 'pack.synthetic-harbor');
  assert.equal(result.content.manifestHash.length, 64);
  assert.deepEqual(Object.keys(result.files).sort(), Object.keys(files).sort());
  assert.deepEqual(requests.map(({ url }) => new URL(url).pathname).sort(),
    ['/packs/synthetic/manifest.json', ...manifestEntries(files).map(({ path }) => `/packs/synthetic/${path}`)].sort());
  for (const request of requests) {
    assert.equal(request.init?.credentials, 'omit');
    assert.equal(request.init?.referrerPolicy, 'no-referrer');
    assert.equal(request.init?.redirect, 'error');
    assert.equal(request.init?.cache, 'no-store');
  }
});

test('online package fetch rejects a checksum mismatch instead of returning partial content', async () => {
  const files = fixture();
  files['words.json'] = Uint8Array.from(files['words.json']);
  files['words.json'][0] ^= 1;
  const requests: { url: string; init?: RequestInit }[] = [];

  await assert.rejects(fetchFixturePackage(files, requests), /Package rejected/);
  assert.equal(requests.length, 6);
});

test('online package fetch rejects unsafe manifest paths before requesting them', async () => {
  const files = fixture();
  const raw = JSON.parse(new TextDecoder().decode(files['manifest.json']));
  raw.files[0].path = '../outside.json';
  files['manifest.json'] = encodeUtf8(JSON.stringify(raw));
  const requests: { url: string; init?: RequestInit }[] = [];

  await assert.rejects(fetchFixturePackage(files, requests), /Package rejected/);
  assert.equal(requests.length, 1);
});

test('online package fetch enforces the manifest response bound without trusting Content-Length', async () => {
  let requests = 0;
  const fetcher: typeof fetch = async () => {
    requests++;
    return new Response(new ArrayBuffer(256 * 1024 + 1), {status:200});
  };
  await assert.rejects(fetchOnlinePackage(manifestUrl, fetcher, {allowedOrigins:[new URL(manifestUrl).origin]}), /response size limit/);
  assert.equal(requests, 1);
});

test('online package fetch replaces network exceptions with a content-free error', async () => {
  const fetcher: typeof fetch = async () => { throw new Error('request failed for https://private.test/?token=secret'); };
  let message = '';
  try { await fetchOnlinePackage(manifestUrl, fetcher, {allowedOrigins:[new URL(manifestUrl).origin]}); } catch (error) { message = (error as Error).message; }
  assert.equal(message, 'Package download failed');
  assert.equal(message.includes('secret'), false);
});

test('download key pins package identity and manifest content hash', async () => {
  const files = fixture();
  const result = await fetchFixturePackage(files);
  assert.equal(packageDownloadKey(result.content),
    `pack.synthetic-harbor:0.1.0:${result.content.manifestHash}`);
});
