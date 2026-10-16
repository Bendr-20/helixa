import { createHash } from 'node:crypto';
import { closeSync, constants, fstatSync, lstatSync, openSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';

export class MissionArtifactError extends Error {
  constructor(code, message) { super(message); this.name = 'MissionArtifactError'; this.code = code; }
}

export function createMissionArtifactReader({ root, maxFiles = 100, maxTotalBytes = 20 * 1024 * 1024, maxFileBytes = 1024 * 1024 } = {}) {
  if (typeof root !== 'string' || !path.isAbsolute(root)) throw new TypeError('Artifact root must be absolute.');
  const rootReal = realpathSync(root);
  if (!statSync(rootReal).isDirectory()) throw new TypeError('Artifact root must be a directory.');
  const fileLimit = boundedInteger(maxFiles, 'maxFiles', 1, 10_000);
  const totalLimit = boundedInteger(maxTotalBytes, 'maxTotalBytes', 1, 1024 * 1024 * 1024);
  const perFileLimit = boundedInteger(maxFileBytes, 'maxFileBytes', 1, totalLimit);

  function read(relativePath) {
    const normalized = safeRelativePath(relativePath);
    const absolute = checkedPath(normalized);
    const opened = openRegular(absolute);
    try {
      if (opened.stat.size > perFileLimit) throw new MissionArtifactError('artifact_too_large', 'Artifact exceeds the per-file byte limit.');
      const content = readFileSync(opened.fd);
      return Object.freeze({ path: normalized, size: opened.stat.size, sha256: digest(content), content });
    } finally { closeSync(opened.fd); }
  }

  function list() {
    const files = [];
    let totalBytes = 0;
    walk(rootReal, '');
    return Object.freeze({ files: Object.freeze(files), totalBytes });

    function walk(directory, prefix) {
      const actual = realpathSync(directory);
      assertUnderRoot(actual);
      for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        if (entry.name === '.' || entry.name === '..' || entry.name.includes('\0')) throw new MissionArtifactError('artifact_path_invalid', 'Artifact entry name is invalid.');
        const absolute = path.join(directory, entry.name);
        const stat = lstatSync(absolute);
        if (stat.isSymbolicLink()) throw new MissionArtifactError('artifact_symlink_denied', 'Artifact symlinks are not allowed.');
        const relative = prefix ? prefix + '/' + entry.name : entry.name;
        if (stat.isDirectory()) { walk(absolute, relative); continue; }
        if (!stat.isFile()) throw new MissionArtifactError('artifact_type_denied', 'Only regular artifact files are allowed.');
        if (stat.nlink !== 1) throw new MissionArtifactError('artifact_hardlink_denied', 'Hard-linked artifacts are not allowed.');
        if (stat.size > perFileLimit) throw new MissionArtifactError('artifact_too_large', 'Artifact exceeds the per-file byte limit.');
        totalBytes += stat.size;
        if (totalBytes > totalLimit) throw new MissionArtifactError('artifact_total_too_large', 'Artifact output exceeds the total byte limit.');
        if (files.length >= fileLimit) throw new MissionArtifactError('artifact_count_exceeded', 'Artifact output exceeds the file-count limit.');
        const opened = openRegular(absolute);
        try {
          const content = readFileSync(opened.fd);
          files.push(Object.freeze({ path: relative, size: opened.stat.size, sha256: digest(content) }));
        } finally { closeSync(opened.fd); }
      }
    }
  }

  function checkedPath(relative) {
    const segments = relative.split('/');
    let current = rootReal;
    for (const segment of segments) {
      current = path.join(current, segment);
      const stat = lstatSync(current);
      if (stat.isSymbolicLink()) throw new MissionArtifactError('artifact_symlink_denied', 'Artifact symlinks are not allowed.');
      if (current !== path.join(rootReal, ...segments) && !stat.isDirectory()) throw new MissionArtifactError('artifact_path_invalid', 'Artifact parent must be a directory.');
    }
    assertUnderRoot(current);
    return current;
  }

  function assertUnderRoot(value) {
    const relative = path.relative(rootReal, value);
    if (relative === '..' || relative.startsWith('../') || path.isAbsolute(relative)) throw new MissionArtifactError('artifact_traversal_denied', 'Artifact path escapes its output root.');
  }

  return Object.freeze({ list, read, root: rootReal });
}

function openRegular(absolute) {
  let fd;
  try { fd = openSync(absolute, constants.O_RDONLY | (constants.O_NOFOLLOW || 0)); }
  catch (error) { throw new MissionArtifactError('artifact_open_failed', 'Artifact could not be opened safely: ' + error.code); }
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile()) throw new MissionArtifactError('artifact_type_denied', 'Only regular artifact files are allowed.');
    if (stat.nlink !== 1) throw new MissionArtifactError('artifact_hardlink_denied', 'Hard-linked artifacts are not allowed.');
    return { fd, stat };
  } catch (error) { closeSync(fd); throw error; }
}
function safeRelativePath(value) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 512 || value.includes('\0') || value.includes(String.fromCharCode(92)) || path.isAbsolute(value)) throw new MissionArtifactError('artifact_path_invalid', 'Artifact path is invalid.');
  const segments = value.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) throw new MissionArtifactError('artifact_traversal_denied', 'Artifact path traversal is not allowed.');
  return segments.join('/');
}
function digest(content) { return createHash('sha256').update(content).digest('hex'); }
function boundedInteger(value, label, min, max) { if (!Number.isSafeInteger(value) || value < min || value > max) throw new TypeError(label + ' is invalid.'); return value; }
