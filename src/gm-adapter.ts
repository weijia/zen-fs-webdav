/**
 * GM_xmlhttpRequest adapter for zen-fs-webdav
 * Exports a `gmRequestAdapter` object with a `request` method compatible with WebDAVFS.httpClient
 */

export async function gmRequestAdapter(method: string, url: string, options: { headers?: Record<string, string>; body?: any; responseType?: 'text'|'arraybuffer'|'blob'|'json'; timeout?: number } = {}) {
  // This function expects to run in a userscript environment where GM_xmlhttpRequest is available.
  // It returns a Promise resolving to { data, status, headers }
  if (typeof (globalThis as any).GM_xmlhttpRequest !== 'function') {
    throw new Error('GM_xmlhttpRequest is not available in this environment');
  }

  return new Promise<{ data: any; status: number; headers: Record<string,string> }>((resolve, reject) => {
    try {
      (globalThis as any).GM_xmlhttpRequest({
        method,
        url,
        data: options.body,
        headers: options.headers,
        responseType: options.responseType === 'arraybuffer' ? 'arraybuffer' : 'text',
        timeout: options.timeout,
        onload(res: any) {
          const h: Record<string,string> = {};
          if (res.responseHeaders) {
            res.responseHeaders.split(/\r?\n/).forEach((line: string) => {
              const m = line.match(/^([^:]+):\s*(.*)$/);
              if (m) h[m[1].toLowerCase()] = m[2];
            });
          }
          const data = options.responseType === 'arraybuffer' ? res.response : (res.responseText ?? res.response);
          resolve({ data, status: res.status, headers: h });
        },
        onerror(err: any) {
          reject(new Error('GM_xmlhttpRequest error'));
        },
        ontimeout() {
          reject(new Error('GM_xmlhttpRequest timeout'));
        }
      });
    } catch (e) {
      reject(e);
    }
  });
}

// Export an object with request method to match the expected shape
export const gmHttpClient = {
  request: gmRequestAdapter as any,
};
