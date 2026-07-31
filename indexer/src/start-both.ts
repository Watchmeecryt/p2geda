/**
 * Railway entrypoint: run the event indexer and the yield/draw keeper in one
 * deployment, sharing the same env. If either child exits, tear the other down
 * so the platform restarts a healthy pair.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const tsxCli = resolve(root, 'node_modules/tsx/dist/cli.mjs');

const children: ChildProcess[] = [];
let shuttingDown = false;

function start(name: string, script: string): ChildProcess {
  const child = spawn(process.execPath, [tsxCli, script], {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  });

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    console.error(
      `[start-both] ${name} exited (code=${code ?? 'null'} signal=${signal ?? 'null'}) — stopping sibling`,
    );
    shutdown(code && code !== 0 ? code : 1);
  });

  children.push(child);
  console.log(`[start-both] started ${name} (pid ${child.pid})`);
  return child;
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  // Hard-exit shortly after SIGTERM so Railway does not hang on a stuck child.
  setTimeout(() => process.exit(exitCode), 5_000).unref();
}

process.on('SIGTERM', () => shutdown(0));
process.on('SIGINT', () => shutdown(0));

console.log('[start-both] launching indexer + keeper on shared env');
start('indexer', 'src/run.ts');
start('keeper', 'src/keeper.ts');
