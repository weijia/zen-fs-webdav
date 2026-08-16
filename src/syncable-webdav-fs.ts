/**
 * SyncableWebDAVFS
 *
 * 将 `zen-fs-webdav` 的 `WebDAVFS` 适配为 `zen-fs-sync` 的 `SyncableFS` 接口，
 * 使 WebDAV 后端可直接接入 zen-fs-sync 同步引擎（单向 / 双向同步、watch 模式）。
 *
 * 设计原则：
 *  - 以 **适配器** 形式包装现有 `WebDAVFS`，不改动原有 API，向后兼容。
 *  - 处理类型差异：
 *      · `stat()` 返回 `Stats`，需补充 `mode` / `mtimeMs` 以满足 `isFile()` / `isDirectory()` 判断。
 *      · `writeFile` 接受 `Buffer | string`，`SyncableFS` 要求 `string | Uint8Array`。
 *      · `writeFile` 返回 `WebDAVResult`，`SyncableFS` 要求 `Promise<void>`。
 *  - WebDAV 为远程后端，额外实现：
 *      · `writeFileWithMtime` —— 用 `.mtime` sidecar 文件保留精确 mtime（服务端会改写 Last-Modified）。
 *      · `shouldSync` —— 基于根目录 PROPFIND 的 ETag 基准，避免每次全量扫描。
 *      · `createSnapshot` —— 基于 `readDir` 批量获取，构建高效快照。
 *  - 远程后端不支持文件系统事件，故 **不实现** `onChange`，由同步引擎回退到轮询。
 */

import { WebDAVFS } from './webdav-fs';
import { WebDAVOptions, Stats } from './types';
import { normalizePath } from './utils';

// zen-fs-sync 仅用于类型（import type），运行时不依赖。
import type { SyncableFS, FileStat, FileSnapshot } from 'zen-fs-sync';

// --------------------------------------------------------------------------
// 常量
// --------------------------------------------------------------------------

/** 保存精确 mtime 的 sidecar 文件后缀。 */
const MTIME_SIDECAR_SUFFIX = '.mtime';

/** 文件类型 mode（与 zen-fs-sync 的 isFile / isDirectory 判断保持一致）。 */
const S_IFREG = 0o100000; // 普通文件
const S_IFDIR = 0o040000; // 目录

// --------------------------------------------------------------------------
// 辅助函数
// --------------------------------------------------------------------------

/**
 * 将 `WebDAVFS` 的 `Stats` 转换为 `zen-fs-sync` 的 `FileStat`。
 *
 * 关键差异：
 *  - `Stats` 用 `isDirectory: boolean` 表达类型；`FileStat` 用 `mode`（由 `isFile()` / `isDirectory()` 判断）。
 *  - `Stats.lastModified` 是 `Date`；`FileStat.mtimeMs` 是毫秒时间戳（number）。
 */
function toFileStat(stat: Stats): FileStat {
  const isDirectory = stat.isDirectory;
  const mtimeMs = stat.lastModified ? stat.lastModified.getTime() : Date.now();

  return {
    mode: isDirectory ? S_IFDIR : S_IFREG,
    size: stat.size,
    mtimeMs,
  };
}

/** 判断是否为 `.mtime` sidecar 文件。 */
function isMtimeSidecar(path: string): boolean {
  return path.endsWith(MTIME_SIDECAR_SUFFIX);
}

/** 计算某文件路径对应的 `.mtime` sidecar 路径。 */
function mtimeSidecarPathFor(path: string): string {
  return `${path}${MTIME_SIDECAR_SUFFIX}`;
}

/** 将 `string | Uint8Array` 转为 `WebDAVFS.writeFile` 接受的 `Buffer | string`。 */
function toWriteData(data: string | Uint8Array): Buffer | string {
  if (typeof data === 'string') {
    return data;
  }
  // 浏览器 / Node 兼容：优先用 Buffer，否则 Uint8Array
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(data);
  }
  return data as unknown as string;
}

// --------------------------------------------------------------------------
// 适配器类
// --------------------------------------------------------------------------

export class SyncableWebDAVFS implements SyncableFS {
  readonly backendName = 'webdav';

  private readonly fs: WebDAVFS;

  // shouldSync 使用的 ETag 基准快照
  private rootEtag: string | null = null;

  constructor(options: WebDAVOptions) {
    this.fs = new WebDAVFS(options);
  }

  // ------------------------------------------------------------------------
  // 必需方法
  // ------------------------------------------------------------------------

  readFile(path: string, encoding: BufferEncoding): Promise<string>;
  readFile(path: string): Promise<Buffer>;
  async readFile(path: string, _encoding?: BufferEncoding): Promise<string | Buffer> {
    const data = await this.fs.readFile(path);
    if (typeof data === 'string') {
      return data;
    }
    // Buffer -> Uint8Array（浏览器安全）
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(data)) {
      return data;
    }
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(data);
    }
    return data as unknown as Buffer;
  }

  async writeFile(path: string, data: string | Uint8Array): Promise<void> {
    const result = await this.fs.writeFile(path, toWriteData(data));
    if (!result.success) {
      throw new Error(`WebDAV writeFile failed: ${path} (status ${result.statusCode})`);
    }
  }

  async unlink(path: string): Promise<void> {
    await this.fs.unlink(path);
  }

  async readdir(path: string): Promise<string[]> {
    const entries = await this.fs.readDir(path, { includeHidden: true });
    return entries.filter(entry => !isMtimeSidecar(entry.name)).map(entry => entry.name);
  }

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    await this.fs.mkdir(path, { recursive: options?.recursive });
  }

  async stat(path: string): Promise<FileStat> {
    const s = await this.fs.stat(path);
    if (isMtimeSidecar(path)) {
      // sidecar 本身不应被当作普通文件暴露；这里仍返回真实 stat，
      // 但上层不会主动 stat sidecar（已在 readdir 过滤）。
      return toFileStat(s);
    }
    const stat = toFileStat(s);
    // 若 sidecar 存在，以其记录的 mtime 覆盖服务端被改写的 Last-Modified
    try {
      const sidecar = await this.fs.readFile(mtimeSidecarPathFor(path));
      const raw = typeof sidecar === 'string' ? sidecar : new TextDecoder().decode(sidecar);
      const mtimeMs = Number(raw.trim());
      if (Number.isFinite(mtimeMs) && mtimeMs > 0) {
        stat.mtimeMs = mtimeMs;
      }
    } catch {
      // 无 sidecar —— 使用服务端 stat 的 mtime
    }
    return stat;
  }

  async exists(path: string): Promise<boolean> {
    return this.fs.exists(path);
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    await this.fs.rename(oldPath, newPath);
    // 同步移动 sidecar（若原文件有）
    try {
      if (await this.fs.exists(mtimeSidecarPathFor(oldPath))) {
        const sidecarData = await this.fs.readFile(mtimeSidecarPathFor(oldPath));
        await this.fs.writeFile(mtimeSidecarPathFor(newPath), sidecarData);
        await this.fs.unlink(mtimeSidecarPathFor(oldPath));
      }
    } catch {
      // sidecar 移动失败不阻断主流程
    }
  }

  // ------------------------------------------------------------------------
  // 可选方法（远程后端优化）
  // ------------------------------------------------------------------------

  /**
   * 写入文件内容并保留精确的 mtime。
   *
   * WebDAV 服务端的 Last-Modified 通常会被服务器自身改写，导致同步引擎
   * 每次都误判为「已修改」。这里将精确 mtime 存入 `.mtime` sidecar 文件，
   * `stat()` 会优先读取它，从而保证 `FileSnapshot` 比较的准确性。
   */
  async writeFileWithMtime(
    path: string,
    data: string | Uint8Array,
    mtimeMs: number,
  ): Promise<void> {
    await this.writeFile(path, data);
    // 写入 sidecar（内容即毫秒时间戳）
    const payload = String(mtimeMs);
    const result = await this.fs.writeFile(
      mtimeSidecarPathFor(path),
      typeof Buffer !== 'undefined' ? Buffer.from(payload) : payload,
    );
    if (!result.success) {
      throw new Error(`WebDAV writeFileWithMtime sidecar failed: ${path}`);
    }
  }

  /**
   * 基于根目录 PROPFIND 的 ETag 判断是否发生了远端变更，避免每次全量扫描。
   *
   * 首次调用会建立基准（返回 true 触发初次全量同步）；后续仅在根目录 ETag
   * 变化时返回 true。
   */
  async shouldSync(): Promise<boolean> {
    try {
      const rootStat = await this.fs.stat('/');
      const currentEtag = rootStat.etag ?? null;

      if (this.rootEtag === null) {
        // 首次调用：建立基准
        this.rootEtag = currentEtag;
        return true;
      }

      if (currentEtag !== null && currentEtag === this.rootEtag) {
        return false;
      }

      // 根 ETag 变化（或无 ETag）→ 需要同步
      this.rootEtag = currentEtag;
      return true;
    } catch {
      // 任何异常都倾向于同步，保证数据安全
      return true;
    }
  }

  /**
   * 通过一次 PROPFIND（Depth=infinity）批量获取整个目录树的快照。
   *
   * 比逐个 stat 高效得多，适合远程后端。sidecar 文件会被过滤掉。
   * 返回 Map<相对路径, FileSnapshot>（与 zen-fs-sync 的 createSnapshot 签名一致）。
   */
  async createSnapshot(rootPath = '/'): Promise<Map<string, FileSnapshot> | null> {
    try {
      const normalizedRoot = normalizePath(rootPath);
      const entries = await this.fs.readDir(normalizedRoot, {
        recursive: true,
        includeHidden: true,
      });

      const snapshot = new Map<string, FileSnapshot>();
      for (const entry of entries) {
        if (isMtimeSidecar(entry.path)) {
          continue;
        }
        const stat = toFileStat(entry);
        // 尝试读取 sidecar 以获得精确 mtime
        try {
          const sidecar = await this.fs.readFile(mtimeSidecarPathFor(entry.path));
          const raw = typeof sidecar === 'string' ? sidecar : new TextDecoder().decode(sidecar);
          const mtimeMs = Number(raw.trim());
          if (Number.isFinite(mtimeMs) && mtimeMs > 0) {
            stat.mtimeMs = mtimeMs;
          }
        } catch {
          // 无 sidecar —— 使用服务端 mtime
        }
        snapshot.set(entry.path, {
          path: entry.path,
          size: stat.size,
          mtimeMs: stat.mtimeMs,
        });
      }
      return snapshot;
    } catch {
      return null;
    }
  }
}
