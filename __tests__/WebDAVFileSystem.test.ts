import { WebDAVFileSystem } from '../src/WebDAVFileSystem';
import { WebDAVError } from '../src/WebDAVError';

// 模拟 fetch 函数
global.fetch = jest.fn();

describe('WebDAVFileSystem', () => {
  let fs: WebDAVFileSystem;
  
  beforeEach(() => {
    // 重置 fetch 模拟
    (global.fetch as jest.Mock).mockReset();
    
    // 创建 WebDAVFileSystem 实例
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
        })
      );
    });
    
    it('应该返回 false，当文件不存在时', async () => {
      // 模拟 404 响应
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });
      
      const result = await fs.exists('/nonexistent.txt');
      
      expect(result).toBe(false);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webdav/nonexistent.txt',
        expect.objectContaining({
          method: 'HEAD',
        })
      );
    });
    
    it('应该抛出错误，当服务器返回非 404 错误时', async () => {
      // 模拟 500 响应
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });
      
      await expect(fs.exists('/error.txt')).rejects.toThrow(WebDAVError);
    });
  });
  
  describe('readFile', () => {
    it('应该返回文件内容，当文件存在时', async () => {
      const fileContent = 'Hello, World!';
      
      // 模拟成功的响应
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValueOnce(fileContent),
      });
      
      const result = await fs.readFile('/test.txt');
      
      expect(result).toBe(fileContent);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webdav/test.txt',
        expect.objectContaining({
          method: 'GET',
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
      
      await expect(fs.readFile('/nonexistent.txt')).rejects.toThrow(WebDAVError);
    });
  });
  
  describe('writeFile', () => {
    it('应该成功写入文件', async () => {
      const fileContent = 'Hello, World!';
      
      // 模拟成功的响应
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 201,
      });
      
      await fs.writeFile('/test.txt', fileContent);
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webdav/test.txt',
        expect.objectContaining({
          method: 'PUT',
          body: fileContent,
        })
      );
    });
    
    it('应该抛出错误，当写入失败时', async () => {
      const fileContent = 'Hello, World!';
      
      // 模拟失败的响应
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });
      
      await expect(fs.writeFile('/error.txt', fileContent)).rejects.toThrow(WebDAVError);
    });
  });
  
  // 可以添加更多测试...
});