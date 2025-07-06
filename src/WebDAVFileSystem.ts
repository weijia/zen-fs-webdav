import { WebDAVError } from './WebDAVError';
import {
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

// 浏览器环境类型
declare const DOMParser: {
  new (): {
    parseFromString(str: string, type: string): Document;
  };
};

declare const btoa: (str: string) => string;

/**
 * WebDAV 文件系统实现
 */
export class WebDAVFileSystem {
  private baseUrl: string;
  private username?: string;
  private password?: string;
  private token?: string;
  private defaultHeaders: Record<string, string>;
  private timeout: number;

  constructor(options: WebDAVOptions) {
    this.baseUrl = options.baseUrl.endsWith('/') 
      ? options.baseUrl 
      : `${options.baseUrl}/`;
    
    this.username = options.username;
    this.password = options.password;
    this.token = options.token;
    this.timeout = options.timeout || 30000;
    
    this.defaultHeaders = {
      'Content-Type': 'application/octet-stream',
      ...options.headers,
    };
    
    if (this.token) {
      this.defaultHeaders['Authorization'] = `Bearer ${this.token}`;
    } else if (this.username && this.password) {
      const credentials = btoa(`${this.username}:${this.password}`);
      this.defaultHeaders['Authorization'] = `Basic ${credentials}`;
    }
  }

  /**
   * 列出目录内容
   * 
   * @param path 目录路径
   * @param options 列出选项
   * @returns Promise 解析为文件条目数组
   * @throws WebDAVError 当目录不存在或无法读取时
   */
  async readdir(path: string, options: ReaddirOptions = {}): Promise<FileEntry[]> {
    const { depth = 1 } = options;
    
    // 确保路径以 / 结尾
    const dirPath = path.endsWith('/') ? path : `${path}/`;
    
    const response = await this.sendRequest(dirPath, {
      method: 'PROPFIND',
      headers: {
        'Depth': depth.toString(),
        'Content-Type': 'application/xml',
      },
      body: `<?xml version="1.0" encoding="utf-8" ?>
        <D:propfind xmlns:D="DAV:">
          <D:prop>
            <D:resourcetype/>
            <D:getcontentlength/>
            <D:getlastmodified/>
            <D:creationdate/>
          </D:prop>
        </D:propfind>`,
    });
    
    this.handleResponseError(response, dirPath);
    
    const text = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text, 'application/xml');
    
    // 获取所有响应
    const responses = xmlDoc.querySelectorAll('response');
    const entries: FileEntry[] = [];
    
    // 解析每个响应
    for (let i = 0; i < responses.length; i++) {
      const responseElem = responses[i];
      
      // 获取 href
      const hrefElem = responseElem.querySelector('href');
      if (!hrefElem || !hrefElem.textContent) continue;
      
      // 解码 URL 并提取路径
      const href = decodeURIComponent(hrefElem.textContent);
      
      // 跳过当前目录
      if (href === this.buildUrl(dirPath)) continue;
      
      // 提取文件名
      const name = href.endsWith('/')
        ? href.split('/').filter(Boolean).pop() || ''
        : href.split('/').pop() || '';
      
      // 检查是否为目录
      const resourceType = responseElem.querySelector('resourcetype');
      const isDirectory = resourceType ? !!resourceType.querySelector('collection') : false;
      
      // 获取文件大小
      const contentLength = responseElem.querySelector('getcontentlength');
      const size = contentLength && contentLength.textContent
        ? parseInt(contentLength.textContent, 10)
        : undefined;
      
      // 获取最后修改时间
      const lastModified = responseElem.querySelector('getlastmodified');
      const lastModifiedDate = lastModified && lastModified.textContent
        ? new Date(lastModified.textContent)
        : undefined;
      
      // 获取创建时间
      const creationDate = responseElem.querySelector('creationdate');
      const createdAtDate = creationDate && creationDate.textContent
        ? new Date(creationDate.textContent)
        : undefined;
      
      // 创建文件条目
      entries.push({
        name,
        isDirectory,
        size,
        lastModified: lastModifiedDate,
        createdAt: createdAtDate,
        path: href.replace(this.baseUrl, '/'),
      });
    }
    
    return entries;
  }

  /**
   * 复制文件或目录
   * 
   * @param source 源路径
   * @param destination 目标路径
   * @param options 复制选项
   * @returns Promise 解析为 void
   * @throws WebDAVError 当复制失败时
   */
  async copy(
    source: string, 
    destination: string, 
    options: CopyOptions = {}
  ): Promise<void> {
    const { overwrite = true, recursive = true } = options;
    
    const response = await this.sendRequest(source, {
      method: 'COPY',
      headers: {
        'Destination': this.buildUrl(destination),
        'Overwrite': overwrite ? 'T' : 'F',
        'Depth': recursive ? 'infinity' : '0',
      },
    });
    
    this.handleResponseError(response, source);
  }

  /**
   * 移动文件或目录
   * 
   * @param source 源路径
   * @param destination 目标路径
   * @param options 移动选项
   * @returns Promise 解析为 void
   * @throws WebDAVError 当移动失败时
   */
  async move(
    source: string, 
    destination: string, 
    options: MoveOptions = {}
  ): Promise<void> {
    const { overwrite = true } = options;
    
    const response = await this.sendRequest(source, {
      method: 'MOVE',
      headers: {
        'Destination': this.buildUrl(destination),
        'Overwrite': overwrite ? 'T' : 'F',
      },
    });
    
    this.handleResponseError(response, source);
  }

  /**
   * 重命名文件或目录
   * 
   * @param path 文件或目录路径
   * @param newName 新名称
   * @param options 重命名选项
   * @returns Promise 解析为 void
   * @throws WebDAVError 当重命名失败时
   */
  async rename(
    path: string, 
    newName: string, 
    options: MoveOptions = {}
  ): Promise<void> {
    // 获取父目录路径
    const parts = path.split('/').filter(Boolean);
    parts.pop(); // 移除文件名
    const parentDir = parts.length > 0 ? `/${parts.join('/')}` : '/';
    
    // 构建目标路径
    const destination = `${parentDir}/${newName}`;
    
    // 使用 move 方法实现重命名
    await this.move(path, destination, options);
  }

  /**
   * 创建可读流
   * 
   * @param path 文件路径
   * @returns Promise 解析为可读流
   * @throws WebDAVError 当文件不存在或无法读取时
   */
  async createReadStream(path: string): Promise<ReadableStream> {
    const response = await this.sendRequest(path, { method: 'GET' });
    this.handleResponseError(response, path);
    
    if (response.body === null) {
      throw new WebDAVError(`无法创建可读流: ${path}`, 0);
    }
    
    return response.body;
  }

  /**
   * 创建可写流
   * 
   * @param path 文件路径
   * @param options 写入选项
   * @returns 可写流
   */
  createWriteStream(path: string, options: WriteFileOptions = {}): WritableStream {
    const { contentType } = options;
    
    // 创建自定义可写流
    const encoder = new TextEncoder();
    const chunks: Uint8Array[] = [];
    
    return new WritableStream({
      write: (chunk) => {
        if (typeof chunk === 'string') {
          chunks.push(encoder.encode(chunk));
        } else if (chunk instanceof ArrayBuffer) {
          chunks.push(new Uint8Array(chunk));
        } else if (chunk instanceof Uint8Array) {
          chunks.push(chunk);
        } else {
          throw new WebDAVError('不支持的数据类型', 0);
        }
      },
      close: async () => {
        // 合并所有块
        const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
        const mergedArray = new Uint8Array(totalLength);
        
        let offset = 0;
        for (const chunk of chunks) {
          mergedArray.set(chunk, offset);
          offset += chunk.length;
        }
        
        // 写入文件
        await this.writeFile(path, mergedArray.buffer, { 
          overwrite: options.overwrite,
          contentType,
        });
      },
    });
  }

  /**
   * 规范化路径，确保以 / 开头，不以 / 结尾（除非是根路径）
   * 
   * @param path 原始路径
   * @returns 规范化后的路径
   */
  private normalizePath(path: string): string {
    // 确保路径以 / 开头
    let normalizedPath = path.startsWith('/') ? path : `/${path}`;
    
    // 如果不是根路径，确保不以 / 结尾
    if (normalizedPath.length > 1 && normalizedPath.endsWith('/')) {
      normalizedPath = normalizedPath.slice(0, -1);
    }
    
    return normalizedPath;
  }

  /**
   * 构建完整的 URL
   * 
   * @param path 文件或目录路径
   * @returns 完整的 URL
   */
  private buildUrl(path: string): string {
    const normalizedPath = this.normalizePath(path);
    // 移除 baseUrl 末尾的 / 和 normalizedPath 开头的 /，然后拼接
    const baseWithoutSlash = this.baseUrl.endsWith('/') 
      ? this.baseUrl.slice(0, -1) 
      : this.baseUrl;
    const pathWithoutSlash = normalizedPath.startsWith('/') 
      ? normalizedPath.slice(1) 
      : normalizedPath;
    
    return `${baseWithoutSlash}/${pathWithoutSlash}`;
  }

  /**
   * 发送 WebDAV 请求
   * 
   * @param path 文件或目录路径
   * @param options 请求选项
   * @returns Promise 解析为响应对象
   * @throws WebDAVError 当请求失败时
   */
  private async sendRequest(
    path: string, 
    options: WebDAVRequestOptions
  ): Promise<Response> {
    const url = this.buildUrl(path);
    const requestOptions: RequestInit = {
      method: options.method,
      headers: {
        ...this.defaultHeaders,
        ...options.headers,
      },
      body: options.body || undefined,
    };
    
    try {
      // 创建 AbortController 用于超时控制
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), options.timeout || this.timeout);
      
      // 添加 signal 到请求选项
      requestOptions.signal = controller.signal;
      
      // 发送请求
      const response = await fetch(url, requestOptions);
      
      // 清除超时计时器
      clearTimeout(timeoutId);
      
      return response;
    } catch (error) {
      // 处理网络错误
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw WebDAVError.connectionTimeout();
        }
        throw WebDAVError.networkError(error);
      }
      throw new WebDAVError('未知错误', 0);
    }
  }

  /**
   * 处理响应错误
   * 
   * @param response 响应对象
   * @param path 文件或目录路径
   * @throws WebDAVError 当响应表示错误时
   */
  private handleResponseError(response: Response, path: string): void {
    if (!response.ok) {
      switch (response.status) {
        case 401:
          throw WebDAVError.authenticationFailed();
        case 403:
          throw WebDAVError.permissionDenied(path);
        case 404:
          throw WebDAVError.fileNotFound(path);
        default:
          throw WebDAVError.serverError(response.status);
      }
    }
  }

  /**
   * 检查文件或目录是否存在
   * 
   * @param path 文件或目录路径
   * @returns Promise 解析为布尔值，表示文件或目录是否存在
   */
  async exists(path: string): Promise<boolean> {
    try {
      const response = await this.sendRequest(path, { method: 'HEAD' });
      return response.ok;
    } catch (error) {
      // 如果是网络错误以外的错误，假设文件不存在
      if (error instanceof WebDAVError && error.status === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * 获取文件或目录的统计信息
   * 
   * @param path 文件或目录路径
   * @returns Promise 解析为统计信息对象
   * @throws WebDAVError 当文件或目录不存在时
   */
  async stat(path: string): Promise<Stats> {
    const response = await this.sendRequest(path, {
      method: 'PROPFIND',
      headers: {
        'Depth': '0',
        'Content-Type': 'application/xml',
      },
      body: `<?xml version="1.0" encoding="utf-8" ?>
        <D:propfind xmlns:D="DAV:">
          <D:prop>
            <D:resourcetype/>
            <D:getcontentlength/>
            <D:getlastmodified/>
            <D:creationdate/>
          </D:prop>
        </D:propfind>`,
    });
    
    this.handleResponseError(response, path);
    
    const text = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text, 'application/xml');
    
    // 检查是否为目录
    const resourceType = xmlDoc.querySelector('resourcetype');
    const isDirectory = resourceType ? !!resourceType.querySelector('collection') : false;
    
    // 获取文件大小
    const contentLength = xmlDoc.querySelector('getcontentlength');
    const size = contentLength ? parseInt(contentLength.textContent || '0', 10) : 0;
    
    // 获取最后修改时间
    const lastModified = xmlDoc.querySelector('getlastmodified');
    const lastModifiedDate = lastModified && lastModified.textContent 
      ? new Date(lastModified.textContent) 
      : undefined;
    
    // 获取创建时间
    const creationDate = xmlDoc.querySelector('creationdate');
    const createdAtDate = creationDate && creationDate.textContent 
      ? new Date(creationDate.textContent) 
      : undefined;
    
    return {
      isDirectory,
      name: path.split('/').filter(Boolean).pop() || '',
      path: this.normalizePath(path),
      isFile: !isDirectory,
      size,
      lastModified: lastModifiedDate,
      createdAt: createdAtDate,
    };
  }

  /**
   * 读取文件内容
   * 
   * @param path 文件路径
   * @param options 读取选项
   * @returns Promise 解析为文件内容（字符串或 ArrayBuffer）
   * @throws WebDAVError 当文件不存在或无法读取时
   */
  async readFile(
    path: string, 
    options: ReadFileOptions = {}
  ): Promise<string | ArrayBuffer> {
    const { responseType = 'text' } = options;
    
    const response = await this.sendRequest(path, { method: 'GET' });
    this.handleResponseError(response, path);
    
    if (responseType === 'arraybuffer') {
      return await response.arrayBuffer();
    } else {
      return await response.text();
    }
  }

  /**
   * 写入文件内容
   * 
   * @param path 文件路径
   * @param data 文件内容
   * @param options 写入选项
   * @returns Promise 解析为 void
   * @throws WebDAVError 当写入失败时
   */
  async writeFile(
    path: string, 
    data: string | ArrayBuffer, 
    options: WriteFileOptions = {}
  ): Promise<void> {
    const { contentType } = options;
    
    // 如果不允许覆盖且文件已存在，则抛出错误
    if (options.overwrite === false && await this.exists(path)) {
      throw new WebDAVError(`文件已存在: ${path}`, 412);
    }
    
    const headers: Record<string, string> = {};
    if (contentType) {
      headers['Content-Type'] = contentType;
    }
    
    const response = await this.sendRequest(path, {
      method: 'PUT',
      headers,
      body: data,
    });
    
    this.handleResponseError(response, path);
  }

  /**
   * 追加内容到文件
   * 
   * @param path 文件路径
   * @param data 要追加的内容
   * @returns Promise 解析为 void
   * @throws WebDAVError 当追加失败时
   */
  async appendFile(path: string, data: string | ArrayBuffer): Promise<void> {
    // 检查文件是否存在
    const exists = await this.exists(path);
    
    if (exists) {
      // 如果文件存在，读取现有内容并追加新内容
      const existingContent = await this.readFile(path, { 
        responseType: typeof data === 'string' ? 'text' : 'arraybuffer' 
      });
      
      let newContent: string | ArrayBuffer;
      
      if (typeof data === 'string' && typeof existingContent === 'string') {
        // 字符串追加
        newContent = existingContent + data;
      } else if (data instanceof ArrayBuffer && existingContent instanceof ArrayBuffer) {
        // ArrayBuffer 追加
        const existingBuffer = new Uint8Array(existingContent);
        const appendBuffer = new Uint8Array(data);
        const newBuffer = new Uint8Array(existingBuffer.length + appendBuffer.length);
        newBuffer.set(existingBuffer, 0);
        newBuffer.set(appendBuffer, existingBuffer.length);
        newContent = newBuffer.buffer;
      } else {
        throw WebDAVError.invalidArgument('数据类型不匹配');
      }
      
      // 写入合并后的内容
      await this.writeFile(path, newContent);
    } else {
      // 如果文件不存在，直接创建新文件
      await this.writeFile(path, data);
    }
  }

  /**
   * 删除文件
   * 
   * @param path 文件路径
   * @returns Promise 解析为 void
   * @throws WebDAVError 当删除失败时
   */
  async unlink(path: string): Promise<void> {
    const response = await this.sendRequest(path, { method: 'DELETE' });
    this.handleResponseError(response, path);
  }

  /**
   * 创建目录
   * 
   * @param path 目录路径
   * @param options 创建选项
   * @returns Promise 解析为 void
   * @throws WebDAVError 当创建失败时
   */
  async mkdir(path: string, options: MkdirOptions = {}): Promise<void> {
    const { recursive = false } = options;
    
    if (recursive) {
      // 递归创建目录
      const parts = path.split('/').filter(Boolean);
      let currentPath = '';
      
      for (const part of parts) {
        currentPath += `/${part}`;
        
        // 检查目录是否已存在
        const exists = await this.exists(currentPath);
        if (!exists) {
          // 创建目录
          const response = await this.sendRequest(currentPath, { method: 'MKCOL' });
          this.handleResponseError(response, currentPath);
        }
      }
    } else {
      // 直接创建目录
      const response = await this.sendRequest(path, { method: 'MKCOL' });
      this.handleResponseError(response, path);
    }
  }

  /**
   * 删除目录
   * 
   * @param path 目录路径
   * @param options 删除选项
   * @returns Promise 解析为 void
   * @throws WebDAVError 当删除失败时
   */
  async rmdir(path: string, options: RmdirOptions = {}): Promise<void> {
    const { recursive = false } = options;
    
    if (recursive) {
      // 递归删除目录及其内容
      const entries = await this.readdir(path);
      
      for (const entry of entries) {
        const entryPath = `${path}/${entry.name}`;
        
        if (entry.isDirectory) {
          // 递归删除子目录
          await this.rmdir(entryPath, { recursive: true });
        } else {
          // 删除文件
          await this.unlink(entryPath);
        }
      }
    }
    
    // 删除目录本身
    const response = await this.sendRequest(path, { method: 'DELETE' });
    this.handleResponseError(response, path);
  }
}