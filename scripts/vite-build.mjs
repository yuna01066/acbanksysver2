import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const viteBin = path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const scriptPath = fileURLToPath(import.meta.url);
const requireFromProject = createRequire(path.join(projectRoot, 'package.json'));

const codexRuntimeNode = path.join(
  os.homedir(),
  '.cache',
  'codex-runtimes',
  'codex-primary-runtime',
  'dependencies',
  'node',
  'bin',
  'node',
);

const fallbackNodes = [process.env.VITE_BUILD_NODE, codexRuntimeNode].filter(Boolean);

const rollupNativeCheck = checkRollupNativeLoad();
if (!rollupNativeCheck.ok && shouldReexecForMacCodeSigning(rollupNativeCheck.error)) {
  const compatibleNode = fallbackNodes.find(
    (nodePath) => nodePath !== process.execPath && existsSync(nodePath),
  );

  if (compatibleNode && process.env.VITE_BUILD_REEXEC !== '1') {
    const result = spawnSync(compatibleNode, [scriptPath, ...process.argv.slice(2)], {
      cwd: projectRoot,
      env: { ...process.env, VITE_BUILD_REEXEC: '1' },
      stdio: 'inherit',
    });
    exitFromSpawnResult(result);
  }
}

const result = spawnSync(process.execPath, [viteBin, 'build', ...process.argv.slice(2)], {
  cwd: projectRoot,
  env: process.env,
  stdio: 'inherit',
});
exitFromSpawnResult(result);

function checkRollupNativeLoad() {
  if (process.platform !== 'darwin') {
    return { ok: true };
  }

  try {
    requireFromProject(`@rollup/rollup-darwin-${process.arch}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

function shouldReexecForMacCodeSigning(error) {
  const message = collectErrorText(error);
  return (
    message.includes('different Team IDs') ||
    (message.includes('code signature') && message.includes('not valid for use in process'))
  );
}

function collectErrorText(error) {
  if (!error || typeof error !== 'object') {
    return String(error ?? '');
  }

  const parts = [];
  let current = error;
  while (current && typeof current === 'object') {
    parts.push(String(current.message ?? ''));
    current = current.cause;
  }
  return parts.join('\n');
}

function exitFromSpawnResult(result) {
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.signal) {
    process.kill(process.pid, result.signal);
    return;
  }

  process.exit(result.status ?? 1);
}
