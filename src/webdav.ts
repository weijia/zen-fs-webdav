/**
 * WebDAV 文件系统实现
 */

import { FileSystem, FileSystemError, FileSystemErrorCode } from '@zenfs/core';
import { WebDAVOptions, WebDAVFileSystem, WebDAVStat } from './types';
import { parseXml as parseXML, createPropfindXml as buildPropfindRequest, createProppatchXml as buildProppatchRequest } from './utils';

/**
 * 创建 WebDAV 文件系统
 * @param options WebDAV 配置选项
 * @returns WebDAV 文件系统实例
 */
export function createWebDAVFileSystem(options: WebDAVOptions): WebDAVFileSystem {
  // 规范化基础 URL，确保以斜杠结尾
  const baseUrl = options.baseUrl.endsWith('/') ? options.baseUrl : `${options.baseUrl}/`;
  
  // 默认选项
  const defaultOptions: Partial<WebDAVOptions> = {
    timeout: 30000,
    useDigestAuth: false,
    headers: {},
  };
  
  // 合并选项
  const config = { ...defaultOptions, ...options };
  
  /**
   * 构建完整的 URL
   * @param path 文件路径
   * @returns 完整 URL
   */
  const buildUrl = (path: string): string => {
    // 确保路径以斜杠开头但不以斜杠结尾（除非是根路径）
    const normalizedPath = path === '/' ? '' : path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl}${normalizedPath.replace(/^\/+/, '')}`;
  };
  
  /**
   * 构建请求头
   * @param additionalHeaders 额外的请求头
   * @returns 完整的请求头对象
   */
  const buildHeaders = (additionalHeaders: Record<string, string> = {}): Record<string, string> => {
    const headers: Record<string, string> = {
      ...config.headers,
      ...additionalHeaders,
    };
    
    // 添加基本认证
    if (config.username && config.password && !config.useDigestAuth) {
      const credentials = btoa(`${config.username}:${config.password}`);
      headers['Authorization'] = `Basic ${credentials}`;
    }
    
    return headers;
  };
  
  /**
   * 发送 WebDAV 请求
   * @param method HTTP 方法
   * @param path 文件路径
   * @param options 请求选项
   * @returns 响应对象
   */
  const sendRequest = async (
    method: string,
    path: string,
    options: {
      headers?: Record<string, string>;
      body?: string | ArrayBuffer;
      responseType?: 'text' | 'arraybuffer' | 'json';
    } = {}
  ): Promise<Response> => {
    const url = buildUrl(path);
    const headers = buildHeaders(options.headers);
    
    try {
      const response = await fetch(url, {
        method,
        headers,
        body: options.body,
        signal: AbortSignal.timeout(config.timeout!),
      });
      
      // 处理摘要认证
      if (response.status === 401 && config.useDigestAuth && config.username && config.password) {
        const authHeader = response.headers.get('WWW-Authenticate');
        if (authHeader && authHeader.startsWith('Digest ')) {
          // 实现摘要认证逻辑
          // 注意：这里需要一个完整的摘要认证实现，可能需要额外的工具函数
          throw new Error('Digest authentication not implemented yet');
        }
      }
      
      // 处理错误状态码
      if (!response.ok) {
        throw new FileSystemError(
          mapHttpStatusToErrorCode(response.status),
          `WebDAV request failed: ${response.status} ${response.statusText}`
        );
      }
      
      return response;
    } catch (error) {
      if (error instanceof FileSystemError) {
        throw error;
      }
      
      throw new FileSystemError(
        FileSystemErrorCode.UNKNOWN_ERROR,
        `WebDAV request failed: ${error.message}`
      );
    }
  };
  
  /**
   * 将 HTTP 状态码映射到文件系统错误码
   * @param status HTTP 状态码
   * @returns 文件系统错误码
   */
  const mapHttpStatusToErrorCode = (status: number): FileSystemErrorCode => {
    switch (status) {
      case 401:
      case 403:
        return FileSystemErrorCode.PERMISSION_DENIED;
      case 404:
        return FileSystemErrorCode.NOT_FOUND;
      case 409:
        return FileSystemErrorCode.ALREADY_EXISTS;
      case 423:
        return FileSystemErrorCode.LOCKED;
      case 507:
        return FileSystemErrorCode.NO_SPACE;
      default:
        return FileSystemErrorCode.UNKNOWN_ERROR;
    }
  };
  
  /**
   * 解析 WebDAV 属性响应
   * @param xml XML 响应文本
   * @returns 解析后的属性对象
   */
  const parseProps = async (xml: string): Promise<Record<string, WebDAVStat>> => {
    const doc = parseXML(xml);
    const responses = doc.getElementsByTagNameNS('DAV:', 'response');
    const result: Record<string, WebDAVStat> = {};
    
    for (let i = 0; i < responses.length; i++) {
      const response = responses[i];
      const href = response.getElementsByTagNameNS('DAV:', 'href')[0]?.textContent;
      
      if (!href) continue;
      
      // 提取路径
      const path = decodeURIComponent(href.replace(baseUrl, '/'));
      
      // 提取属性
      const propstat = response.getElementsByTagNameNS('DAV:', 'propstat')[0];
      if (!propstat) continue;
      
      const props = propstat.getElementsByTagNameNS('DAV:', 'prop')[0];
      if (!props) continue;
      
      // 检查资源类型
      const resourceType = props.getElementsByTagNameNS('DAV:', 'resourcetype')[0];
      const isDirectory = !!resourceType?.getElementsByTagNameNS('DAV:', 'collection').length;
      
      // 获取大小
      const contentLength = props.getElementsByTagNameNS('DAV:', 'getcontentlength')[0]?.textContent;
      const size = contentLength ? parseInt(contentLength, 10) : 0;
      
      // 获取修改时间
      const lastModified = props.getElementsByTagNameNS('DAV:', 'getlastmodified')[0]?.textContent;
      const modifiedAt = lastModified ? new Date(lastModified) : new Date();
      
      // 获取创建时间
      const creationDate = props.getElementsByTagNameNS('DAV:', 'creationdate')[0]?.textContent;
      const createdAt = creationDate ? new Date(creationDate) : modifiedAt;
      
      // 获取内容类型
      const contentType = props.getElementsByTagNameNS('DAV:', 'getcontenttype')[0]?.textContent;
      
      // 获取 ETag
      const etag = props.getElementsByTagNameNS('DAV:', 'getetag')[0]?.textContent;
      
      // 创建属性对象
      result[path] = {
        isDirectory,
        size,
        createdAt,
        modifiedAt,
        contentType,
        etag,
        props: {}, // 可以添加其他自定义属性
      };
    }
    
    return result;
  };
  
  /**
   * 获取文件或目录状态
   * @param path 文件或目录路径
   * @returns 状态对象
   */
  const stat = async (path: string): Promise<WebDAVStat> => {
    const xml = buildPropfindRequest([
      'resourcetype',
      'getcontentlength',
      'getlastmodified',
      'creationdate',
      'getcontenttype',
      'getetag',
    ]);
    
    const response = await sendRequest('PROPFIND', path, {
      headers: {
        'Content-Type': 'application/xml',
        'Depth': '0',
      },
      body: xml,
    });
    
    const responseText = await response.text();
    const props = await parseProps(responseText);
    
    // 获取当前路径的属性
    const normalizedPath = path === '/' ? '/' : path.endsWith('/') ? path : `${path}/`;
    const stat = props[normalizedPath] || props[path];
    
    if (!stat) {
      throw new FileSystemError(
        FileSystemErrorCode.NOT_FOUND,
        `Path not found: ${path}`
      );
    }
    
    return stat;
  };
  
  /**
   * 检查文件或目录是否存在
   * @param path 文件或目录路径
   * @returns 是否存在
   */
  const exists = async (path: string): Promise<boolean> => {
    try {
      await stat(path);
      return true;
    } catch (error) {
      if (error instanceof FileSystemError && error.code === FileSystemErrorCode.NOT_FOUND) {
        return false;
      }
      throw error;
    }
  };
  
  /**
   * 读取文件内容
   * @param path 文件路径
   * @param encoding 编码方式
   * @returns 文件内容
   */
  const readFile = async (path: string, encoding?: string): Promise<string | ArrayBuffer> => {
    const response = await sendRequest('GET', path);
    
    if (encoding === 'utf8' || encoding === 'utf-8') {
      return await response.text();
    }
    
    return await response.arrayBuffer();
  };
  
  /**
   * 写入文件内容
   * @param path 文件路径
   * @param data 文件内容
   * @param encoding 编码方式
   */
  const writeFile = async (path: string, data: string | ArrayBuffer, encoding?: string): Promise<void> => {
    let body: string | ArrayBuffer = data;
    let contentType = 'application/octet-stream';
    
    if (typeof data === 'string' && (!encoding || encoding === 'utf8' || encoding === 'utf-8')) {
      contentType = 'text/plain;charset=UTF-8';
    }
    
    await sendRequest('PUT', path, {
      headers: {
        'Content-Type': contentType,
      },
      body,
    });
  };
  
  /**
   * 删除文件或目录
   * @param path 文件或目录路径
   * @param recursive 是否递归删除
   */
  const remove = async (path: string, recursive?: boolean): Promise<void> => {
    // 检查是否是目录
    const fileStat = await stat(path);
    
    if (fileStat.isDirectory && !recursive) {
      throw new FileSystemError(
        FileSystemErrorCode.IS_DIRECTORY,
        `Cannot remove directory without recursive flag: ${path}`
      );
    }
    
    await sendRequest('DELETE', path);
  };
  
  /**
   * 创建目录
   * @param path 目录路径
   */
  const mkdir = async (path: string): Promise<void> => {
    await sendRequest('MKCOL', path);
  };
  
  /**
   * 读取目录内容
   * @param path 目录路径
   * @returns 目录条目数组
   */
  const readdir = async (path: string): Promise<string[]> => {
    const xml = buildPropfindRequest(['resourcetype']);
    
    const response = await sendRequest('PROPFIND', path, {
      headers: {
        'Content-Type': 'application/xml',
        'Depth': '1',
      },
      body: xml,
    });
    
    const responseText = await response.text();
    const props = await parseProps(responseText);
    
    // 规范化路径
    const normalizedPath = path === '/' ? '/' : path.endsWith('/') ? path : `${path}/`;
    
    // 过滤出子条目
    return Object.keys(props)
      .filter(entryPath => entryPath !== normalizedPath && entryPath !== path)
      .map(entryPath => {
        // 提取条目名称
        const name = entryPath.replace(normalizedPath, '').replace(/\/$/, '');
        return name;
      });
  };
  
  /**
   * 获取文件或目录的 WebDAV 属性
   * @param path 文件或目录路径
   * @returns 属性对象
   */
  const getProps = async (path: string): Promise<Record<string, any>> => {
    const xml = buildPropfindRequest(['allprop']);
    
    const response = await sendRequest('PROPFIND', path, {
      headers: {
        'Content-Type': 'application/xml',
        'Depth': '0',
      },
      body: xml,
    });
    
    const responseText = await response.text();
    const props = await parseProps(responseText);
    
    // 获取当前路径的属性
    const normalizedPath = path === '/' ? '/' : path.endsWith('/') ? path : `${path}/`;
    const stat = props[normalizedPath] || props[path];
    
    if (!stat) {
      throw new FileSystemError(
        FileSystemErrorCode.NOT_FOUND,
        `Path not found: ${path}`
      );
    }
    
    return stat.props || {};
  };
  
  /**
   * 设置文件或目录的 WebDAV 属性
   * @param path 文件或目录路径
   * @param props 属性对象
   */
  const setProps = async (path: string, props: Record<string, any>): Promise<void> => {
    const xml = buildProppatchRequest(props);
    
    await sendRequest('PROPPATCH', path, {
      headers: {
        'Content-Type': 'application/xml',
      },
      body: xml,
    });
  };
  
  /**
   * 复制文件或目录
   * @param src 源路径
   * @param dest 目标路径
   * @param overwrite 是否覆盖
   */
  const copy = async (src: string, dest: string, overwrite?: boolean): Promise<void> => {
    await sendRequest('COPY', src, {
      headers: {
        'Destination': buildUrl(dest),
        'Overwrite': overwrite ? 'T' : 'F',
      },
    });
  };
  
  /**
   * 移动文件或目录
   * @param src 源路径
   * @param dest 目标路径
   * @param overwrite 是否覆盖
   */
  const move = async (src: string, dest: string, overwrite?: boolean): Promise<void> => {
    await sendRequest('MOVE', src, {
      headers: {
        'Destination': buildUrl(dest),
        'Overwrite': overwrite ? 'T' : 'F',
      },
    });
  };
  
  // 返回文件系统接口
  return {
    stat,
    exists,
    readFile,
    writeFile,
    remove,
    mkdir,
    readdir,
    getProps,
    setProps,
    copy,
    move,
  };
}