#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { parseReplayInput, replaySnapshots } = require('../cred-shadow/replay');

const MAX_INPUT_BYTES = 64 * 1024 * 1024;
const DATABASE_EXTENSIONS = new Set(['.db', '.sqlite', '.sqlite3']);

function fail(message) {
  throw new Error(message);
}

function parseArguments(argv) {
  const result = { input: null, output: null, pretty: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--pretty') {
      if (result.pretty) fail('duplicate --pretty flag');
      result.pretty = true;
      continue;
    }
    if (argument !== '--input' && argument !== '--output') fail('unknown flag: ' + argument);
    const key = argument.slice(2);
    if (result[key] !== null) fail('duplicate ' + argument + ' flag');
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) fail(argument + ' requires a path');
    result[key] = value;
    index += 1;
  }
  if (result.input === null || result.output === null) fail('usage: cred:shadow:replay --input <json|jsonl> --output <json> [--pretty]');
  return result;
}

function localPath(value, label) {
  if (value === '-' || /^[a-z][a-z0-9+.-]*:/iu.test(value)) fail(label + ' must be a local file path; stdin and URLs are forbidden');
  if (DATABASE_EXTENSIONS.has(path.extname(value).toLowerCase())) fail(label + ' must not be a database path');
  return path.resolve(value);
}

function readInput(filename) {
  let descriptor;
  try {
    const before = fs.lstatSync(filename);
    if (before.isSymbolicLink()) fail('input symlinks are forbidden');
    if (!before.isFile()) fail('input must be a regular file');
    if (before.size > MAX_INPUT_BYTES) fail('input exceeds 64 MiB');
    descriptor = fs.openSync(filename, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    const stat = fs.fstatSync(descriptor);
    if (!stat.isFile()) fail('input must be a regular file');
    if (stat.size > MAX_INPUT_BYTES) fail('input exceeds 64 MiB');
    const bytes = fs.readFileSync(descriptor);
    if (bytes.length > MAX_INPUT_BYTES) fail('input exceeds 64 MiB');
    return bytes.toString('utf8');
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

function assertOutputPath(filename) {
  if (path.extname(filename).toLowerCase() !== '.json') fail('output must be a .json file');
  try {
    fs.lstatSync(filename);
    fail('output already exists');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const parent = path.dirname(filename);
  const parentStat = fs.lstatSync(parent);
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink()) fail('output parent must be a real directory');
}

function atomicNoClobberWrite(filename, bytes) {
  assertOutputPath(filename);
  const parent = path.dirname(filename);
  const temporary = path.join(parent, '.' + path.basename(filename) + '.' + process.pid + '.' + randomBytes(12).toString('hex') + '.tmp');
  let descriptor;
  try {
    descriptor = fs.openSync(temporary, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
    fs.writeFileSync(descriptor, bytes, { encoding: 'utf8' });
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;
    fs.linkSync(temporary, filename);
    fs.unlinkSync(temporary);
    const directory = fs.openSync(parent, fs.constants.O_RDONLY);
    try { fs.fsyncSync(directory); } finally { fs.closeSync(directory); }
  } catch (error) {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    try { fs.unlinkSync(temporary); } catch (cleanup) { if (cleanup.code !== 'ENOENT') throw cleanup; }
    if (error.code === 'EEXIST') fail('output already exists');
    throw error;
  }
}

function main(argv) {
  const args = parseArguments(argv);
  const input = localPath(args.input, 'input');
  const output = localPath(args.output, 'output');
  const text = readInput(input);
  const rows = parseReplayInput(text, input);
  const report = replaySnapshots(rows);
  const bytes = JSON.stringify(report, null, args.pretty ? 2 : 0) + '\n';
  atomicNoClobberWrite(output, bytes);
}

try {
  main(process.argv.slice(2));
} catch (error) {
  process.stderr.write('cred shadow replay: ' + error.message + '\n');
  process.exitCode = 1;
}
