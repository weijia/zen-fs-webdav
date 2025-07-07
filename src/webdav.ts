
import { WebDAVOptions } from './types';
import { WebDAVFileSystem } from './WebDAVFileSystem';

/**
 * 创建 WebDAV 文件系统实例（工厂函数）
 * @param options WebDAV 配置选项
 * @returns WebDAVFileSystem 实例
 */
export function createWebDAVFileSystem(options: WebDAVOptions): WebDAVFileSystem {
  return new WebDAVFileSystem(options);
}
// 清理遗留的无效代码