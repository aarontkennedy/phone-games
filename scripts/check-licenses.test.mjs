import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ALLOWED,
  EXCEPTIONS,
  collectPackages,
  findViolations,
  isAllowed,
  licenseOf,
  main,
} from './check-licenses.mjs';

/** Creates a fake project: { 'node_modules/x': {package.json contents} | null (not installed) }. */
function fakeProject(packages) {
  const root = mkdtempSync(join(tmpdir(), 'licenses-'));
  const lock = { packages: { '': { name: 'root' } } };
  for (const [path, manifest] of Object.entries(packages)) {
    lock.packages[path] = {};
    if (!manifest) continue;
    mkdirSync(join(root, path), { recursive: true });
    writeFileSync(join(root, path, 'package.json'), JSON.stringify(manifest));
  }
  writeFileSync(join(root, 'package-lock.json'), JSON.stringify(lock));
  return { root, lock };
}

describe('isAllowed', () => {
  it('accepts allowlisted licenses', () => {
    expect(isAllowed('MIT')).toBe(true);
    expect(isAllowed('Apache-2.0')).toBe(true);
  });

  it('rejects copyleft, unknown and missing licenses', () => {
    expect(isAllowed('GPL-3.0')).toBe(false);
    expect(isAllowed('SEE LICENSE IN LICENSE.txt')).toBe(false);
    expect(isAllowed(undefined)).toBe(false);
    expect(isAllowed('')).toBe(false);
  });

  it('accepts an OR expression when any option is allowed', () => {
    expect(isAllowed('(MIT OR GPL-3.0)')).toBe(true);
    expect(isAllowed('(GPL-2.0 OR GPL-3.0)')).toBe(false);
  });

  it('requires every part of an AND expression to be allowed', () => {
    expect(isAllowed('(MIT AND ISC)')).toBe(true);
    expect(isAllowed('MIT AND GPL-3.0')).toBe(false);
  });

  it('uses a custom allowlist when given', () => {
    expect(isAllowed('GPL-3.0', new Set(['GPL-3.0']))).toBe(true);
  });
});

describe('licenseOf', () => {
  it('reads the modern string form', () => {
    expect(licenseOf({ license: 'MIT' })).toBe('MIT');
  });

  it('reads the legacy object form', () => {
    expect(licenseOf({ license: { type: 'ISC' } })).toBe('ISC');
  });

  it('reads the legacy array form as alternatives', () => {
    expect(licenseOf({ licenses: [{ type: 'MIT' }, 'Apache-2.0'] })).toBe('MIT OR Apache-2.0');
  });

  it('returns undefined when no license is declared', () => {
    expect(licenseOf({})).toBeUndefined();
    expect(licenseOf({ license: {} })).toBeUndefined();
    expect(licenseOf({ licenses: [] })).toBeUndefined();
  });
});

describe('collectPackages', () => {
  it('reads installed packages, including nested and scoped ones, and skips uninstalled ones', () => {
    const { root, lock } = fakeProject({
      'node_modules/a': { version: '1.0.0', license: 'MIT' },
      'node_modules/a/node_modules/@scope/b': { version: '2.0.0' },
      'node_modules/fsevents': null,
    });
    expect(collectPackages(lock, root)).toEqual([
      { name: 'a', version: '1.0.0', license: 'MIT' },
      { name: '@scope/b', version: '2.0.0', license: undefined },
    ]);
  });

  it('handles a lockfile without packages', () => {
    expect(collectPackages({}, '.')).toEqual([]);
  });
});

describe('findViolations', () => {
  const packages = [
    { name: 'ok', version: '1.0.0', license: 'MIT' },
    { name: 'bad', version: '2.0.0', license: 'GPL-3.0' },
    { name: 'none', version: '3.0.0', license: undefined },
    { name: 'caniuse-lite', version: '1.0.1', license: 'CC-BY-4.0' },
  ];

  it('reports disallowed and missing licenses, skipping exceptions', () => {
    expect(findViolations(packages)).toEqual([
      { name: 'bad', version: '2.0.0', license: 'GPL-3.0' },
      { name: 'none', version: '3.0.0', license: 'UNKNOWN' },
    ]);
  });

  it('accepts a custom allowlist and exceptions', () => {
    expect(findViolations(packages, ALLOWED, { bad: 'reviewed', none: 'reviewed' })).toEqual([
      { name: 'caniuse-lite', version: '1.0.1', license: 'CC-BY-4.0' },
    ]);
  });

  it('documents a reason for every exception', () => {
    for (const reason of Object.values(EXCEPTIONS)) expect(reason.length).toBeGreaterThan(10);
  });
});

describe('main', () => {
  it('returns 0 and reports the count when all licenses pass', () => {
    const { root } = fakeProject({ 'node_modules/x': { version: '1.0.0', license: 'MIT' } });
    const lines = [];
    expect(main(root, (l) => lines.push(l))).toBe(0);
    expect(lines).toEqual(['Licenses OK (1 packages checked).']);
  });

  it('returns 1 and lists violations', () => {
    const { root } = fakeProject({ 'node_modules/x': { version: '1.0.0', license: 'GPL-3.0' } });
    const lines = [];
    expect(main(root, (l) => lines.push(l))).toBe(1);
    expect(lines[1]).toBe('  x@1.0.0: GPL-3.0');
  });

  it('passes on the real project', () => {
    expect(main('.', () => {})).toBe(0);
  });
});
