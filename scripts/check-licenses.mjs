// Fails if any installed package has a license that isn't on the allowlist.
// Package list comes from package-lock.json; licenses from each installed
// package.json. Policy and how to handle failures: docs/LEGAL.md.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Permissive licenses: free to use, only require keeping the notice. */
export const ALLOWED = new Set([
  '0BSD',
  'Apache-2.0',
  'BlueOak-1.0.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'CC0-1.0',
  'ISC',
  'MIT',
  'MIT-0',
  'Python-2.0',
  'Unlicense',
]);

/**
 * Packages reviewed by hand and allowed despite a license outside ALLOWED.
 * Each needs a reason. Only build/test tools belong here, never shipped code.
 */
export const EXCEPTIONS = {
  'caniuse-lite': 'CC-BY-4.0 browser data, used only at build time, not shipped',
};

/** Evaluates simple SPDX expressions like "MIT", "(MIT OR Apache-2.0)", "MIT AND ISC". */
export function isAllowed(expression, allowed = ALLOWED) {
  if (typeof expression !== 'string' || !expression) return false;
  const expr = expression.replace(/[()]/g, '').trim();
  if (expr.includes(' OR ')) return expr.split(' OR ').some((part) => isAllowed(part, allowed));
  if (expr.includes(' AND ')) return expr.split(' AND ').every((part) => isAllowed(part, allowed));
  return allowed.has(expr);
}

/** Reads the license from a package.json, including old `{type}` and `licenses: []` forms. */
export function licenseOf(pkg) {
  if (typeof pkg.license === 'string') return pkg.license;
  if (pkg.license?.type) return pkg.license.type;
  if (Array.isArray(pkg.licenses) && pkg.licenses.length) {
    return pkg.licenses.map((l) => l.type ?? l).join(' OR ');
  }
  return undefined;
}

/** Lists installed packages from a lockfile. Optional packages not installed here are skipped. */
export function collectPackages(lock, rootDir) {
  const packages = [];
  for (const path of Object.keys(lock.packages ?? {})) {
    if (!path) continue; // the project itself
    const manifest = join(rootDir, path, 'package.json');
    if (!existsSync(manifest)) continue;
    const pkg = JSON.parse(readFileSync(manifest, 'utf8'));
    const name = path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length);
    packages.push({ name, version: pkg.version, license: licenseOf(pkg) });
  }
  return packages;
}

/** Returns packages whose license is not allowed and not excepted. */
export function findViolations(packages, allowed = ALLOWED, exceptions = EXCEPTIONS) {
  return packages
    .filter((p) => !Object.hasOwn(exceptions, p.name) && !isAllowed(p.license, allowed))
    .map((p) => ({ ...p, license: p.license ?? 'UNKNOWN' }));
}

export function main(rootDir = '.', log = console.log) {
  const lock = JSON.parse(readFileSync(join(rootDir, 'package-lock.json'), 'utf8'));
  const packages = collectPackages(lock, rootDir);
  const violations = findViolations(packages);
  if (violations.length === 0) {
    log(`Licenses OK (${packages.length} packages checked).`);
    return 0;
  }
  log('Packages with licenses that need review (see docs/LEGAL.md):');
  for (const v of violations) log(`  ${v.name}@${v.version}: ${v.license}`);
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
