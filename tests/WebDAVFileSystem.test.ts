import { WebDAVFileSystem } from '../src/WebDAVFileSystem';
import { WebDAVError } from '../src/WebDAVError';

// 模拟 fetch 函数
global.fetch = jest.fn();

describe('WebDAVFileSystem', () => {
  let fs: WebDAVFileSystem;
  
  beforeEach(() => {
    // 重置 fetch 模拟
    (global.fetch as jest.Mock).mockReset();
    
    // 创建 WebDAV 文件系统实例
    fs = new WebDAVFileSystem({
      baseUrl: 'https://example.com/webdav',
      username: 'user',
      password: 'pass',
    });
  });
  
  describe('exists', () => {
    it('应该返回 true，当文件存在时', async () => {
      // 模拟成功的响应
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
      });
      
      const result = await fs.exists('/test.txt');
      
      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webdav/test.txt',
        expect.objectContaining({
          method: 'HEAD',
          headers: expect.any(Object),
        })
      );
    });
    
    it('应该返回 false，当文件不存在时', async () => {
      // 模拟 404 响应
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });
      
      const result = await fs.exists('/non-existent.txt');
      
      expect(result).toBe(false);
    });
  });
  
  describe('readFile', () => {
    it('应该读取文件内容', async () => {
      const mockText = 'Hello, WebDAV!';
      
      // 模拟成功的响应
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValueOnce(mockText),
        arrayBuffer: jest.fn().mockResolvedValueOnce(new ArrayBuffer(10)),
      });
      
      const result = await fs.readFile('/test.txt');
      
      expect(result).toBe(mockText);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webdav/test.txt',
        expect.objectContaining({
          method: 'GET',
          headers: expect.any(Object),
        })
      );
    });
    
    it('应该抛出错误，当文件不存在时', async () => {
      // 模拟 404 响应
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });
      
      await expect(fs.readFile('/non-existent.txt')).rejects.toThrow(WebDAVError);
    });
  });
  
  describe('writeFile', () => {
    it('应该写入文件内容', async () => {
      const mockData = 'Hello, WebDAV!';
      
      // 模拟成功的响应
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 201,
      });
      
      await fs.writeFile('/test.txt', mockData);
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webdav/test.txt',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.any(Object),
          body: mockData,
        })
      );
    });
  });
  
  describe('mkdir', () => {
    it('应该创建目录', async () => {
      // 模拟成功的响应
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 201,
      });
      
      await fs.mkdir('/new-dir');
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webdav/new-dir',
        expect.objectContaining({
          method: 'MKCOL',
          headers: expect.any(Object),
        })
      );
    });
  });
  
  describe('readdir', () => {
    it('应该列出目录内容', async () => {
      const mockResponse = `
        <?xml version="1.0" encoding="UTF-8"?>
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
            <D:href>/webdav/file.txt</D:href>
            <D:propstat>
              <D:prop>
                <D:getcontentlength>123</D:getcontentlength>
                <D:resourcetype></D:resourcetype>
              </D:prop>
              <D:status>HTTP/1.1 200 OK</D:status>
            </D:propstat>
          </D:response>
          <D:response>
            <D:href>/webdav/folder/</D:href>
            <D:propstat>
              <D:prop>
                <D:resourcetype><D:collection/></D:resourcetype>
              </D:prop>
              <D:status>HTTP/1.1 200 OK</D:status>
            </D:propstat>
          </D:response>
        </D:multistatus>
      `;
      
      // 模拟成功的响应
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 207,
        text: jest.fn().mockResolvedValueOnce(mockResponse),
      });
      
      const result = await fs.readdir('/');
      
      expect(result).toHaveLength(2); // 不包括当前目录
      expect(result[0].name).toBe('file.txt');
      expect(result[0].isDirectory).toBe(false);
      expect(result[1].name).toBe('folder');
      expect(result[1].isDirectory).toBe(true);
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webdav/',
        expect.objectContaining({
          method: 'PROPFIND',
          headers: expect.objectContaining({
            Depth: '1',
          }),
        })
      );
    });
  });
});