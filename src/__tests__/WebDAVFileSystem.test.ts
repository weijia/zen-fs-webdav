import { WebDAVFileSystem, WebDAVError } from '../index';

// 模拟 fetch API
global.fetch = jest.fn();
global.DOMParser = jest.fn(() => ({
  parseFromString: jest.fn(() => ({
    querySelectorAll: jest.fn(() => []),
    querySelector: jest.fn(),
  })),
}));

describe('WebDAVFileSystem', () => {
  let fs: WebDAVFileSystem;
  
  beforeEach(() => {
    // 重置所有模拟
    jest.resetAllMocks();
    
    // 创建 WebDAVFileSystem 实例
    fs = new WebDAVFileSystem({
      baseUrl: 'https://example.com/webdav',
      username: 'user',
      password: 'pass',
    });
    
    // 模拟 fetch 成功响应
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue(''),
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
      body: new ReadableStream(),
    });
  });

  describe('constructor', () => {
    it('should create instance with basic auth', () => {
      const fs = new WebDAVFileSystem({
        baseUrl: 'https://example.com/webdav',
        username: 'user',
        password: 'pass',
      });
      
      expect(fs).toBeInstanceOf(WebDAVFileSystem);
    });
    
    it('should create instance with token auth', () => {
      const fs = new WebDAVFileSystem({
        baseUrl: 'https://example.com/webdav',
        token: 'my-token',
      });
      
      expect(fs).toBeInstanceOf(WebDAVFileSystem);
    });
    
    it('should create instance without auth', () => {
      const fs = new WebDAVFileSystem({
        baseUrl: 'https://example.com/webdav',
      });
      
      expect(fs).toBeInstanceOf(WebDAVFileSystem);
    });
  });

  describe('exists', () => {
    it('should return true when file exists', async () => {
      const result = await fs.exists('/file.txt');
      
      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webdav/file.txt',
        expect.objectContaining({ method: 'HEAD' })
      );
    });
    
    it('should return false when file does not exist', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
      });
      
      const result = await fs.exists('/not-found.txt');
      
      expect(result).toBe(false);
    });
  });

  describe('readFile', () => {
    it('should read file as text', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('file content'),
        arrayBuffer: jest.fn(),
      });
      
      const content = await fs.readFile('/file.txt');
      
      expect(content).toBe('file content');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webdav/file.txt',
        expect.objectContaining({ method: 'GET' })
      );
    });
    
    it('should read file as arraybuffer', async () => {
      const buffer = new ArrayBuffer(10);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn(),
        arrayBuffer: jest.fn().mockResolvedValue(buffer),
      });
      
      const content = await fs.readFile('/file.bin', { responseType: 'arraybuffer' });
      
      expect(content).toBe(buffer);
    });
    
    it('should throw error when file does not exist', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
      });
      
      await expect(fs.readFile('/not-found.txt')).rejects.toThrow(WebDAVError);
    });
  });

  describe('writeFile', () => {
    it('should write text content to file', async () => {
      await fs.writeFile('/file.txt', 'new content');
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webdav/file.txt',
        expect.objectContaining({
          method: 'PUT',
          body: 'new content',
        })
      );
    });
    
    it('should write binary content to file', async () => {
      const buffer = new ArrayBuffer(10);
      await fs.writeFile('/file.bin', buffer);
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webdav/file.bin',
        expect.objectContaining({
          method: 'PUT',
          body: buffer,
        })
      );
    });
  });

  describe('mkdir', () => {
    it('should create directory', async () => {
      await fs.mkdir('/new-dir');
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webdav/new-dir',
        expect.objectContaining({ method: 'MKCOL' })
      );
    });
  });

  describe('unlink', () => {
    it('should delete file', async () => {
      await fs.unlink('/file.txt');
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webdav/file.txt',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('rmdir', () => {
    it('should delete directory', async () => {
      await fs.rmdir('/dir');
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webdav/dir',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('copy', () => {
    it('should copy file', async () => {
      await fs.copy('/source.txt', '/dest.txt');
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webdav/source.txt',
        expect.objectContaining({
          method: 'COPY',
          headers: expect.objectContaining({
            'Destination': 'https://example.com/webdav/dest.txt',
          }),
        })
      );
    });
  });

  describe('move', () => {
    it('should move file', async () => {
      await fs.move('/source.txt', '/dest.txt');
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webdav/source.txt',
        expect.objectContaining({
          method: 'MOVE',
          headers: expect.objectContaining({
            'Destination': 'https://example.com/webdav/dest.txt',
          }),
        })
      );
    });
  });

  describe('error handling', () => {
    it('should handle authentication error', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
      });
      
      await expect(fs.readFile('/file.txt')).rejects.toThrow('认证失败');
    });
    
    it('should handle permission error', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 403,
      });
      
      await expect(fs.readFile('/file.txt')).rejects.toThrow('权限被拒绝');
    });
    
    it('should handle not found error', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
      });
      
      await expect(fs.readFile('/file.txt')).rejects.toThrow('文件未找到');
    });
    
    it('should handle network error', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
      
      await expect(fs.readFile('/file.txt')).rejects.toThrow('网络错误');
    });
  });
});