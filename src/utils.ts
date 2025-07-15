import { WebDAVNamespace, WebDAVPropName, WebDAVResourceType } from './constants';
import { Stats } from './types';
import { WebDAVError } from './errors';
import { XMLParser } from 'fast-xml-parser'

/**
 * 规范化路径，确保以 / 开头，不以 / 结尾（除非是根路径）
 * @param path 路径
 * @returns 规范化后的路径
 */
export function normalizePath(path: string): string {
  // 确保路径以 / 开头
  if (!path.startsWith('/')) {
    path = '/' + path;
  }
  // 合并多个连续的斜杠为一个
  path = path.replace(/\/+/g, '/');
  // 如果不是根路径，则确保不以 / 结尾
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }
  return path;
}

// /**
//  * 连接路径
//  * @param base 基础路径
//  * @param paths 要连接的路径
//  * @returns 连接后的路径
//  */
// export function joinPaths(base: string, ...paths: string[]): string {
//   let result = base;
  
//   for (const path of paths) {
//     if (!path) continue;
    
//     if (result.endsWith('/')) {
//       result = result + (path.startsWith('/') ? path.slice(1) : path);
//     } else {
//       result = result + (path.startsWith('/') ? path : '/' + path);
//     }
//   }
  
//   return normalizePath(result);
// }

/**
 * 获取路径的父目录
 * @param path 路径
 * @returns 父目录路径
 */
export function getParentPath(path: string): string {
  path = normalizePath(path);
  
  // 根路径没有父目录
  if (path === '/') {
    return '/';
  }
  
  const lastSlashIndex = path.lastIndexOf('/');
  if (lastSlashIndex <= 0) {
    return '/';
  }
  
  return path.slice(0, lastSlashIndex) || '/';
}

/**
 * 获取路径的基本名称（最后一个部分）
 * @param path 路径
 * @returns 基本名称
 */
export function getBasename(path: string): string {
  path = normalizePath(path);
  
  // 根路径的基本名称为空字符串
  if (path === '/') {
    return '';
  }
  
  const lastSlashIndex = path.lastIndexOf('/');
  return path.slice(lastSlashIndex + 1);
}

/**
 * 创建基本认证头
 * @param username 用户名
 * @param password 密码
 * @returns 基本认证头
 */
export function createBasicAuthHeader(username: string, password: string): string {
  // 在浏览器和 Node.js 环境中都可用的 btoa 实现
  const btoa = (str: string) => {
    if (typeof window !== 'undefined' && window.btoa) {
      return window.btoa(str);
    } else if (typeof Buffer !== 'undefined') {
      return Buffer.from(str).toString('base64');
    } else {
      throw new Error('Base64 encoding not available');
    }
  };
  
  return `Basic ${btoa(`${username}:${password}`)}`;
}

/**
 * 解析 WebDAV 响应中的属性
 * @param xml XML 文档
 * @returns 解析后的属性对象
 */
export function parseWebDAVProperties(xml: Document): Record<string, any> {
  const result: Record<string, any> = {};
  
  // 查找所有 prop 元素
  const propElements = xml.getElementsByTagNameNS(WebDAVNamespace.DAV, 'prop');
  
  for (let i = 0; i < propElements.length; i++) {
    const propElement = propElements[i];
    
    // 遍历 prop 元素的子元素
    for (let j = 0; j < propElement.childNodes.length; j++) {
      const childNode = propElement.childNodes[j];
      
      if (childNode.nodeType === Node.ELEMENT_NODE) {
        const element = childNode as Element;
        const localName = element.localName;
        const namespace = element.namespaceURI;
        
        // 根据属性类型进行特殊处理
        if (localName === WebDAVPropName.RESOURCE_TYPE) {
          // 资源类型
          if (element.getElementsByTagNameNS(WebDAVNamespace.DAV, 'collection').length > 0) {
            result.resourceType = WebDAVResourceType.DIRECTORY;
          } else {
            result.resourceType = WebDAVResourceType.FILE;
          }
        } else if (localName === WebDAVPropName.GET_CONTENT_LENGTH) {
          // 内容长度
          result.size = parseInt(element.textContent || '0', 10);
        } else if (localName === WebDAVPropName.GET_LAST_MODIFIED) {
          // 最后修改时间
          result.lastModified = new Date(element.textContent || '');
        } else if (localName === WebDAVPropName.CREATION_DATE) {
          // 创建时间
          result.createdAt = new Date(element.textContent || '');
        } else if (localName === WebDAVPropName.DISPLAY_NAME) {
          // 显示名称
          result.displayName = element.textContent || '';
        } else if (localName === WebDAVPropName.GET_CONTENT_TYPE) {
          // 内容类型
          result.mimeType = element.textContent || '';
        } else if (localName === WebDAVPropName.ETAG) {
          // ETag
          result.etag = element.textContent || '';
        } else {
          // 其他属性
          const key = `${namespace || ''}:${localName}`;
          result[key] = element.textContent || '';
        }
      }
    }
  }
  
  return result;
}

/**
 * 解析 WebDAV 多状态响应
 * @param xml XML 文档
 * @returns 解析后的响应数组
 */
export function parseMultiStatus(xml: Document): Array<{
  href: string;
  status?: string;
  statusCode?: number;
  properties: Record<string, any>;
}> {
  const result: Array<{
    href: string;
    status?: string;
    statusCode?: number;
    properties: Record<string, any>;
  }> = [];
  
  // 查找所有 response 元素
  const responseElements = xml.getElementsByTagNameNS(WebDAVNamespace.DAV, 'response');
  
  for (let i = 0; i < responseElements.length; i++) {
    const responseElement = responseElements[i];
    
    // 获取 href
    const hrefElement = responseElement.getElementsByTagNameNS(WebDAVNamespace.DAV, 'href')[0];
    const href = hrefElement ? decodeURIComponent(hrefElement.textContent || '') : '';
    
    // 获取状态
    const statusElement = responseElement.getElementsByTagNameNS(WebDAVNamespace.DAV, 'status')[0];
    const status = statusElement ? statusElement.textContent || '' : undefined;
    
    // 解析状态码
    let statusCode: number | undefined;
    if (status) {
      const match = status.match(/HTTP\/\d+\.\d+\s+(\d+)/);
      if (match) {
        statusCode = parseInt(match[1], 10);
      }
    }
    
    // 解析属性
    const properties = parseWebDAVProperties(responseElement as unknown as Document);
    
    result.push({
      href,
      status,
      statusCode,
      properties,
    });
  }
  
  return result;
}

/**
 * 创建 PROPFIND 请求体
 * @param props 要查询的属性
 * @returns XML 字符串
 */
export function createPropfindXml(props: string[] = []): string {
  if (props.length === 0) {
    // 查询所有属性
    return `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="${WebDAVNamespace.DAV}">
  <d:allprop/>
</d:propfind>`;
  } else {
    // 查询指定属性
    const propXml = props.map(prop => `<d:${prop}/>`).join('');
    
    return `<?xml version="1.0" encoding="utf-8" ?>
<d:propfind xmlns:d="${WebDAVNamespace.DAV}">
  <d:prop>
    ${propXml}
  </d:prop>
</d:propfind>`;
  }
}

/**
 * 创建 PROPPATCH 请求体
 * @param props 要设置的属性
 * @returns XML 字符串
 */
export function createProppatchXml(props: Record<string, string>): string {
  const propXml = Object.entries(props)
    .map(([key, value]) => `<d:${key}>${value}</d:${key}>`)
    .join('');
  
  return `<?xml version="1.0" encoding="utf-8" ?>
<d:propertyupdate xmlns:d="${WebDAVNamespace.DAV}">
  <d:set>
    <d:prop>
      ${propXml}
    </d:prop>
  </d:set>
</d:propertyupdate>`;
}

/**
 * 将 WebDAV 属性转换为 Stats 对象
 * @param href 资源路径
 * @param properties 属性
 * @returns Stats 对象
 */
export function propertiesToStats(href: string, properties: Record<string, any>): Stats {
  const name = getBasename(href);
  const isDirectory = properties.resourceType === WebDAVResourceType.DIRECTORY;
  
  return {
    isDirectory,
    isFile: !isDirectory,
    size: properties.size || 0,
    createdAt: properties.createdAt || new Date(),
    lastModified: properties.modifiedAt || new Date(),
    name,
    path: href,
    mimeType: properties.mimeType,
    etag: properties.etag,
    ...properties,
  };
}

/**
 * 解析 XML 字符串
 * @param xmlString XML 字符串
 * @returns XML 文档
 */
export function parseXml(xmlString: string): Document {
  if (typeof DOMParser !== 'undefined') {
    // 浏览器环境
    const parser = new DOMParser();
    return parser.parseFromString(xmlString, 'application/xml');
  } else if (typeof window === 'undefined') {
    // Node.js 环境
    try {
      // 尝试使用 xmldom
      const { DOMParser } = require('xmldom');
      return new DOMParser().parseFromString(xmlString, 'application/xml');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new WebDAVError(`无法解析 XML: ${errorMessage}。在 Node.js 环境中，请安装 xmldom 包。`);
    }
  } else {
    throw new WebDAVError('无法解析 XML。未找到 XML 解析器。');
  }
}

/**
 * 检查响应是否成功
 * @param response 响应对象
 * @returns 是否成功
 */
export function isSuccessStatus(status: number): boolean {
  return status >= 200 && status < 300;
}

/**
 * 从 URL 中提取路径
 * @param url URL
 * @param baseUrl 基础 URL
 * @returns 路径
 */
export function extractPathFromUrl(url: string, baseUrl: string): string {
  // 移除基础 URL
  if (url.startsWith(baseUrl)) {
    url = url.slice(baseUrl.length);
  }
  
  // 解码 URL
  url = decodeURIComponent(url);
  
  // 规范化路径
  return normalizePath(url);
}

/**
 * 创建超时 Promise
 * @param ms 超时时间（毫秒）
 * @returns Promise
 */
export function createTimeoutPromise(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new WebDAVError(`请求超时（${ms}ms）`));
    }, ms);
  });
}

/**
 * 创建 AbortController
 * @returns AbortController 或 undefined
 */
export function createAbortController(): AbortController | undefined {
  if (typeof AbortController !== 'undefined') {
    return new AbortController();
  }
  return undefined;
}

/**
 * 检查是否支持 Blob
 * @returns 是否支持
 */
export function isBlobSupported(): boolean {
  return typeof Blob !== 'undefined';
}

/**
 * 检查是否支持 ArrayBuffer
 * @returns 是否支持
 */
export function isArrayBufferSupported(): boolean {
  return typeof ArrayBuffer !== 'undefined';
}

/**
 * 将数据转换为 ArrayBuffer
 * @param data 数据
 * @returns ArrayBuffer
 */
export async function toArrayBuffer(data: string | ArrayBuffer | Blob): Promise<ArrayBuffer> {
  if (data instanceof ArrayBuffer) {
    return data;
  } else if (typeof Blob !== 'undefined' && data instanceof Blob) {
    return await data.arrayBuffer();
  } else if (typeof data === 'string') {
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(data).buffer;
    } else if (typeof Buffer !== 'undefined') {
      return Buffer.from(data).buffer;
    } else {
      throw new WebDAVError('无法将字符串转换为 ArrayBuffer');
    }
  } else {
    throw new WebDAVError('不支持的数据类型');
  }
}

/**
 * 将 ArrayBuffer 转换为字符串
 * @param buffer ArrayBuffer
 * @param encoding 编码
 * @returns 字符串
 */
export function arrayBufferToString(buffer: ArrayBuffer, encoding = 'utf-8'): string {
  if (typeof TextDecoder !== 'undefined') {
    // 浏览器环境
    const decoder = new TextDecoder(encoding);
    return decoder.decode(buffer);
  } else if (typeof Buffer !== 'undefined') {
    // Node.js 环境
    return Buffer.from(buffer).toString(encoding as BufferEncoding);
  } else {
    throw new WebDAVError('无法将 ArrayBuffer 转换为字符串，当前环境不支持 TextDecoder 或 Buffer');
  }
}

/**
 * 根据文件名获取Content-Type
 * @param filename 文件名
 * @returns Content-Type字符串
 */
export function getContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'txt': return 'text/plain';
    case 'html': case 'htm': return 'text/html';
    case 'json': return 'application/json';
    case 'xml': return 'application/xml';
    case 'jpg': case 'jpeg': return 'image/jpeg';
    case 'png': return 'image/png';
    case 'gif': return 'image/gif';
    case 'pdf': return 'application/pdf';
    case 'csv': return 'text/csv';
    case 'js': return 'application/javascript';
    case 'css': return 'text/css';
    case 'zip': return 'application/zip';
    default: return 'application/octet-stream';
  }
}

// 获取路径的父目录
export function getDirFromPath(path: string): string {
  if (!path || path === '/') return '/';
  const normalized = path.replace(/\/+$/, '');
  const idx = normalized.lastIndexOf('/');
  if (idx <= 0) return '/';
  return normalized.slice(0, idx) || '/';
}

/**
 * 解析WebDAV PROPFIND XML响应，返回文件/目录信息数组
 * @param xml XML字符串
 * @param basePath 基础路径
 * @returns Stats[]
 */

export function parseWebDAVXml(xml: string, basePath: string): Stats[] {
  // 简单实现，实际可用 xml2js、fast-xml-parser 等库解析
  // 这里只做最基础的兼容，建议根据实际WebDAV响应完善
  const decode = require('he').decode;
  const result: Stats[] = [];
  if (!xml) return result;
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    trimValues: true
  });
  const json = parser.parse(xml);
  // 兼容不同大小写的 multistatus/response 属性
  function getCaseInsensitive(obj: unknown, ...keys: string[]): unknown {
    if (!obj) return undefined;
    for (const key of keys) {
      if ((obj as Record<string, unknown>)[key] !== undefined) return (obj as Record<string, unknown>)[key];
      const found = Object.keys(obj).find(k => k.toLowerCase() === key.toLowerCase());
      if (found) return (obj as Record<string, unknown>)[found];
    }
    return undefined;
  }
  const multistatus = getCaseInsensitive(json, 'd:multistatus', 'multistatus');
  const responses = getCaseInsensitive(multistatus, 'd:response', 'response') || [];
  const arr = Array.isArray(responses) ? responses : [responses];
  const isBasePathFile = basePath && !basePath.endsWith('/');
  for (const item of arr) {
    const href = decode(getCaseInsensitive(item, 'd:href', 'href') || '');
    const propstat = getCaseInsensitive(item, 'd:propstat', 'propstat', 'd:prop', 'prop') || {};
    const prop = getCaseInsensitive(propstat, 'd:prop', 'prop') || propstat;
    const resourcetype = getCaseInsensitive(prop, 'd:resourcetype', 'resourcetype');
    const collection = resourcetype && getCaseInsensitive(resourcetype, 'd:collection', 'collection');
    const isDirectory = !!(resourcetype && collection !== undefined);

    // 如果basePath是文件，则直接取文件名，否则去除basePath前缀
    let name: string;
    if (isBasePathFile) {
      name = href.split('/').filter(Boolean).pop() || '';
    } else {
      name = href.replace(basePath, '').replace(/^\//, '').replace(/\/$/, '');
    }
    if (!name) continue;
    result.push({
      path: href,
      name,
      isDirectory,
      isFile: !isDirectory,
      size: parseInt(String(getCaseInsensitive(prop, 'd:getcontentlength', 'getcontentlength') ?? '0'), 10),
      lastModified: getCaseInsensitive(prop, 'd:getlastmodified', 'getlastmodified')
        ? new Date(String(getCaseInsensitive(prop, 'd:getlastmodified', 'getlastmodified')))
        : undefined,
    });
  }
  return result;
}

/**
 * 拼接URL路径，自动处理斜杠
 * @param base 基础URL
 * @param paths 追加的路径
 * @returns 拼接后的URL
 */
export function joinUrl(base: string, ...paths: string[]): string {
  let url = base;
  let basePath = '';
  try {
    const u = new URL(base);
    basePath = u.pathname.replace(/\/+$/, '');
  } catch {
    basePath = base.startsWith('/') ? base.replace(/\/+$/, '') : '';
  }
  // 只处理第一个 path，只去除与 basePath 第一部分相同的部分
  if (paths.length > 0 && basePath) {
    let p = paths[0];
    if (p) {
      // 取 basePath 的第一部分
      const baseFirst = basePath.split('/').filter(Boolean)[0];
      const pParts = p.split('/').filter(Boolean);
      if (baseFirst && pParts[0] === baseFirst) {
        pParts.shift();
        p = pParts.join('/');
        if (p && !p.startsWith('/')) p = '/' + p;
        paths[0] = p;
      }
    }
  }
  for (const p of paths) {
    if (!p) continue;
    if (!url.endsWith('/')) url += '/';
    url += p.startsWith('/') ? p.slice(1) : p;
  }
  url = url.replace(/([^:]\/)\/+/g, '$1');
  return url;
}