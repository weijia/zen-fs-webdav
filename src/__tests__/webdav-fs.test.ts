import { WebDAVFS } from '../webdav-fs';
import { WebDAVError } from '../errors';
import * as utils from '../utils';

// 模拟fetch API
global.fetch = jest.fn();

// 模拟utils模块中的函数
jest.mock('../utils', () => {
  const originalModule = jest.requireActual('../utils');
  return {
    ...originalModule,
    parseXML: jest.fn(),
    buildPropfindXML: jest.fn(),
    extractFilesFromMultistatus: jest.fn(),
    extractStatsFromProps: jest.fn(),
  };
});

describe('WebDAVFS', () => {
  let webdavFs: WebDAVFS;
  
  beforeEach(() => {
    // 重置所有模拟
    jest.clearAllMocks();
    
    // 创建WebDAVFS实例
    webdavFs = new WebDAVFS({
      baseUrl: 'https://example.com/webdav',
      auth: {
        username: 'user',
        password: 'pass'
      }
    });
    
    // 默认模拟fetch返回成功响应
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: jest.fn().mockResolvedValue(''),
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
    });
    
    // 默认模拟utils函数
    (utils.parseXML as jest.Mock).mockResolvedValue({});
    (utils.buildPropfindXML as jest.Mock).mockReturnValue('<propfind />');
    (utils.extractFilesFromMultistatus as jest.Mock).mockReturnValue([]);
    (utils.extractStatsFromProps as jest.Mock).mockReturnValue({
      name: 'file.txt',
      isDirectory: false,
      size: 0,
      lastModified: new Date(),
      contentType: 'text/plain'
    });
  });
  
  describe('constructor', () => {
    it('should create instance with default options', () => {
      const fs = new WebDAVFS({ baseUrl: 'https://example.com/webdav' });
      expect(fs).toBeInstanceOf(WebDAVFS);
    });
    
    it('should throw error if baseUrl is not provided', () => {
      expect(() => new WebDAVFS({} as any)).toThrow('baseUrl is required');
    });
  });
  
  describe('exists', () => {
    it('should return true if file exists', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
      });
      
      const result = await webdavFs.exists('/file.txt');
      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webdav/file.txt',
        expect.objectContaining({ method: 'HEAD' })
      );
    });
    
    it('should return false if file does not exist', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });
      
      const result = await webdavFs.exists('/file.txt');
      expect(result).toBe(false);
    });
  });
  
  describe('stat', () => {
    it('should get file stats', async () => {
      const mockProps = {
        'D:resourcetype': {},
        'D:getcontentlength': '100',
        'D:getlastmodified': 'Mon, 01 Jan 2023 12:00:00 GMT',
        'D:getcontenttype': 'text/plain',
      };
      
      const mockResponse = {
        'D:multistatus': {
          'D:response': [
            {
              'D:href': '/webdav/file.txt',
              'D:propstat': {
                'D:prop': mockProps,
                'D:status': 'HTTP/1.1 200 OK',
              },
            },
          ],
        },
      };
      
      (utils.parseXML as jest.Mock).mockResolvedValueOnce(mockResponse);
      
      const mockStats = {
        name: 'file.txt',
        isDirectory: false,
        size: 100,
        lastModified: new Date('2023-01-01T12:00:00Z'),
        contentType: 'text/plain',
      };
      
      (utils.extractStatsFromProps as jest.Mock).mockReturnValueOnce(mockStats);
      
      const stats = await webdavFs.stat('/file.txt');
      expect(stats).toEqual(mockStats);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webdav/file.txt',
        expect.objectContaining({ method: 'PROPFIND' })
      );
    });
    
    it('should throw error if file does not exist', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });
      
      await expect(webdavFs.stat('/file.txt')).rejects.toThrow(WebDAVError);
    });
  });
  
  describe('readDir', () => {
    it('should read directory contents', async () => {
      const mockFiles = [
        {
          name: 'file1.txt',
          isDirectory: false,
          size: 100,
          lastModified: new Date(),
          contentType: 'text/plain',
        },
        {
          name: 'dir1',
          isDirectory: true,
          size: 0,
          lastModified: new Date(),
          contentType: '',
        },
      ];
      
      (utils.extractFilesFromMultistatus as jest.Mock).mockReturnValueOnce(mockFiles);
      
      const files = await webdavFs.readDir('/dir');
      expect(files).toEqual(mockFiles);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webdav/dir',
        expect.objectContaining({ method: 'PROPFIND' })
      );
    });
    
    it('should throw error if directory does not exist', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });
      
      await expect(webdavFs.readDir('/dir')).rejects.toThrow(WebDAVError);
    });
  });
  
  describe('readFile', () => {
    it('should read text file with encoding', async () => {
      const content = 'file content';
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue(content),
      });
      
      const result = await webdavFs.readFile('/file.txt', { encoding: 'utf8' });
      expect(result).toBe(content);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webdav/file.txt',
        expect.objectContaining({ method: 'GET' })
      );
    });
    
    it('should read binary file without encoding', async () => {
      const buffer = new Uint8Array([1, 2, 3]).buffer;
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        arrayBuffer: jest.fn().mockResolvedValue(buffer),
      });
      
      const result = await webdavFs.readFile('/file.bin');
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.byteLength).toBe(3);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webdav/file.bin',
        expect.objectContaining({ method: 'GET' })
      );
    });
    
    it('should throw error if file does not exist', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });
      
      await expect(webdavFs.readFile('/file.txt')).rejects.toThrow(WebDAVError);
    });
  });
  
  describe('writeFile', () => {
    it('should write text content to file', async () => {
      const content = 'file content';
      
      await webdavFs.writeFile('/file.txt', content);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webdav/file.txt',
        expect.objectContaining({
          method: 'PUT',
          body: content,
        })
      );
    });
    
    it('should write binary content to file', async () => {
      const content = new Uint8Array([1, 2, 3]);
      
      await webdavFs.writeFile('/file.bin', content);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webdav/file.bin',
        expect.objectContaining({
          method: 'PUT',
          body: content,
        })
      );
    });
    
    it('should throw error if write fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });
      
      await expect(webdavFs.writeFile('/file.txt', 'content')).rejects.toThrow(WebDAVError);
    });
  });
  
  describe('deleteFile', () => {
    it('should delete file', async () => {
      await webdavFs.deleteFile('/file.txt');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webdav/file.txt',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
    
    it('should throw error if delete fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });
      
      await expect(webdavFs.deleteFile('/file.txt')).rejects.toThrow(WebDAVError);
    });
  });
  
  describe('mkdir', () => {
    it('should create directory', async () => {
      await webdavFs.mkdir('/dir');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webdav/dir',
        expect.objectContaining({ method: 'MKCOL' })
      );
    });
    
    it('should throw error if mkdir fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });
      
      await expect(webdavFs.mkdir('/dir')).rejects.toThrow(WebDAVError);
    });
  });
  
  describe('rmdir', () => {
    it('should remove empty directory', async () => {
      await webdavFs.rmdir('/dir');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webdav/dir',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
    
    it('should remove directory recursively', async () => {
      // 模拟目录中有文件
      const mockFiles = [
        {
          name: 'file1.txt',
          isDirectory: false,
          size: 100,
          lastModified: new Date(),
          contentType: 'text/plain',
        },
        {
          name: 'subdir',
          isDirectory: true,
          size: 0,
          lastModified: new Date(),
          contentType: '',
        },
      ];
      
      (utils.extractFilesFromMultistatus as jest.Mock).mockReturnValueOnce(mockFiles);
      
      // 模拟子目录中有文件
      const mockSubdirFiles = [
        {
          name: 'file2.txt',
          isDirectory: false,
          size: 100,
          lastModified: new Date(),
          contentType: 'text/plain',
        },
      ];
      
      (utils.extractFilesFromMultistatus as jest.Mock).mockReturnValueOnce(mockSubdirFiles);
      
      await webdavFs.rmdir('/dir', { recursive: true });
      
      // 应该先删除子目录中的文件，然后删除子目录，最后删除主目录
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webdav/dir/subdir/file2.txt',
        expect.objectContaining({ method: 'DELETE' })
      );
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webdav/dir/subdir',
        expect.objectContaining({ method: 'DELETE' })
      );
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webdav/dir/file1.txt',
        expect.objectContaining({ method: 'DELETE' })
      );
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://example.com/webdav/dir',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
    
    it('should throw error if rmdir fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });
      
      await expect(webdavFs.rmdir('/dir')).rejects.toThrow(WebDAVError);
    });
  });
  
  describe('copy', () => {
    it('should copy file', async () => {
      await webdavFs.copy('/source.txt', '/dest.txt');
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
    
    it('should throw error if copy fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });
      
      await expect(webdavFs.copy('/source.txt', '/dest.txt')).rejects.toThrow(WebDAVError);
    });
  });
  
  describe('move', () => {
    it('should move file', async () => {
      await webdavFs.move('/source.txt', '/dest.txt');
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
    
    it('should throw error if move fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });
      
      await expect(webdavFs.move('/source.txt', '/dest.txt')).rejects.toThrow(WebDAVError);
    });
  });
  
  describe('cache', () => {
    it('should use cache for stat operations', async () => {
      // 创建带缓存的实例
      const cachedFs = new WebDAVFS({
        baseUrl: 'https://example.com/webdav',
        cache: true,
        cacheExpiration: 1000,
      });
      
      const mockProps = {
        'D:resourcetype': {},
        'D:getcontentlength': '100',
        'D:getlastmodified': 'Mon, 01 Jan 2023 12:00:00 GMT',
        'D:getcontenttype': 'text/plain',
      };
      
      const mockResponse = {
        'D:multistatus': {
          'D:response': [
            {
              'D:href': '/webdav/file.txt',
              'D:propstat': {
                'D:prop': mockProps,
                'D:status': 'HTTP/1.1 200 OK',
              },
            },
          ],
        },
      };
      
      (utils.parseXML as jest.Mock).mockResolvedValue(mockResponse);
      
      const mockStats = {
        name: 'file.txt',
        isDirectory: false,
        size: 100,
        lastModified: new Date('2023-01-01T12:00:00Z'),
        contentType: 'text/plain',
      };
      
      (utils.extractStatsFromProps as jest.Mock).mockReturnValue(mockStats);
      
      // 第一次调用应该发起请求
      await cachedFs.stat('/file.txt');
      expect(global.fetch).toHaveBeenCalledTimes(1);
      
      // 第二次调用应该使用缓存
      await cachedFs.stat('/file.txt');
      expect(global.fetch).toHaveBeenCalledTimes(1); // 仍然是1次
      
      // 清除缓存
      cachedFs.clearCache();
      
      // 再次调用应该发起新请求
      await cachedFs.stat('/file.txt');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
    
    it('should use cache for readDir operations', async () => {
      // 创建带缓存的实例
      const cachedFs = new WebDAVFS({
        baseUrl: 'https://example.com/webdav',
        cache: true,
        cacheExpiration: 1000,
      });
      
      const mockFiles = [
        {
          name: 'file1.txt',
          isDirectory: false,
          size: 100,
          lastModified: new Date(),
          contentType: 'text/plain',
        },
      ];
      
      (utils.extractFilesFromMultistatus as jest.Mock).mockReturnValue(mockFiles);
      
      // 第一次调用应该发起请求
      await cachedFs.readDir('/dir');
      expect(global.fetch).toHaveBeenCalledTimes(1);
      
      // 第二次调用应该使用缓存
      await cachedFs.readDir('/dir');
      expect(global.fetch).toHaveBeenCalledTimes(1); // 仍然是1次
      
      // 清除缓存
      cachedFs.clearCache();
      
      // 再次调用应该发起新请求
      await cachedFs.readDir('/dir');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });
  
  describe('error handling', () => {
    it('should handle network errors', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
      
      await expect(webdavFs.exists('/file.txt')).rejects.toThrow(WebDAVError);
      await expect(webdavFs.exists('/file.txt')).rejects.toThrow('Network error');
    });
    
    it('should handle HTTP errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });
      
      await expect(webdavFs.readFile('/file.txt')).rejects.toThrow(WebDAVError);
      await expect(webdavFs.readFile('/file.txt')).rejects.toThrow('500 Internal Server Error');
    });
  });
});