// SPDX-License-Identifier: MIT
/**
 * SyncableFS 兼容性测试 —— zen-fs-webdav 后端
 *
 * 验证 `SyncableWebDAVFS` 满足 `zen-fs-sync` 的 `SyncableFS` 接口契约。
 * 端到端部分需要真实 WebDAV 服务器（设置环境变量）；未设置时自动跳过。
 *
 * 环境变量：
 *   WEBDAV_TEST_URL      例如 https://your-webdav.example.com/remote.php/dav/files/user/
 *   WEBDAV_TEST_USERNAME
 *   WEBDAV_TEST_PASSWORD
 *   WEBDAV_TEST_TOKEN     （可选，Bearer token，优先于 username/password）
 */

import { SyncableWebDAVFS } from '../syncable-webdav-fs';
import type { WebDAVOptions } from '../types';
import type { SyncableFS, FileStat } from 'zen-fs-sync';

// ---------------------------------------------------------------------------
// 测试配置
// ---------------------------------------------------------------------------

const testUrl = process.env.WEBDAV_TEST_URL;
const testUsername = process.env.WEBDAV_TEST_USERNAME;
const testPassword = process.env.WEBDAV_TEST_PASSWORD;
const testToken = process.env.WEBDAV_TEST_TOKEN;

const hasServer = Boolean(testUrl);
const conditionalDescribe = hasServer ? describe : describe.skip;

function createOptions(): WebDAVOptions {
  const opts: WebDAVOptions = { baseUrl: testUrl! };
  if (testToken) {
    opts.token = testToken;
  } else if (testUsername && testPassword) {
    opts.auth = { username: testUsername, password: testPassword };
  }
  return opts;
}

function makeFs(): SyncableWebDAVFS {
  return new SyncableWebDAVFS(createOptions());
}

// 兼容本地 isFile / isDirectory 判断（与 zen-fs-sync 一致）
function isFile(stat: FileStat): boolean {
  return (stat.mode & 0o170000) === 0o100000;
}
function isDirectory(stat: FileStat): boolean {
  return (stat.mode & 0o170000) === 0o040000;
}

// ---------------------------------------------------------------------------
// 1. 接口结构静态检查（无需服务器）
// ---------------------------------------------------------------------------

describe('SyncableWebDAVFS interface shape', () => {
  const fs = new SyncableWebDAVFS({ baseUrl: 'https://example.com' });
  const requiredMethods: (keyof SyncableFS)[] = [
    'readFile',
    'writeFile',
    'deleteFile',
    'readdir',
    'mkdir',
    'stat',
    'exists',
    'rename',
  ];

  it('backendName should be "webdav"', () => {
    expect(fs.backendName).toBe('webdav');
  });

  it('should implement all required SyncableFS methods', () => {
    for (const m of requiredMethods) {
      expect(typeof (fs as any)[m]).toBe('function');
    }
  });

  it('should implement optional remote-backend optimizations', () => {
    expect(typeof (fs as any).writeFileWithMtime).toBe('function');
    expect(typeof (fs as any).shouldSync).toBe('function');
    expect(typeof (fs as any).createSnapshot).toBe('function');
  });

  it('should NOT implement onChange (remote backend falls back to polling)', () => {
    expect((fs as any).onChange).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 2. 端到端行为契约（需要真实服务器）
// ---------------------------------------------------------------------------

conditionalDescribe('SyncableWebDAVFS SyncableFS contract (live server)', () => {
  const fs = makeFs();
  const root = `/syncable-compat-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  beforeAll(async () => {
    await fs.mkdir(root, { recursive: true });
  });

  afterAll(async () => {
    try {
      const entries = await fs.readdir(root);
      for (const e of entries) {
        const p = `${root}/${e}`;
        const st = await fs.stat(p);
        if (isDirectory(st)) {
          await fs.deleteFile(`${p}/${e}.mtime`).catch(() => {});
        } else {
          await fs.deleteFile(p);
        }
      }
      await fs.deleteFile(root).catch(() => {});
    } catch {
      /* ignore */
    }
  });

  it('readFile / writeFile round-trip (string)', async () => {
    const path = `${root}/hello.txt`;
    await fs.writeFile(path, 'hello webdav sync');
    const content = await fs.readFile(path);
    expect(content).toBe('hello webdav sync');
  });

  it('writeFile accepts Uint8Array', async () => {
    const path = `${root}/bin.dat`;
    const data = new Uint8Array([1, 2, 3, 4]);
    await fs.writeFile(path, data);
    const read = await fs.readFile(path);
    expect(read).toBeInstanceOf(Uint8Array);
    expect(Array.from(read as Uint8Array)).toEqual([1, 2, 3, 4]);
  });

  it('stat returns FileStat with mode + mtimeMs usable by isFile/isDirectory', async () => {
    const path = `${root}/hello.txt`;
    const stat = await fs.stat(path);
    expect(typeof stat.mode).toBe('number');
    expect(typeof stat.mtimeMs).toBe('number');
    expect(isFile(stat)).toBe(true);
    expect(isDirectory(stat)).toBe(false);
  });

  it('exists reflects file presence', async () => {
    expect(await fs.exists(`${root}/hello.txt`)).toBe(true);
    expect(await fs.exists(`${root}/nope.txt`)).toBe(false);
  });

  it('readdir lists only real files (no .mtime sidecars)', async () => {
    const list = await fs.readdir(root);
    expect(list).toContain('hello.txt');
    expect(list.some((n) => n.endsWith('.mtime'))).toBe(false);
  });

  it('rename moves file and preserves accessibility', async () => {
    const from = `${root}/rename-me.txt`;
    const to = `${root}/renamed.txt`;
    await fs.writeFile(from, 'x');
    await fs.rename(from, to);
    expect(await fs.exists(from)).toBe(false);
    expect(await fs.exists(to)).toBe(true);
    expect(await fs.readFile(to)).toBe('x');
  });

  it('writeFileWithMtime preserves exact mtime (via .mtime sidecar)', async () => {
    const path = `${root}/precise.txt`;
    const fixedMtime = 1_700_000_000_000;
    await fs.writeFileWithMtime(path, 'keep my time', fixedMtime);
    const stat = await fs.stat(path);
    expect(stat.mtimeMs).toBe(fixedMtime);
  });

  it('shouldSync returns a boolean', async () => {
    const result = await fs.shouldSync();
    expect(typeof result).toBe('boolean');
  });

  it('createSnapshot returns Record<path, FileStat> including written files', async () => {
    const snapshot = await fs.createSnapshot(root);
    expect(typeof snapshot).toBe('object');
    const paths = Object.keys(snapshot);
    expect(paths.some((p) => p.endsWith('/hello.txt'))).toBe(true);
    // sidecar 不应出现在快照中
    expect(paths.some((p) => p.endsWith('.mtime'))).toBe(false);
    // 每个条目都是合法 FileStat
    for (const p of paths) {
      const s = snapshot[p];
      expect(typeof s.mode).toBe('number');
      expect(typeof s.mtimeMs).toBe('number');
    }
  });
});
