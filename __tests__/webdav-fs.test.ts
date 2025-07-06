import { WebDAVFS } from '../src/webdav-fs';
import { NotFoundError, AuthenticationError } from '../src/errors';

// 模拟fetch API
global.fetch = jest.fn();

describe('WebDAVFS', () => {
  let webdav: WebDAVFS;
  
  beforeEach(() => {
    // 重置模拟
    (global.fetch as jest.Mock).mockReset();
    
    // 创建WebDAVFS实例
    webdav = new WebDAVFS({
      baseUrl: 'https://example.com/webdav',
      auth: {
        username: 'user',
        password: 'password'
      }
    });
  });
  
  describe('exists', () => {
    it('should return true when file exists', async () => {
      // 模拟成功的响应
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
      });
      
      const result = await webdav.exists('/test.txt');
      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webdav/test.txt',
        expect.objectContaining({
          method: 'HEAD',
          headers: expect.any(Headers),
        })
      );
    });
    
    it('should return false when file does not exist', async () => {
      // 模拟404响应
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Headers(),
      });
      
      const result = await webdav.exists('/nonexistent.txt');
      expect(result).toBe(false);
    });
  });
  
  describe('readFile', () => {
    it('should read file as text when encoding is provided', async () => {
      const mockText = 'file content';
      
      // 模拟成功的响应
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        text: jest.fn().mockResolvedValue(mockText),
      });
      
      const result = await webdav.readFile('/test.txt', { encoding: 'utf8' });
      expect(result).toBe(mockText);
    });
    
    it('should read file as buffer when no encoding is provided', async () => {
      const mockBuffer = Buffer.from('file content');
      
      // 模拟成功的响应
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        arrayBuffer: jest.fn().mockResolvedValue(mockBuffer),
      });
      
      const result = await webdav.readFile('/test.txt');
      expect(result).toEqual(mockBuffer);
    });
    
    it('should throw NotFoundError when file does not exist', async () => {
      // 模拟404响应
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Headers(),
      });
      
      await expect(webdav.readFile('/nonexistent.txt')).rejects.toThrow(NotFoundError);
    });
  });
  
  describe('writeFile', () => {
    it('should write string content to file', async () => {
      const content = 'file content';
      
      // 模拟成功的响应
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: new Headers(),
      });
      
      await webdav.writeFile('/test.txt', content);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webdav/test.txt',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.any(Headers),
          body: content,
        })
      );
    });
    
    it('should write buffer content to file', async () => {
      const content = Buffer.from('file content');
      
      // 模拟成功的响应
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: new Headers(),
      });
      
      await webdav.writeFile('/test.txt', content);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webdav/test.txt',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.any(Headers),
          body: content,
        })
      );
    });
  });
  
  describe('deleteFile', () => {
    it('should delete file', async () => {
      // 模拟成功的响应
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: new Headers(),
      });
      
      await webdav.deleteFile('/test.txt');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webdav/test.txt',
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.any(Headers),
        })
      );
    });
    
    it('should throw NotFoundError when file does not exist', async () => {
      // 模拟404响应
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Headers(),
      });
      
      await expect(webdav.deleteFile('/nonexistent.txt')).rejects.toThrow(NotFoundError);
    });
  });
  
  describe('readDir', () => {
    it('should read directory contents', async () => {
      const mockResponse = `<?xml version="1.0" encoding="utf-8"?>
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
      
      // 模拟成功的响应
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 207,
        headers: new Headers(),
        text: jest.fn().mockResolvedValue(mockResponse),
      });
      
      const result = await webdav.readDir('/');
      expect(result).toHaveLength(2); // 不包括当前目录
      expect(result[0].name).toBe('file1.txt');
      expect(result[0].isDirectory).toBe(false);
      expect(result[1].name).toBe('folder1');
      expect(result[1].isDirectory).toBe(true);
    });
  });
  
  describe('mkdir', () => {
    it('should create directory', async () => {
      // 模拟成功的响应
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: new Headers(),
      });
      
      await webdav.mkdir('/newfolder');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webdav/newfolder',
        expect.objectContaining({
          method: 'MKCOL',
          headers: expect.any(Headers),
        })
      );
    });
  });
  
  describe('rmdir', () => {
    it('should remove directory', async () => {
      // 模拟成功的响应
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: new Headers(),
      });
      
      await webdav.rmdir('/folder');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webdav/folder',
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.any(Headers),
        })
      );
    });
  });
  
  describe('copy', () => {
    it('should copy file', async () => {
      // 模拟成功的响应
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: new Headers(),
      });
      
      await webdav.copy('/source.txt', '/destination.txt');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webdav/source.txt',
        expect.objectContaining({
          method: 'COPY',
          headers: expect.any(Headers),
        })
      );
    });
  });
  
  describe('move', () => {
    it('should move file', async () => {
      // 模拟成功的响应
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: new Headers(),
      });
      
      await webdav.move('/source.txt', '/destination.txt');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webdav/source.txt',
        expect.objectContaining({
          method: 'MOVE',
          headers: expect.any(Headers),
        })
      );
    });
  });
  
  describe('stat', () => {
    it('should get file stats', async () => {
      const mockResponse = `<?xml version="1.0" encoding="utf-8"?>
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
      
      // 模拟成功的响应
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 207,
        headers: new Headers(),
        text: jest.fn().mockResolvedValue(mockResponse),
      });
      
      const result = await webdav.stat('/file.txt');
      expect(result.isDirectory).toBe(false);
      expect(result.size).toBe(123);
      expect(result.lastModified).toBeInstanceOf(Date);
    });
    
    it('should get directory stats', async () => {
      const mockResponse = `<?xml version="1.0" encoding="utf-8"?>
        <D:multistatus xmlns:D="DAV:">
          <D:response>
            <D:href>/webdav/folder/</D:href>
            <D:propstat>
              <D:prop>
                <D:resourcetype><D:collection/></D:resourcetype>
              </D:prop>
              <D:status>HTTP/1.1 200 OK</D:status>
            </D:propstat>
          </D:response>
        </D:multistatus>`;
      
      // 模拟成功的响应
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 207,
        headers: new Headers(),
        text: jest.fn().mockResolvedValue(mockResponse),
      });
      
      const result = await webdav.stat('/folder');
      expect(result.isDirectory).toBe(true);
    });
  });
  
  describe('authentication', () => {
    it('should throw AuthenticationError on 401 response', async () => {
      // 模拟401响应
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers(),
      });
      
      await expect(webdav.readFile('/test.txt')).rejects.toThrow(AuthenticationError);
    });
  });
});