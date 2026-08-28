import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { parse } from 'dotenv';

type EnvMap = Record<string, string>;

const root = process.cwd();
const dumpDir = path.join(root, 'tmp', 'db-dumps');

function readEnvFile(filePath: string): EnvMap {
  if (!existsSync(filePath)) return {};
  return parse(readFileSync(filePath));
}

function requireValue(value: string | undefined, message: string): string {
  if (value?.trim()) return value.trim();
  throw new Error(message);
}

function parseUrl(value: string, label: string): URL {
  try {
    const url = new URL(value);
    if (!url.protocol.startsWith('postgres')) throw new Error('not postgres');
    return url;
  } catch {
    throw new Error(`${label} must be a valid Postgres connection URL.`);
  }
}

function stripPrismaParams(url: URL): string {
  const pgUrl = new URL(url.toString());
  const allowed = new Set([
    'application_name',
    'channel_binding',
    'connect_timeout',
    'gssencmode',
    'host',
    'options',
    'sslcert',
    'sslkey',
    'sslmode',
    'sslrootcert',
    'target_session_attrs',
  ]);

  for (const key of Array.from(pgUrl.searchParams.keys())) {
    if (!allowed.has(key)) pgUrl.searchParams.delete(key);
  }

  return pgUrl.toString();
}

function localMaintenanceUrl(localUrl: URL): string {
  const maintenanceUrl = new URL(stripPrismaParams(localUrl));
  maintenanceUrl.pathname = '/postgres';
  return maintenanceUrl.toString();
}

function databaseName(url: URL): string {
  const name = decodeURIComponent(url.pathname.replace(/^\//, ''));
  return requireValue(name, 'LOCAL_DATABASE_URL/DATABASE_URL must include a database name.');
}

function quoteIdentifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function isLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0';
}

function run(command: string, args: string[]) {
  execFileSync(command, args, { stdio: 'inherit' });
}

function output(command: string, args: string[]): string {
  return execFileSync(command, args, { encoding: 'utf8' });
}

function createRestoreList(dumpPath: string): string {
  const listPath = `${dumpPath}.toc`;
  const toc = output('pg_restore', ['--list', dumpPath]);
  const filtered = toc
    .split('\n')
    .filter((line) => !/\b(SCHEMA - public|COMMENT - SCHEMA public)\b/.test(line))
    .join('\n');

  writeFileSync(listPath, `${filtered}\n`);
  return listPath;
}

function main() {
  const prodEnv = readEnvFile(path.join(root, '.env.prod'));
  const localEnv = readEnvFile(path.join(root, '.env.local'));

  const prodUrlValue = requireValue(
    process.env.PROD_DATABASE_URL ??
      prodEnv.PROD_DATABASE_URL ??
      prodEnv.DIRECT_URL ??
      prodEnv.DATABASE_URL,
    'Set PROD_DATABASE_URL in .env.prod, or put production DIRECT_URL/DATABASE_URL in .env.prod.',
  );
  const localUrlValue = requireValue(
    process.env.LOCAL_DATABASE_URL ?? localEnv.LOCAL_DATABASE_URL ?? localEnv.DATABASE_URL,
    'Set DATABASE_URL in .env.local to your local Postgres database.',
  );

  const prodUrl = parseUrl(prodUrlValue, 'Production database URL');
  const localUrl = parseUrl(localUrlValue, 'Local database URL');

  if (!isLocalHost(localUrl.hostname) && process.env.ALLOW_NON_LOCAL_RESTORE_TARGET !== '1') {
    throw new Error(
      'Refusing to restore into a non-local database. Point .env.local DATABASE_URL at localhost.',
    );
  }

  if (stripPrismaParams(prodUrl) === stripPrismaParams(localUrl)) {
    throw new Error('Production and local database URLs resolve to the same target.');
  }

  mkdirSync(dumpDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dumpPath = path.join(dumpDir, `kitchenly-prod-${stamp}.dump`);
  const localDbName = quoteIdentifier(databaseName(localUrl));

  console.log('Creating production database dump...');
  run('pg_dump', [
    '--format=custom',
    '--no-owner',
    '--no-privileges',
    '--schema=public',
    '--file',
    dumpPath,
    stripPrismaParams(prodUrl),
  ]);

  console.log('Recreating local database...');
  run('psql', [
    localMaintenanceUrl(localUrl),
    '-v',
    'ON_ERROR_STOP=1',
    '-c',
    `DROP DATABASE IF EXISTS ${localDbName} WITH (FORCE);`,
  ]);
  run('psql', [
    localMaintenanceUrl(localUrl),
    '-v',
    'ON_ERROR_STOP=1',
    '-c',
    `CREATE DATABASE ${localDbName};`,
  ]);

  console.log('Preparing local database extensions...');
  run('psql', [
    stripPrismaParams(localUrl),
    '-v',
    'ON_ERROR_STOP=1',
    '-c',
    'CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public; CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;',
  ]);

  console.log('Restoring dump into local database...');
  const restoreListPath = createRestoreList(dumpPath);
  run('pg_restore', [
    '--no-owner',
    '--no-privileges',
    '--use-list',
    restoreListPath,
    '--dbname',
    stripPrismaParams(localUrl),
    dumpPath,
  ]);

  console.log(`Local database restored. Dump saved at ${path.relative(root, dumpPath)}.`);
}

main();
