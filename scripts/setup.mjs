import { copyFileSync, readFileSync, constants, mkdtempSync, openSync, closeSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(command, args, outputFd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: outputFd === undefined ? 'inherit' : ['ignore', outputFd, 'inherit'],
      shell: process.platform === 'win32',
      env: { ...process.env, UV_PYTHON_DOWNLOADS: 'never' },
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} 失败，退出码 ${code}`));
    });
  });
}

if (process.versions.node !== manifest.engines.node) {
  throw new Error(`需要 Node.js ${manifest.engines.node}，当前为 ${process.versions.node}；请先运行 nvm install && nvm use。`);
}
// 使用临时文件接收版本，兼容受限云运行器的子进程管道。
const temporary = mkdtempSync(join(tmpdir(), 'ticketpilot-version-'));
let version;
try {
  const filename = join(temporary, 'npm-version');
  const fd = openSync(filename, 'w');
  try {
    await run(npm, ['--version'], fd);
  } finally {
    closeSync(fd);
  }
  version = readFileSync(filename, 'utf8').trim();
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
if (version !== manifest.engines.npm) {
  throw new Error(`需要 npm ${manifest.engines.npm}；请使用匹配的工具版本。`);
}

// ci 严格使用锁文件；清单不一致时失败，不隐式更新依赖。
await run(npm, ['ci']);
// uv.lock 锁定 Python 依赖；不自动下载运行时或修改系统软件。
await run('uv', ['--cache-dir', '.cache/uv', 'sync', '--locked', '--all-groups']);
try {
  copyFileSync(new URL('../.env.example', import.meta.url), new URL('../.env', import.meta.url), constants.COPYFILE_EXCL);
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
}
await run(npm, ['run', 'check']);
console.log('准备完成；现有 .env 已保留。运行 npm test 验证前后端，npm run dev 启动。');
