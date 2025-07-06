/**
 * WebDAV 文件系统测试
 */

import { createWebDAVFileSystem } from '../src/webdav';
import { WebDAVOptions } from '../src/types';

// 模拟 fetch API
global.fetch = jest.fn();
global.AbortSignal = {
  timeout: jest.fn(() => ({})),
} as any;

// 模拟 DOMParser
global.DOMParser = jest.fn(() => ({
  parseFromString: jest.fn(() => {
    const mockDocument = {
      getElementsByTagNameNS: jest.fn(() => []),
    };
    return mockDocument as any;
  }),
})) as any;

// 模拟 btoa
global.btoa = jest.fn((str) => Buffer.from(str).toString('base64'));

describe('WebDAV FileSystem', () => {
  let mockFetch: jest.Mock;
  
  beforeEach(() => {
    mockFetch = global.fetch as jest.Mock;
    mockFetch.mockClear();
    mockFetch.mockImplementation(() => 
      Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: () => Promise.resolve(''),
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
        headers: new Map(),
      })
    );
  });
  
  const options: WebDAVOptions = {
    baseUrl: 'https://example.com/webdav',
    username: 'user',
    password: 'password',
  };
  
  describe('Basic Operations', () => {
    test('should create WebDAV filesystem', () => {
      const fs = createWebDAVFileSystem(options);
      expect(fs).toBeDefined();
      expect(typeof fs.readFile).toBe('function');
      expect(typeof fs.writeFile).toBe('function');
      expect(typeof fs.readdir).toBe('function');
    });
    
    test('should normalize baseUrl', () => {
      const fs = createWebDAVFileSystem(options);
      
      // 测试读取文件
      fs.readFile('/test.txt');
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/webdav/test.txt',
        expect.objectContaining({
          method: 'GET',
        })
      );
    });
    
    test('should add basic auth header', () => {
      const fs = createWebDAVFileSystem(options);
      
      fs.readFile('/test.txt');
      
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Basic dXNlcjpwYXNzd29yZA==',
          }),
        })
      );
    });
  });
  
  describe('File Operations', () => {
    test('should read file as text', async () => {
      mockFetch.mockImplementationOnce(() => 
        Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          text: () => Promise.resolve('file content'),
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
          headers: new Map(),
        })
      );
      
      const fs = createWebDAVFileSystem(options);
      const content = await fs.readFile('/test.txt', 'utf8');
      
      expect(content).toBe('file content');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/webdav/test.txt',
        expect.objectContaining({
          method: 'GET',
        })
      );
    });
    
    test('should write file', async () => {
      const fs = createWebDAVFileSystem(options);
      await fs.writeFile('/test.txt', 'new content', 'utf8');
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/webdav/test.txt',
        expect.objectContaining({
          method: 'PUT',
          body: 'new content',
          headers: expect.objectContaining({
            'Content-Type': 'text/plain;charset=UTF-8',
          }),
        })
      );
    });
    
    test('should check if file exists', async () => {
      // 模拟 PROPFIND 响应
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        text: () => Promise.resolve(`
          <D:multistatus xmlns:D="DAV:">
            <D:response>
              <D:href>/webdav/test.txt</D:href>
              <D:propstat>
                <D:prop>
                  <D:resourcetype/>
                  <D:getcontentlength>123</D:getcontentlength>
                  <D:getlastmodified>Mon, 12 Jan 2020 12:00:00 GMT</D:getlastmodified>
                </D:prop>
                <D:status>HTTP/1.1 200 OK</D:status>
              </D:propstat>
            </D:response>
          </D:multistatus>
        `),
        headers: new Map(),
      };
      
      mockFetch.mockImplementationOnce(() => Promise.resolve(mockResponse));
      
      const fs = createWebDAVFileSystem(options);
      const exists = await fs.exists('/test.txt');
      
      expect(exists).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/webdav/test.txt',
        expect.objectContaining({
          method: 'PROPFIND',
          headers: expect.objectContaining({
            'Depth': '0',
          }),
        })
      );
    });
  });
  
  describe('Directory Operations', () => {
    test('should create directory', async () => {
      const fs = createWebDAVFileSystem(options);
      await fs.mkdir('/new-folder');
      
      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/webdav/new-folder',
        expect.objectContaining({
          method: 'MKCOL',
        })
      );
    });
    
    test('should list directory contents', async () => {
      // 模拟 PROPFIND 响应
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        text: () => Promise.resolve(`
          <D:multistatus xmlns:D="DAV:">
            <D:response>
              <D:href>/webdav/folder/</D:href>
              <D:propstat>
                <D:prop>
                  <D:resourcetype>
                    <D:collection/>
                  </D:resourcetype>
                </D:prop>
                <D:status>HTTP/1.1 200 OK</D:status>
              </D:propstat>
            </D:response>
            <D:response>
              <D:href>/webdav/folder/file1.txt</D:href>
              <D:propstat>
                <D:prop>
                  <D:resourcetype/>
                </D:prop>
                <D:status>HTTP/1.1 200 OK</D:status>
              </D:propstat>
            </D:response>
            <D:response>
              <D:href>/webdav/folder/file2.txt</D:href>
              <D:propstat>
                <D:prop>
                  <D:resourcetype/>
                </D:prop>
                <D:status>HTTP/1.1 200 OK</D:status>
              </D:propstat>
            </D:response>
          </D:multistatus>
        `),
        headers: new Map(),
      };
      
      mockFetch.mockImplementationOnce(() => Promise.resolve(mockResponse));
      
      const fs = createWebDAVFileSystem(options);
      const entries = await fs.readdir('/folder');
      
      expect(entries).toEqual(['file1.txt', 'file2.txt']);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/webdav/folder',
        expect.objectContaining({
          method: 'PROPFIND',
          headers: expect.objectContaining({
            'Depth': '1',
          }),
        })
      );
    });
  });
  
  describe('Error Handling', () => {
    test('should handle not found error', async () => {
      mockFetch.mockImplementationOnce(() => 
        Promise.resolve({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          text: () => Promise.resolve(''),
          headers: new Map(),
        })
      );
      
      const fs = createWebDAVFileSystem(options);
      
      await expect(fs.readFile('/not-found.txt')).rejects.toThrow();
    });
    
    test('should handle permission denied error', async () => {
      mockFetch.mockImplementationOnce(() => 
        Promise.resolve({
          ok: false,
          status: 403,
          statusText: 'Forbidden',
          text: () => Promise.resolve(''),
          headers: new Map(),
        })
      );
      
      const fs = createWebDAVFileSystem(options);
      
      await expect(fs.readFile('/forbidden.txt')).rejects.toThrow();
    });
  });
});