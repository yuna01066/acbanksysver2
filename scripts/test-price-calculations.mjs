import { build } from 'esbuild';
import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const projectRoot = process.cwd();
const tempDir = await mkdtemp(path.join(tmpdir(), 'acbank-pricing-tests-'));
const outfile = path.join(tempDir, 'pricing-engine-regression.mjs');

const resolveSourcePath = async (sourcePath) => {
  const candidates = [
    sourcePath,
    `${sourcePath}.ts`,
    `${sourcePath}.tsx`,
    `${sourcePath}.js`,
    path.join(sourcePath, 'index.ts'),
    path.join(sourcePath, 'index.tsx'),
  ];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next candidate.
    }
  }

  return sourcePath;
};

try {
  await build({
    entryPoints: [path.join(projectRoot, 'tests/pricing-engine-regression.ts')],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    logLevel: 'silent',
    plugins: [
      {
        name: 'tsconfig-paths-lite',
        setup(buildApi) {
          buildApi.onResolve({ filter: /^@\// }, async args => ({
            path: await resolveSourcePath(path.join(projectRoot, 'src', args.path.slice(2))),
          }));
        },
      },
    ],
  });

  await import(pathToFileURL(outfile).href);
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
