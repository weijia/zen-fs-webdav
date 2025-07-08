/**
 * zen-fs-webdav
 * 一个简单、现代的 WebDAV 客户端库，提供类似文件系统的 API
 */

// 导出主类
export { WebDAVFileSystem } from './WebDAVFileSystem';
export { createWebDAVFileSystem } from './webdav';

// 导出错误类
export { WebDAVError } from './errors';

// 导出类型定义
export {
  WebDAVOptions,
  WebDAVRequestOptions,
  FileEntry,
  Stats,
  ReadFileOptions,
  WriteFileOptions,
  MkdirOptions,
  RmdirOptions,
  ReaddirOptions,
  CopyOptions,
  MoveOptions,
} from './types';