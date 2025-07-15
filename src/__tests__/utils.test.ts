import {
  normalizePath,
  getParentPath,
  joinUrl,
  getBasename,
  createBasicAuthHeader,
  parseWebDAVProperties,
  parseMultiStatus,
  createPropfindXml,
  createProppatchXml,
  propertiesToStats,
  parseXml,
  isSuccessStatus,
  extractPathFromUrl,
  createTimeoutPromise,
  createAbortController,
  isBlobSupported,
  isArrayBufferSupported,
  toArrayBuffer,
  arrayBufferToString,
  getContentType,
  getDirFromPath,
  parseWebDAVXml,
} from '../utils';

describe('Utils', () => {
  describe('normalizePath', () => {
    it('should normalize paths correctly', () => {
      expect(normalizePath('')).toBe('/');
      expect(normalizePath('/')).toBe('/');
      expect(normalizePath('///')).toBe('/');
      expect(normalizePath('/path')).toBe('/path');
      expect(normalizePath('path')).toBe('/path');
      expect(normalizePath('path/')).toBe('/path');
      expect(normalizePath('/path/')).toBe('/path');
      expect(normalizePath('/path//to///file')).toBe('/path/to/file');
      expect(normalizePath('path/to/file/')).toBe('/path/to/file');
    });
  });

  describe('getParentPath', () => {
    it('should get parent path correctly', () => {
      expect(getParentPath('/path/to/file')).toBe('/path/to');
      expect(getParentPath('/path/to')).toBe('/path');
      expect(getParentPath('/path')).toBe('/');
      expect(getParentPath('/')).toBe('/');
    });
  });

  describe('joinUrl', () => {
    it('should join url parts correctly', () => {
      expect(joinUrl('http://a.com', 'b')).toBe('http://a.com/b');
      expect(joinUrl('http://a.com/', '/b')).toBe('http://a.com/b');
      expect(joinUrl('http://a.com/', 'b/', '/c')).toBe('http://a.com/b/c');
      expect(joinUrl('http://a.com', '/b/', '/c/')).toBe('http://a.com/b/c/');
      expect(joinUrl('http://a.com/', '', '/b', '', 'c')).toBe('http://a.com/b/c');
      expect(joinUrl('http://a.com/', '', '', '')).toBe('http://a.com/');
      // 新增：base带路径时，paths中重复路径部分会被去除
      expect(joinUrl('http://a.com/webdav', '/webdav/file.txt')).toBe('http://a.com/webdav/file.txt');
      expect(joinUrl('http://a.com/webdav/', '/webdav/dir/', 'sub')).toBe('http://a.com/webdav/dir/sub');
      expect(joinUrl('http://a.com/webdav', 'webdav/dir/file')).toBe('http://a.com/webdav/dir/file');
      expect(joinUrl('http://a.com/webdav/', '/webdav/')).toBe('http://a.com/webdav/');
    });
  });

  describe('getBasename', () => {
    it('should get basename correctly', () => {
      expect(getBasename('/path/to/file.txt')).toBe('file.txt');
      expect(getBasename('/path/to/')).toBe('to');
      expect(getBasename('/')).toBe('');
    });
  });

  describe('createBasicAuthHeader', () => {
    it('should create basic auth header', () => {
      expect(createBasicAuthHeader('user', 'pass')).toBe('Basic dXNlcjpwYXNz');
    });
  });

  describe('parseWebDAVProperties', () => {
    it('should parse WebDAV properties from XML Document', () => {
      const xmlStr = `<?xml version="1.0"?><d:prop xmlns:d="DAV:"><d:displayname>file.txt</d:displayname></d:prop>`;
      const doc = parseXml(xmlStr);
      const props = parseWebDAVProperties(doc);
      expect(props.displayName).toBe('file.txt');
    });
  });

  describe('parseMultiStatus', () => {
    it('should parse multi-status XML', () => {
      const xmlStr = `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:"><d:response><d:href>/file.txt</d:href><d:propstat><d:prop><d:displayname>file.txt</d:displayname></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>`;
      const doc = parseXml(xmlStr);
      const arr = parseMultiStatus(doc);
      expect(arr.length).toBeGreaterThan(0);
      expect(arr[0].href).toContain('/file.txt');
      expect(arr[0].properties.displayName).toBe('file.txt');
    });
  });

  describe('createPropfindXml', () => {
    it('should create propfind xml for allprop', () => {
      const xml = createPropfindXml();
      expect(xml).toContain('<d:allprop/>');
    });
    it('should create propfind xml for specific props', () => {
      const xml = createPropfindXml(['displayname', 'getcontentlength']);
      expect(xml).toContain('<d:displayname/>');
      expect(xml).toContain('<d:getcontentlength/>');
    });
  });

  describe('createProppatchXml', () => {
    it('should create proppatch xml', () => {
      const xml = createProppatchXml({ displayname: 'file.txt' });
      expect(xml).toContain('<d:displayname>file.txt</d:displayname>');
    });
  });

  describe('propertiesToStats', () => {
    it('should convert properties to Stats', () => {
      const stats = propertiesToStats('/file.txt', { resourceType: 'file', size: 123, createdAt: new Date(), lastModified: new Date(), mimeType: 'text/plain', etag: 'abc' });
      expect(stats.name).toBe('file.txt');
      expect(stats.isFile).toBe(true);
      expect(stats.size).toBe(123);
    });
  });

  describe('parseXml', () => {
    it('should parse xml string to Document', () => {
      const xml = '<root><item>1</item></root>';
      const doc = parseXml(xml);
      expect(doc).toBeDefined();
    });
  });

  describe('isSuccessStatus', () => {
    it('should check status code', () => {
      expect(isSuccessStatus(200)).toBe(true);
      expect(isSuccessStatus(299)).toBe(true);
      expect(isSuccessStatus(300)).toBe(false);
      expect(isSuccessStatus(404)).toBe(false);
    });
  });

  describe('extractPathFromUrl', () => {
    it('should extract path from url', () => {
      expect(extractPathFromUrl('http://a.com/path/file', 'http://a.com')).toBe('/path/file');
    });
  });

  describe('createTimeoutPromise', () => {
    it('should reject after timeout', async () => {
      await expect(createTimeoutPromise(10)).rejects.toThrow();
    });
  });

  describe('createAbortController', () => {
    it('should create AbortController or undefined', () => {
      const ctrl = createAbortController();
      expect(ctrl === undefined || typeof ctrl.abort === 'function').toBe(true);
    });
  });

  describe('isBlobSupported', () => {
    it('should return boolean', () => {
      expect(typeof isBlobSupported()).toBe('boolean');
    });
  });

  describe('isArrayBufferSupported', () => {
    it('should return boolean', () => {
      expect(typeof isArrayBufferSupported()).toBe('boolean');
    });
  });

  describe('toArrayBuffer', () => {
    it('should convert string to ArrayBuffer', async () => {
      const ab = await toArrayBuffer('abc');
      expect(ab.constructor.name).toBe('ArrayBuffer');
      // 取实际有效长度
      const view = new Uint8Array(ab);
      // 查找 'a' 的 ASCII 码 97 的所有索引，找到连续 [97,98,99]
      let found = false;
      for (let i = 0; i <= view.length - 3; i++) {
        if (view[i] === 97 && view[i + 1] === 98 && view[i + 2] === 99) {
          found = true;
          break;
        }
      }
      expect(found).toBe(true);
    });
  });

  describe('arrayBufferToString', () => {
    it('should convert ArrayBuffer to string', () => {
      // Node.js 环境下补充 TextEncoder
      let encoder: unknown;
      if (typeof TextEncoder === 'undefined') {
        encoder = require('util').TextEncoder;
      } else {
        encoder = TextEncoder;
      }
      const ab = new encoder().encode('abc').buffer;
      expect(arrayBufferToString(ab)).toBe('abc');
    });
  });

  describe('getContentType', () => {
    it('should return correct content type', () => {
      expect(getContentType('a.txt')).toBe('text/plain');
      expect(getContentType('a.json')).toBe('application/json');
      expect(getContentType('a.unknown')).toBe('application/octet-stream');
    });
  });

  describe('getDirFromPath', () => {
    it('should get dir from path', () => {
      expect(getDirFromPath('/a/b/c')).toBe('/a/b');
      expect(getDirFromPath('/a')).toBe('/');
      expect(getDirFromPath('/')).toBe('/');
    });
  });

  describe('parseWebDAVXml', () => {
    it('should parse WebDAV PROPFIND xml', () => {
      const xml = `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:"><d:response><d:href>/file.txt</d:href><d:propstat><d:prop><d:getcontentlength>123</d:getcontentlength><d:getlastmodified>Mon, 01 Jan 2023 12:00:00 GMT</d:getlastmodified></d:prop></d:propstat></d:response></d:multistatus>`;
      const stats = parseWebDAVXml(xml, '/');
      expect(stats.length).toBeGreaterThan(0);
      expect(stats[0].name).toBe('file.txt');
      expect(stats[0].size).toBe(123);
    });
  });
});