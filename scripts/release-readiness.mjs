#!/usr/bin/env node

const parse = () => {
  const raw = process.env.WORDMINE_RELEASE_CONFIG;
  if (!raw) throw new Error('WORDMINE_RELEASE_CONFIG must contain a JSON object');
  let value;
  try { value = JSON.parse(raw); } catch { throw new Error('WORDMINE_RELEASE_CONFIG is not valid JSON'); }
  if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('WORDMINE_RELEASE_CONFIG must contain a JSON object');
  return value;
};

const report = (config) => {
  const blockers = [];
  if (typeof config.applicationId !== 'string' || !/^[a-zA-Z][\w]*(\.[a-zA-Z][\w]*)+$/.test(config.applicationId)) blockers.push('applicationId must be a valid reverse-DNS identifier');
  else if (config.applicationId === 'com.reallyenglish.wordmine.prototype') blockers.push('applicationId must not use the prototype identity');
  if (typeof config.version !== 'string' || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(config.version)) blockers.push('version must be semantic X.Y.Z');
  if (!Number.isInteger(config.androidVersionCode) || config.androidVersionCode <= 0) blockers.push('androidVersionCode must be a positive integer');
  if (typeof config.iosBuildNumber !== 'string' || !/^\d+$/.test(config.iosBuildNumber)) blockers.push('iosBuildNumber must be a non-empty numeric string');
  if (config.rightsApproved !== true) blockers.push('rights approval is unresolved');
  if (config.privacyApproved !== true) blockers.push('privacy approval is unresolved');
  return {
    preview: { ready: true, identity: 'prototype; preview only' },
    store: { ready: blockers.length === 0, blockers },
    publication: { authorized: false, note: 'Preflight never authorizes signing, upload, or distribution.' },
  };
};

try {
  const result = report(parse());
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.store.ready ? 0 : 1;
} catch (error) {
  process.stdout.write(`${JSON.stringify({ errors: [error.message] }, null, 2)}\n`);
  process.exitCode = 2;
}
