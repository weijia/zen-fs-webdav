/**
 * WebDAV文件系统实现
 */

import {
  WebDAVOptions,
  Stats,
  ReadFileOptions,
  WriteFileOptions,
  ReaddirOptions,
  MkdirOptions,
  WebDAVResult,
} from './types';

import { WebDAVFileSystem } from './WebDAVFileSystem';

import {
  WebDAVError,
  NotFoundError,
  AuthenticationError,
  AuthorizationError,
  FileExistsError,
  NetworkError,
  TimeoutError,
  ArgumentError,
  ServerError,
} from './errors';

import {
  normalizePath,
  joinUrl,
  getDirFromPath,
  parseWebDAVXml,
  createBasicAuthHeader,
  getContentType,
} from './utils';

// 兼容 TextDecoder（浏览器和 Node.js）
class TextDecoderFallback {
  constructor(private encoding: string) {}
  decode(buffer: ArrayBuffer) {
    const uint8Array = new Uint8Array(buffer);
    return Array.from(uint8Array).map(byte => String.fromCharCode(byte)).join('');
  }
}

let TextDecoderImpl: any;

// 尝试获取 TextDecoder
if (typeof TextDecoder !== 'undefined') {
  TextDecoderImpl = TextDecoder;
} else {
  try {
    // 在 Node.js 中，尝试从全局对象获取
    if (typeof global !== 'undefined' && (global as any).TextDecoder) {
      TextDecoderImpl = (global as any).TextDecoder;
    } else {
      // 如果都失败了，使用后备实现
      TextDecoderImpl = TextDecoderFallback;
    }
  } catch {
    // 作为最终后备，使用简单的 ASCII 解码
    TextDecoderImpl = TextDecoderFallback;
  }
}

/**
 * WebDAV文件系统实现类
 */
export class WebDAVFS implements WebDAVFileSystem {
  private baseUrl: string;
  private auth?: { username: string; password: string };
  private timeout: number;
  private headers: Record<string, string>;

  /**
   * 创建WebDAV文件系统实例
   * @param options WebDAV选项
   */
  constructor(options: WebDAVOptions) {
    if (!options.baseUrl) {
      throw new ArgumentError('必须提供baseUrl');
    }

    this.baseUrl = options.baseUrl.endsWith('/') 
      ? options.baseUrl.slice(0, -1) 
      : options.baseUrl;
    if (options.username && options.password) {
      this.auth = { username: options.username, password: options.password };
    } else {
      this.auth = undefined;
    }
    this.timeout = options.timeout || 30000;
    this.headers = options.headers || {};
  }

  /**
   * 创建请求头
   * @param customHeaders 自定义请求头
   * @returns 合并后的请求头
   */
  private createHeaders(customHeaders?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      ...this.headers,
      ...customHeaders,
    };

    // 添加认证头
    if (this.auth) {
      headers['Authorization'] = createBasicAuthHeader(this.auth.username, this.auth.password);
    }

    return headers;
  }

  /**
   * 执行HTTP请求
   * @param method HTTP方法
   * @param path 请求路径
   * @param options 请求选项
   * @returns 响应对象
   */
  private async request(
    method: string,
    path: string,
    options: {
      headers?: Record<string, string>;
      body?: string | ArrayBuffer | Blob | Buffer;
      responseType?: 'text' | 'arraybuffer' | 'blob' | 'json';
    } = {}
  ): Promise<{ data: any; status: number; headers: Record<string, string> }> {
    const normalizedPath = normalizePath(path);
    const url = joinUrl(this.baseUrl, normalizedPath);
    const headers = this.createHeaders(options.headers);
    
    // 创建AbortController用于超时处理
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
    const timeoutId = controller ? setTimeout(() => controller.abort(), this.timeout) : undefined;
    
    try {
      // 使用fetch API（浏览器和现代Node.js都支持）
      const response = await fetch(url, {
        method,
        headers,
        body: options.body as BodyInit | null | undefined,
        signal: controller?.signal,
        credentials: 'include',
      });
      
      // 清除超时
      if (timeoutId) clearTimeout(timeoutId);
      
      // 提取响应头
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key.toLowerCase()] = value;
      });
      
      // 根据请求的responseType处理响应数据
      let data;
      if (options.responseType === 'arraybuffer') {
        data = await response.arrayBuffer();
      } else if (options.responseType === 'blob') {
        data = await response.blob();
      } else if (options.responseType === 'json') {
        data = await response.json();
      } else {
        data = await response.text();
      }
      
      return {
        data,
        status: response.status,
        headers: responseHeaders,
      };
    } catch (error: unknown) {
      // 清除超时
      if (timeoutId) clearTimeout(timeoutId);
      
      // 处理错误
      if ((error as Error).name === 'AbortError') {
        throw new TimeoutError(`请求超时: ${url}`);
      } else {
        throw new NetworkError(error as Error, `网络错误: ${(error as Error).message}`);
      }
    }
  }

  /**
   * 处理响应错误
   * @param status HTTP状态码
   * @param path 请求路径
   * @param error 原始错误
   */
  private handleResponseError(status: number, path: string, error?: Error): never {
    switch (status) {
      case 401:
        throw new AuthenticationError(`认证失败: ${path}`);
      case 403:
        throw new AuthorizationError(`无权限访问: ${path}`);
      case 404:
        throw new NotFoundError(`资源不存在: ${path}`);
      case 409:
        throw new FileExistsError(`资源已存在: ${path}`);
      default:
        throw new ServerError(`服务器错误 (${status}): ${path}`, status);
    }
  }

  /**
   * 读取文件内容
   * @param path 文件路径
   * @param encodingOrOptions 编码字符串或读取选项对象
   * @returns 文件内容
   */
  async readFile(
    path: string, 
    encodingOrOptions?: string | ReadFileOptions
  ): Promise<Buffer | string> {
    const normalizedPath = normalizePath(path);
    
    // 处理参数：兼容 fs.promises.readFile(path, encoding) 和原有的 readFile(path, options)
    let options: ReadFileOptions = {};
    if (typeof encodingOrOptions === 'string') {
      // Node.js fs.promises 风格：readFile(path, encoding)
      options = { encoding: encodingOrOptions as BufferEncoding };
    } else if (encodingOrOptions) {
      // 原有风格：readFile(path, options)
      options = encodingOrOptions;
    }
    
    try {
      const response = await this.request('GET', normalizedPath, {
        headers: options.headers,
        responseType: 'arraybuffer',
      });
      
      if (response.status >= 400) {
        this.handleResponseError(response.status, normalizedPath);
      }
      
      // 处理响应数据（兼容浏览器和 Node.js）
      const arrayBuffer = response.data instanceof ArrayBuffer 
        ? response.data 
        : response.data.buffer || response.data;

      // 根据编码返回字符串或 Buffer
      if (options.encoding) {
        // 使用 TextDecoder 解码（浏览器兼容）
        const decoder = new TextDecoderImpl(options.encoding as string);
        return decoder.decode(arrayBuffer);
      } else {
        // 返回 Buffer（Node.js）或 Uint8Array（浏览器）
        if (typeof Buffer !== 'undefined') {
          return Buffer.from(arrayBuffer);
        } else {
          return new Uint8Array(arrayBuffer) as any;
        }
      }
    } catch (error: unknown) {
      if (error instanceof WebDAVError) {
        throw error;
      }
      throw new WebDAVError(`读取文件失败: ${normalizedPath}`, undefined, error);
    }
  }

  /**
   * 写入文件内容
   * @param path 文件路径
   * @param data 文件内容
   * @param options 写入选项
   * @returns 操作结果
   */
  async writeFile(
    path: string,
    data: Buffer | string,
    options: WriteFileOptions = {}
  ): Promise<WebDAVResult> {
    const normalizedPath = normalizePath(path);
    const getFilenameFromPath = (p: string) => {
      const parts = p.split('/');
      return parts[parts.length - 1] || '';
    };
    const contentType = options.contentType || getContentType(getFilenameFromPath(normalizedPath));
    // 检查文件是否存在（如果不允许覆盖）
    if (options.overwrite === false) {
      const exists = await this.exists(normalizedPath);
      if (exists) {
        throw new FileExistsError(normalizedPath);
      }
    }
    
    // 准备请求头
    const headers = {
      'Content-Type': contentType,
    };
    
    try {
      const response = await this.request('PUT', normalizedPath, {
        headers,
        body: data,
      });
      
      if (response.status >= 400) {
        this.handleResponseError(response.status, normalizedPath);
      }
      
      return {
        success: response.status >= 200 && response.status < 300,
        statusCode: response.status,
      };
    } catch (error: unknown) {
      if (error instanceof WebDAVError) {
        throw error;
      }
      throw new WebDAVError(`写入文件失败: ${normalizedPath}`);
    }
  }

  /**
   * 删除文件
   * @param path 文件路径
   * @returns 操作结果
   */
  async deleteFile(path: string): Promise<WebDAVResult> {
    const normalizedPath = normalizePath(path);
    
    try {
      // 确保是文件而不是目录
      const stat = await this.stat(normalizedPath);
      if (stat.isDirectory) {
        throw new ArgumentError(`路径指向一个目录，请使用rmdir方法: ${normalizedPath}`);
      }
      
      const response = await this.request('DELETE', normalizedPath);
      
      if (response.status >= 400) {
        this.handleResponseError(response.status, normalizedPath);
      }
      
      return {
        success: response.status >= 200 && response.status < 300,
        statusCode: response.status,
      };
    } catch (error: unknown) {
      if (error instanceof WebDAVError) {
        throw error;
      }
      throw new WebDAVError(`删除文件失败: ${normalizedPath}`);
    }
  }

  /**
   * 读取目录内容
   * @param path 目录路径
   * @param options 读取选项
   * @returns 文件统计信息数组
   */
  async readDir(path: string, options: ReaddirOptions = {}): Promise<Stats[]> {
    const normalizedPath = normalizePath(path);
    
    try {
      // 准备PROPFIND请求
      const headers = {
        'Depth': options.recursive ? 'infinity' : '1',
        'Content-Type': 'application/xml',
      };
      
      const response = await this.request('PROPFIND', normalizedPath, {
        headers,
      });
      
      if (response.status >= 400) {
        this.handleResponseError(response.status, normalizedPath);
      }
      
      // 解析XML响应
      const files = parseWebDAVXml(response.data, normalizedPath);
      
      // 过滤结果
      const result = files.filter(file => {
        // 排除当前目录
        if (file.path === normalizedPath) {
          return false;
        }
        
        // 处理隐藏文件
        if (!options.includeHidden && file.name.startsWith('.')) {
          return false;
        }
        
        return true;
      });
      
      return result;
    } catch (error: unknown) {
      if (error instanceof WebDAVError) {
        throw error;
      }
      throw new WebDAVError(`读取目录失败: ${normalizedPath}`);
    }
  }

  /**
   * 创建目录
   * @param path 目录路径
   * @param options 创建选项
   * @returns 操作结果
   */
  async mkdir(path: string, options: MkdirOptions = {}): Promise<void> {
    const normalizedPath = normalizePath(path);
    
    // 检查目录是否已存在
    let pathExists = false;
    let isDirectory = false;
    
    try {
      const stat = await this.stat(normalizedPath);
      pathExists = true;
      isDirectory = stat.isDirectory;
    } catch (error) {
      // stat 失败,路径不存在或其他错误
      pathExists = false;
    }
    
    // 如果路径已存在
    if (pathExists) {
      if (isDirectory) {
        // 是目录：递归模式下返回成功，非递归模式抛出错误
        if (options.recursive) {
          return; // 递归模式下目录存在是OK的
        }
        throw new FileExistsError(normalizedPath);
      } else {
        // 路径存在但不是目录，总是抛出错误
        throw new FileExistsError(normalizedPath);
      }
    }
    
    // 到这里说明目录不存在，需要创建
    try {
      // 如果需要递归创建父目录
      if (options.recursive) {
        const parentDir = getDirFromPath(normalizedPath);
        if (parentDir !== '/' && parentDir !== normalizedPath) {
          try {
            await this.stat(parentDir);
            // 父目录存在，继续
          } catch (error) {
            // 父目录不存在，递归创建
            await this.mkdir(parentDir, options);
          }
        }
      }
      
      // 创建目录
      const response = await this.request('MKCOL', normalizedPath);
      
      if (response.status >= 400) {
        // 特殊处理: 405 可能表示目录已存在
        if (response.status === 405 && options.recursive) {
          try {
            const stat = await this.stat(normalizedPath);
            if (stat.isDirectory) {
              return; // 目录确实存在，视为成功
            }
          } catch (e) {
            // 检查失败，继续抛出原始错误
          }
        }
        this.handleResponseError(response.status, normalizedPath);
      }
      
      return;
    } catch (error: unknown) {
      if (error instanceof WebDAVError) {
        throw error;
      }
      throw new WebDAVError(`创建目录失败: ${normalizedPath}`);
    }
  }

  /**
   * 删除文件或目录，行为类似于 Node.js 的 fs.rm
   * @param path 路径
   * @param options { recursive?: boolean, force?: boolean }
   */
  async rm(path: string, options?: { recursive?: boolean, force?: boolean }) {
    const { recursive = false, force = false } = options || {};
    try {
      const stat = await this.stat(path);
      if (stat.isDirectory) {
        if (recursive) {
          // 递归删除目录内容
          const files = await this.readDir(path);
          for (const file of files) {
            const childPath = path.replace(/\/$/, '') + '/' + file.name;
            await this.rm(childPath, { recursive: true, force });
          }
        } else {
          // 非递归时，目录必须为空
          const files = await this.readDir(path);
          if (files.length > 0) {
            throw new WebDAVError(`Directory not empty: ${path}`);
          }
        }
      }
      // 删除文件或空目录
      await this._delete(path);
    } catch (err: unknown) {
      const error = err as any;
      if (force && (error.code === 'ENOENT' || error.status === 404)) {
        // force=true 时忽略不存在
        return;
      }
      throw err;
    }
  }

  /**
   * 兼容旧的 rmdir 方法，内部重定向到 rm
   * @deprecated 请使用 rm
   */
  async rmdir(path: string, options?: boolean | { recursive?: boolean, force?: boolean }) {
    // 兼容 boolean 递归参数
    let opts: { recursive?: boolean, force?: boolean } = {};
    if (typeof options === 'boolean') {
      opts.recursive = options;
    } else if (typeof options === 'object' && options !== null) {
      opts = options;
    }
    return this.rm(path, opts);
  }

  /**
   * 删除文件或目录
   * @param path 文件或目录路径
   * @returns 操作结果
   */
  private async _delete(path: string) {
    // 实现 WebDAV DELETE 请求
    const normalizedPath = normalizePath(path);
    
    try {
      const response = await this.request('DELETE', normalizedPath);
      
      if (response.status >= 400) {
        this.handleResponseError(response.status, normalizedPath);
      }
      
      return {
        success: response.status >= 200 && response.status < 300,
        statusCode: response.status,
      };
    } catch (error: unknown) {
      if (error instanceof WebDAVError) {
        throw error;
      }
      throw new WebDAVError(`删除失败: ${normalizedPath}`, undefined, error);
    }
  }

  /**
   * 获取文件或目录的统计信息
   * @param path 文件或目录路径
   * @returns 文件统计信息
   */
  async stat(path: string): Promise<Stats> {
    const normalizedPath = normalizePath(path);
    
    try {
      // 准备PROPFIND请求
      const headers = {
        'Depth': '0',
        'Content-Type': 'application/xml',
      };
      
      const response = await this.request('PROPFIND', normalizedPath, {
        headers,
      });
      
      if (response.status === 404) {
        throw new NotFoundError(normalizedPath);
      } else if (response.status >= 400) {
        this.handleResponseError(response.status, normalizedPath);
      }
      
      // 解析XML响应
      const files = parseWebDAVXml(response.data, normalizedPath);
      
      if (files.length === 0) {
        throw new NotFoundError(normalizedPath);
      }
      
      const stat = files[0];
      
      return stat;
    } catch (error: unknown) {
      if (error instanceof WebDAVError) {
        throw error;
      }
      throw new WebDAVError(`获取文件信息失败: ${normalizedPath}`, undefined, error);
    }
  }

  /**
   * 检查文件或目录是否存在
   * @param path 文件或目录路径
   * @returns 是否存在
   */
  async exists(path: string): Promise<boolean> {
    try {
      await this.stat(path);
      return true;
    } catch (error) {
      if (error instanceof NotFoundError) {
        return false;
      }
      throw error;
    }
  }

  /**
   * 复制文件或目录
   * @param source 源路径
   * @param destination 目标路径
   * @param overwrite 是否覆盖已存在的文件
   * @returns 操作结果
   */
  async copy(source: string, destination: string, overwrite = true): Promise<WebDAVResult> {
    const normalizedSource = normalizePath(source);
    const normalizedDestination = normalizePath(destination);
    
    try {
      // 检查源文件是否存在
      await this.stat(normalizedSource);
      
      // 检查目标文件是否存在（如果不允许覆盖）
      if (!overwrite) {
        const exists = await this.exists(normalizedDestination);
        if (exists) {
          throw new FileExistsError(normalizedDestination);
        }
      }
      
      // 准备COPY请求
      const headers = {
        'Destination': joinUrl(this.baseUrl, normalizedDestination),
        'Overwrite': overwrite ? 'T' : 'F',
      };
      
      const response = await this.request('COPY', normalizedSource, {
        headers,
      });
      
      if (response.status >= 400) {
        this.handleResponseError(response.status, normalizedSource);
      }
      
      return {
        success: response.status >= 200 && response.status < 300,
        statusCode: response.status,
      };
    } catch (error: unknown) {
      if (error instanceof WebDAVError) {
        throw error;
      }
      throw new WebDAVError(`复制失败: ${normalizedSource} -> ${normalizedDestination}`, undefined, error);
    }
  }

  /**
   * 移动文件或目录
   * @param source 源路径
   * @param destination 目标路径
   * @param overwrite 是否覆盖已存在的文件
   * @returns 操作结果
   */
  async move(source: string, destination: string, overwrite = true): Promise<WebDAVResult> {
    const normalizedSource = normalizePath(source);
    const normalizedDestination = normalizePath(destination);
    
    try {
      // 检查源文件是否存在
      await this.stat(normalizedSource);
      
      // 检查目标文件是否存在（如果不允许覆盖）
      if (!overwrite) {
        const exists = await this.exists(normalizedDestination);
        if (exists) {
          throw new FileExistsError(normalizedDestination);
        }
      }
      
      // 准备MOVE请求
      const headers = {
        'Destination': joinUrl(this.baseUrl, normalizedDestination),
        'Overwrite': overwrite ? 'T' : 'F',
      };
      
      const response = await this.request('MOVE', normalizedSource, {
        headers,
      });
      
      if (response.status >= 400) {
        this.handleResponseError(response.status, normalizedSource);
      }
      
      return {
        success: response.status >= 200 && response.status < 300,
        statusCode: response.status,
      };
    } catch (error: unknown) {
      if (error instanceof WebDAVError) {
        throw error;
      }
      throw new WebDAVError(`移动失败: ${normalizedSource} -> ${normalizedDestination}`, undefined, error);
    }
  }

  /**
   * 删除文件（fs/unlink 兼容方法）
   * @param path 文件路径
   */
  async unlink(path: string): Promise<void> {
    await this.deleteFile(path);
  }

  // ============================================
  // Node.js fs.promises 兼容接口
  // 这些方法使 WebDAVFS 可以直接作为 IFileSystem 使用
  // ============================================

  /**
   * 读取目录（fs.promises.readdir 兼容）
   * @param path 目录路径
   * @returns 文件名数组
   */
  async readdir(path: string): Promise<string[]> {
    const stats = await this.readDir(path);
    return stats.map(stat => stat.name);
  }

  /**
   * 重命名/移动文件（fs.promises.rename 兼容）
   * @param oldPath 原路径
   * @param newPath 新路径
   */
  async rename(oldPath: string, newPath: string): Promise<void> {
    await this.move(oldPath, newPath, true);
  }
}