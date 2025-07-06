import {
  normalizePath,
  parseXML,
  buildBasicAuthHeader,
  getParentPath,
  getFilenameFromPath,
  isDirectory,
  parseContentType,
  formatDate,
  buildPropfindXML,
  extractFilesFromMultistatus,
  extractStatsFromProps,
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

  describe('parseXML', () => {
    it('should parse XML correctly', async () => {
      const xml = '<root><item>value</item></root>';
      const result = await parseXML(xml);
      expect(result).toHaveProperty('root');
      expect(result.root).toHaveProperty('item');
      expect(result.root.item).toBe('value');
    });

    it('should handle empty XML', async () => {
      await expect(parseXML('')).rejects.toThrow();
    });
  });

  describe('buildBasicAuthHeader', () => {
    it('should build basic auth header correctly', () => {
      const auth = { username: 'user', password: 'pass' };
      const header = buildBasicAuthHeader(auth);
      expect(header).toBe('Basic dXNlcjpwYXNz'); // 'user:pass' in base64
    });

    it('should return undefined if auth is not provided', () => {
      expect(buildBasicAuthHeader(undefined)).toBeUndefined();
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

  describe('getFilenameFromPath', () => {
    it('should get filename from path correctly', () => {
      expect(getFilenameFromPath('/path/to/file.txt')).toBe('file.txt');
      expect(getFilenameFromPath('/path/to/file')).toBe('file');
      expect(getFilenameFromPath('/path/to/')).toBe('to');
      expect(getFilenameFromPath('/path')).toBe('path');
      expect(getFilenameFromPath('/')).toBe('');
    });
  });

  describe('isDirectory', () => {
    it('should determine if path is a directory', () => {
      expect(isDirectory('/path/')).toBe(true);
      expect(isDirectory('/path/to/')).toBe(true);
      expect(isDirectory('/path/to/file')).toBe(false);
      expect(isDirectory('/path/to/file.txt')).toBe(false);
    });
  });

  describe('parseContentType', () => {
    it('should parse content type correctly', () => {
      expect(parseContentType('text/plain; charset=utf-8')).toBe('text/plain');
      expect(parseContentType('application/json')).toBe('application/json');
      expect(parseContentType('')).toBe('');
      expect(parseContentType(undefined)).toBe('');
    });
  });

  describe('formatDate', () => {
    it('should format date correctly', () => {
      const date = new Date('2023-01-01T12:00:00Z');
      expect(formatDate(date)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    });

    it('should handle invalid date', () => {
      expect(formatDate(new Date('invalid'))).toBe('');
    });
  });

  describe('buildPropfindXML', () => {
    it('should build PROPFIND XML correctly', () => {
      const xml = buildPropfindXML();
      expect(xml).toContain('<D:propfind');
      expect(xml).toContain('<D:prop>');
      expect(xml).toContain('<D:resourcetype/>');
      expect(xml).toContain('<D:getcontentlength/>');
      expect(xml).toContain('<D:getlastmodified/>');
      expect(xml).toContain('<D:getcontenttype/>');
    });
  });

  describe('extractFilesFromMultistatus', () => {
    it('should extract files from multistatus response', () => {
      const multistatus = {
        'D:multistatus': {
          'D:response': [
            {
              'D:href': '/path/',
              'D:propstat': {
                'D:prop': {
                  'D:resourcetype': { 'D:collection': {} },
                  'D:getlastmodified': 'Mon, 01 Jan 2023 12:00:00 GMT',
                },
                'D:status': 'HTTP/1.1 200 OK',
              },
            },
            {
              'D:href': '/path/file.txt',
              'D:propstat': {
                'D:prop': {
                  'D:resourcetype': {},
                  'D:getcontentlength': '100',
                  'D:getlastmodified': 'Mon, 01 Jan 2023 12:00:00 GMT',
                  'D:getcontenttype': 'text/plain',
                },
                'D:status': 'HTTP/1.1 200 OK',
              },
            },
          ],
        },
      };

      const baseUrl = 'https://example.com';
      const path = '/path';
      const files = extractFilesFromMultistatus(multistatus, baseUrl, path);

      expect(files).toHaveLength(1); // Only the file, not the current directory
      expect(files[0]).toHaveProperty('name', 'file.txt');
      expect(files[0]).toHaveProperty('isDirectory', false);
      expect(files[0]).toHaveProperty('size', 100);
      expect(files[0]).toHaveProperty('lastModified');
      expect(files[0]).toHaveProperty('contentType', 'text/plain');
    });

    it('should handle empty response', () => {
      const multistatus = { 'D:multistatus': {} };
      const baseUrl = 'https://example.com';
      const path = '/path';
      const files = extractFilesFromMultistatus(multistatus, baseUrl, path);
      expect(files).toEqual([]);
    });
  });

  describe('extractStatsFromProps', () => {
    it('should extract stats from props for a file', () => {
      const props = {
        'D:resourcetype': {},
        'D:getcontentlength': '100',
        'D:getlastmodified': 'Mon, 01 Jan 2023 12:00:00 GMT',
        'D:getcontenttype': 'text/plain',
      };

      const name = 'file.txt';
      const stats = extractStatsFromProps(props, name);

      expect(stats).toHaveProperty('name', 'file.txt');
      expect(stats).toHaveProperty('isDirectory', false);
      expect(stats).toHaveProperty('size', 100);
      expect(stats).toHaveProperty('lastModified');
      expect(stats.lastModified).toBeInstanceOf(Date);
      expect(stats).toHaveProperty('contentType', 'text/plain');
    });

    it('should extract stats from props for a directory', () => {
      const props = {
        'D:resourcetype': { 'D:collection': {} },
        'D:getlastmodified': 'Mon, 01 Jan 2023 12:00:00 GMT',
      };

      const name = 'folder';
      const stats = extractStatsFromProps(props, name);

      expect(stats).toHaveProperty('name', 'folder');
      expect(stats).toHaveProperty('isDirectory', true);
      expect(stats).toHaveProperty('size', 0);
      expect(stats).toHaveProperty('lastModified');
      expect(stats.lastModified).toBeInstanceOf(Date);
      expect(stats).toHaveProperty('contentType', '');
    });
  });
});