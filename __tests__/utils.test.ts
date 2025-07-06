import {
  normalizePath,
  joinPaths,
  parseXML,
  parseWebDAVResponse,
  getErrorByStatusCode
} from '../src/utils';
import {
  NotFoundError,
  AuthenticationError,
  AuthorizationError,
  ServerError
} from '../src/errors';

describe('Utils', () => {
  describe('normalizePath', () => {
    it('should add leading slash if missing', () => {
      expect(normalizePath('path/to/file')).toBe('/path/to/file');
    });
    
    it('should not add leading slash if already present', () => {
      expect(normalizePath('/path/to/file')).toBe('/path/to/file');
    });
    
    it('should remove trailing slash for files', () => {
      expect(normalizePath('/path/to/file/')).toBe('/path/to/file');
    });
    
    it('should handle empty path', () => {
      expect(normalizePath('')).toBe('/');
    });
    
    it('should handle root path', () => {
      expect(normalizePath('/')).toBe('/');
    });
  });
  
  describe('joinPaths', () => {
    it('should join paths with slashes', () => {
      expect(joinPaths('base', 'path')).toBe('base/path');
    });
    
    it('should handle trailing slash in base', () => {
      expect(joinPaths('base/', 'path')).toBe('base/path');
    });
    
    it('should handle leading slash in path', () => {
      expect(joinPaths('base', '/path')).toBe('base/path');
    });
    
    it('should handle both trailing and leading slashes', () => {
      expect(joinPaths('base/', '/path')).toBe('base/path');
    });
    
    it('should handle empty base', () => {
      expect(joinPaths('', 'path')).toBe('path');
    });
    
    it('should handle empty path', () => {
      expect(joinPaths('base', '')).toBe('base');
    });
  });
  
  describe('parseXML', () => {
    it('should parse valid XML', () => {
      const xml = '<root><item>value</item></root>';
      const result = parseXML(xml);
      expect(result).toBeTruthy();
      expect(result.getElementsByTagName('item')[0].textContent).toBe('value');
    });
    
    it('should throw error for invalid XML', () => {
      const xml = '<root><item>value</item';
      expect(() => parseXML(xml)).toThrow();
    });
  });
  
  describe('parseWebDAVResponse', () => {
    it('should parse WebDAV directory listing', () => {
      const xml = `<?xml version="1.0" encoding="utf-8"?>
        <D:multistatus xmlns:D="DAV:">
          <D:response>
            <D:href>/webdav/</D:href>
            <D:propstat>
              <D:prop>
                <D:resourcetype><D:collection/></D:resourcetype>
              </D:prop>
              <D:status>HTTP/1.1 200 OK</D:status>
            </D:propstat>
          </D:response>
          <D:response>
            <D:href>/webdav/file1.txt</D:href>
            <D:propstat>
              <D:prop>
                <D:getcontentlength>123</D:getcontentlength>
                <D:getlastmodified>Mon, 12 Jan 2023 10:00:00 GMT</D:getlastmodified>
                <D:resourcetype></D:resourcetype>
              </D:prop>
              <D:status>HTTP/1.1 200 OK</D:status>
            </D:propstat>
          </D:response>
          <D:response>
            <D:href>/webdav/folder1/</D:href>
            <D:propstat>
              <D:prop>
                <D:resourcetype><D:collection/></D:resourcetype>
              </D:prop>
              <D:status>HTTP/1.1 200 OK</D:status>
            </D:propstat>
          </D:response>
        </D:multistatus>`;
      
      const result = parseWebDAVResponse(xml, '/webdav');
      expect(result).toHaveLength(3); // 包括当前目录
      
      // 当前目录
      expect(result[0].name).toBe('');
      expect(result[0].path).toBe('/');
      expect(result[0].isDirectory).toBe(true);
      
      // 文件
      expect(result[1].name).toBe('file1.txt');
      expect(result[1].path).toBe('/file1.txt');
      expect(result[1].isDirectory).toBe(false);
      expect(result[1].size).toBe(123);
      expect(result[1].lastModified).toBeInstanceOf(Date);
      
      // 文件夹
      expect(result[2].name).toBe('folder1');
      expect(result[2].path).toBe('/folder1');
      expect(result[2].isDirectory).toBe(true);
    });
    
    it('should parse WebDAV file stat', () => {
      const xml = `<?xml version="1.0" encoding="utf-8"?>
        <D:multistatus xmlns:D="DAV:">
          <D:response>
            <D:href>/webdav/file.txt</D:href>
            <D:propstat>
              <D:prop>
                <D:getcontentlength>123</D:getcontentlength>
                <D:getlastmodified>Mon, 12 Jan 2023 10:00:00 GMT</D:getlastmodified>
                <D:resourcetype></D:resourcetype>
              </D:prop>
              <D:status>HTTP/1.1 200 OK</D:status>
            </D:propstat>
          </D:response>
        </D:multistatus>`;
      
      const result = parseWebDAVResponse(xml, '/webdav');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('file.txt');
      expect(result[0].isDirectory).toBe(false);
      expect(result[0].size).toBe(123);
      expect(result[0].lastModified).toBeInstanceOf(Date);
    });
    
    it('should handle empty response', () => {
      const xml = `<?xml version="1.0" encoding="utf-8"?>
        <D:multistatus xmlns:D="DAV:">
        </D:multistatus>`;
      
      const result = parseWebDAVResponse(xml, '/webdav');
      expect(result).toHaveLength(0);
    });
  });
  
  describe('getErrorByStatusCode', () => {
    it('should return NotFoundError for 404', () => {
      const error = getErrorByStatusCode(404, 'Not Found');
      expect(error).toBeInstanceOf(NotFoundError);
    });
    
    it('should return AuthenticationError for 401', () => {
      const error = getErrorByStatusCode(401, 'Unauthorized');
      expect(error).toBeInstanceOf(AuthenticationError);
    });
    
    it('should return AuthorizationError for 403', () => {
      const error = getErrorByStatusCode(403, 'Forbidden');
      expect(error).toBeInstanceOf(AuthorizationError);
    });
    
    it('should return ServerError for 500', () => {
      const error = getErrorByStatusCode(500, 'Internal Server Error');
      expect(error).toBeInstanceOf(ServerError);
    });
    
    it('should return ServerError for other 5xx errors', () => {
      const error = getErrorByStatusCode(503, 'Service Unavailable');
      expect(error).toBeInstanceOf(ServerError);
    });
    
    it('should return WebDAVError for other status codes', () => {
      const error = getErrorByStatusCode(418, 'I\'m a teapot');
      expect(error.message).toBe('WebDAV Error: I\'m a teapot (418)');
    });
  });
});