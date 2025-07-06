/**
 * WebDAV 文件系统配置选项
 */
export interface WebDAVOptions {
  /**
   * WebDAV 服务器的基础 URL
   */
  baseUrl: string;
  
  /**
   * 认证用户名（可选）
   */
  username?: string;
  
  /**
   * 认证密码（可选）
   */
  password?: string;
  
  /**
   * 认证令牌（可选，如果提供则优先使用）
   */
  token?: string;
  
  /**
   * 自定义请求头（可选）
   */
  headers?: Record<string, string>;
  
  /**
   * 请求超时时间，单位毫秒（可选，默认 30000）
   */
  timeout?: number;
}

/**
 * WebDAV 请求选项
 */
export interface WebDAVRequestOptions {
  /**
   * 请求方法
   */
  method: string;
  
  /**
   * 请求头
   */
  headers?: Record<string, string>;
  
  /**
   * 请求体
   */
  body?: string | ArrayBuffer | null;
  
  /**
   * 请求超时时间，单位毫秒
   */
  timeout?: number;
}

/**
 * 文件或目录条目
 */
export interface FileEntry {
  /**
   * 文件或目录名称
   */
  name: string;
  
  /**
   * 是否为目录
   */
  isDirectory: boolean;
  
  /**
   * 文件大小（字节）
   */
  size?: number;
  
  /**
   * 最后修改时间
   */
  lastModified?: Date;
  
  /**
   * 创建时间
   */
  createdAt?: Date;
  
  /**
   * 文件或目录的完整路径
   */
  path: string;
}

/**
 * 文件或目录统计信息
 */
export interface Stats {
  /**
   * 是否为目录
   */
  isDirectory: boolean;
  
  /**
   * 是否为文件
   */
  isFile: boolean;
  
  /**
   * 文件大小（字节）
   */
  size: number;
  
  /**
   * 最后修改时间
   */
  lastModified?: Date;
  
  /**
   * 创建时间
   */
  createdAt?: Date;
}

/**
 * 读取文件选项
 */
export interface ReadFileOptions {
  /**
   * 响应类型
   */
  responseType?: 'text' | 'arraybuffer';
  
  /**
   * 编码（仅当 responseType 为 'text' 时有效）
   */
  encoding?: string;
}

/**
 * 写入文件选项
 */
export interface WriteFileOptions {
  /**
   * 是否覆盖现有文件
   */
  overwrite?: boolean;
  
  /**
   * 文件的 MIME 类型
   */
  contentType?: string;
}

/**
 * 创建目录选项
 */
export interface MkdirOptions {
  /**
   * 是否递归创建目录
   */
  recursive?: boolean;
}

/**
 * 删除目录选项
 */
export interface RmdirOptions {
  /**
   * 是否递归删除目录及其内容
   */
  recursive?: boolean;
}

/**
 * 读取目录选项
 */
export interface ReaddirOptions {
  /**
   * 是否包含详细信息
   */
  withFileTypes?: boolean;
  
  /**
   * 深度，1 表示只列出当前目录，大于 1 表示递归列出子目录
   */
  depth?: number;
}

/**
 * 复制选项
 */
export interface CopyOptions {
  /**
   * 是否覆盖目标位置的现有文件
   */
  overwrite?: boolean;
  
  /**
   * 是否递归复制目录
   */
  recursive?: boolean;
}

/**
 * 移动选项
 */
export interface MoveOptions {
  /**
   * 是否覆盖目标位置的现有文件
   */
  overwrite?: boolean;
}