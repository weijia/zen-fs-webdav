// 增加测试超时时间，因为某些 WebDAV 操作可能需要更长时间
jest.setTimeout(30000);

// 全局模拟 fetch API（如果在 Node.js 环境中运行测试）
if (typeof window === 'undefined') {
  global.fetch = jest.fn();
  global.Headers = jest.fn();
  global.Request = jest.fn();
  global.Response = jest.fn();
}

// 在每次测试后清除所有模拟
afterEach(() => {
  jest.clearAllMocks();
});