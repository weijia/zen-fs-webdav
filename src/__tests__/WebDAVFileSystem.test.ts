import { createWebDAVFileSystem } from '../webdav';
import { WebDAVError } from '../errors';

// mock ReadableStream for Node.js environment
if (typeof global.ReadableStream === 'undefined') {
  global.ReadableStream = class MockReadableStream {} as any;
}

// 模拟 fetch API
global.fetch = jest.fn();
// Mock DOMParser to match the expected interface
class MockDOMParser {
  parseFromString() {
    return {
      querySelectorAll: jest.fn(() => []),
      querySelector: jest.fn(),
      // Add any other Document methods your code/tests may use here
    } as unknown as Document;
  }
}
global.DOMParser = MockDOMParser as unknown as typeof DOMParser;

describe('WebDAVFileSystem', () => {
  let fs: ReturnType<typeof createWebDAVFileSystem>;
  
  beforeEach(() => {
    // 重置所有模拟
    jest.resetAllMocks();
    
    // 创建 WebDAVFileSystem 实例
    fs = createWebDAVFileSystem({
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
      headers: { forEach: jest.fn() }, // 添加 headers mock
    });
  });

  describe('constructor', () => {
    it('should create instance with basic auth', () => {
      const fs = createWebDAVFileSystem({
        baseUrl: 'https://example.com/webdav',
        username: 'user',
        password: 'pass',
      });
      
      expect(fs).toBeInstanceOf(Object);
    });
    
    it('should create instance with token auth', () => {
      const fs = createWebDAVFileSystem({
        baseUrl: 'https://example.com/webdav',
        token: 'my-token',
      });
      
      expect(fs).toBeInstanceOf(Object);
    });
    
    it('should create instance without auth', () => {
      const fs = createWebDAVFileSystem({
        baseUrl: 'https://example.com/webdav',
      });
      
      expect(fs).toBeInstanceOf(Object);
    });
  });

  describe('exists', () => {
    it('should return true when file exists', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { forEach: jest.fn() },
        text: jest.fn().mockResolvedValue('<d:multistatus xmlns:d="DAV:"><d:response><d:href>/file.txt</d:href></d:response></d:multistatus>'),
        arrayBuffer: jest.fn(),
        body: new ReadableStream(),
      });
      const result = await fs.exists('/file.txt');
      
      expect(result).toBe(true);
      // 只断言 method/headers/body/credentials 字段存在即可，避免 signal 对象引用不一致导致的误报
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webdav/file.txt',
        expect.objectContaining({
          method: 'PROPFIND',
          headers: expect.objectContaining({
            Authorization: 'Basic dXNlcjpwYXNz',
            'Content-Type': 'application/xml',
            Depth: '0',
          }),
          credentials: 'include',
          body: undefined,
        })
      );
    });
    
    it('should return false when file does not exist', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        headers: { forEach: jest.fn() },
        text: jest.fn().mockResolvedValue(''), // 保证 response.text 存在
        arrayBuffer: jest.fn(),
        body: new ReadableStream(),
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
        text: jest.fn(), // 不需要 mockResolvedValue
        arrayBuffer: jest.fn().mockResolvedValue(Buffer.from('file content')),
        headers: { forEach: jest.fn() },
        body: new ReadableStream(),
      });
      
      const content = await fs.readFile('/file.txt', { encoding: 'utf-8' });
      
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
        headers: { forEach: jest.fn() },
        body: new ReadableStream(),
      });
      
      const content = await fs.readFile('/file.bin', { responseType: 'arraybuffer' });
      
      // 兼容 Buffer/ArrayBuffer 返回类型
      if (content instanceof ArrayBuffer) {
        expect(content).toBe(buffer);
      } else if (typeof Buffer !== 'undefined' && Buffer.isBuffer(content)) {
        expect(content.buffer).toBe(buffer);
      } else {
        throw new Error('Unexpected content type');
      }
    });
    
    it('should throw error when file does not exist', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        headers: { forEach: jest.fn() }, // 添加 headers mock
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
      const nodeBuffer = Buffer.from(buffer);
      await fs.writeFile('/file.bin', nodeBuffer);
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webdav/file.bin',
        expect.objectContaining({
          method: 'PUT',
          body: nodeBuffer,
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
      // mock stat 返回一个文件
      fs.stat = jest.fn().mockResolvedValue({
        isDirectory: false,
        isFile: true,
        // ...其他属性可省略...
      } as any);
      await fs.unlink('/file.txt');
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webdav/file.txt',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('rmdir', () => {
    it('should delete directory', async () => {
      // mock stat 返回一个目录
      fs.stat = jest.fn().mockResolvedValue({
        isDirectory: true,
        isFile: false,
        // ...其他属性可省略...
      } as any);
      // mock readDir 返回空数组，表示目录为空
      fs.readDir = jest.fn().mockResolvedValue([]);
      await fs.rmdir('/dir');
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webdav/dir',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('copy', () => {
    it('should copy file', async () => {
      // mock stat 返回一个文件，确保源文件存在
      fs.stat = jest.fn().mockResolvedValue({
        isDirectory: false,
        isFile: true,
      } as any);
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
      // mock stat 返回一个文件，确保源文件存在
      fs.stat = jest.fn().mockResolvedValue({
        isDirectory: false,
        isFile: true,
      } as any);
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
        headers: { forEach: jest.fn() },
        text: jest.fn().mockResolvedValue(''), // 保证 response.text 存在
        arrayBuffer: jest.fn(),
        body: new ReadableStream(),
      });
      
      await expect(fs.readFile('/file.txt')).rejects.toThrow('认证失败');
    });
    
    it('should handle permission error', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 403,
        headers: { forEach: jest.fn() },
        text: jest.fn().mockResolvedValue(''),
        arrayBuffer: jest.fn(),
        body: new ReadableStream(),
      });
      
      await expect(fs.readFile('/file.txt')).rejects.toThrow('无权限访问');
    });
    it('should handle not found error', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        headers: { forEach: jest.fn() },
        text: jest.fn().mockResolvedValue(''),
        arrayBuffer: jest.fn(),
        body: new ReadableStream(),
      });
      
      await expect(fs.readFile('/file.txt')).rejects.toThrow('文件未找到');
    });
    
    it('should handle network error', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
      
      await expect(fs.readFile('/file.txt')).rejects.toThrow('网络错误');
    });
  });
});