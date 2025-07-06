# zen-fs-webdav

一个简单、现代的 WebDAV 客户端库，提供类似文件系统的 API。

## 特性

- 🚀 简单易用的 API，类似于 Node.js 的 fs 模块
- 🔄 支持所有基本的 WebDAV 操作（读取、写入、复制、移动等）
- 🔒 支持基本认证和令牌认证
- 📁 支持目录操作和递归操作
- 💪 完全使用 TypeScript 编写，提供完整的类型定义
- 🌐 同时支持浏览器和 Node.js 环境

## 安装

```bash
npm install zen-fs-webdav
```

或者使用 yarn：

```bash
yarn add zen-fs-webdav
```

## 快速开始

```typescript
import { WebDAVFileSystem } from 'zen-fs-webdav';

// 创建 WebDAV 客户端实例
const fs = new WebDAVFileSystem({
  baseUrl: 'https://example.com/webdav',
  username: 'user',
  password: 'pass',
});

// 读取文件
const content = await fs.readFile('/path/to/file.txt');
console.log(content);

// 写入文件
await fs.writeFile('/path/to/newfile.txt', 'Hello, WebDAV!');

// 列出目录内容
const files = await fs.readdir('/path/to/directory');
console.log(files);
```

## API 参考

### 创建实例

```typescript
const fs = new WebDAVFileSystem(options);
```

#### 选项

- `baseUrl`: WebDAV 服务器的基础 URL
- `username`: 用户名（可选，用于基本认证）
- `password`: 密码（可选，用于基本认证）
- `token`: 认证令牌（可选，用于令牌认证）
- `headers`: 自定义请求头（可选）
- `fetch`: 自定义 fetch 函数（可选）

### 文件操作

#### 检查文件是否存在

```typescript
const exists = await fs.exists('/path/to/file.txt');
```

#### 读取文件

```typescript
// 读取为文本
const text = await fs.readFile('/path/to/file.txt');

// 读取为二进制数据
const binary = await fs.readFile('/path/to/file.bin', { responseType: 'arraybuffer' });
```

#### 写入文件

```typescript
// 写入文本
await fs.writeFile('/path/to/file.txt', 'Hello, WebDAV!');

// 写入二进制数据
const buffer = new ArrayBuffer(10);
await fs.writeFile('/path/to/file.bin', buffer);

// 指定内容类型
await fs.writeFile('/path/to/file.json', '{"key": "value"}', { contentType: 'application/json' });
```

#### 删除文件

```typescript
await fs.unlink('/path/to/file.txt');
```

#### 获取文件信息

```typescript
const stats = await fs.stat('/path/to/file.txt');
console.log(stats.size);
console.log(stats.lastModified);
console.log(stats.isDirectory);
```

### 目录操作

#### 创建目录

```typescript
// 创建单个目录
await fs.mkdir('/path/to/directory');

// 递归创建目录
await fs.mkdir('/path/to/nested/directory', { recursive: true });
```

#### 列出目录内容

```typescript
// 列出顶层内容
const files = await fs.readdir('/path/to/directory');

// 递归列出所有内容
const allFiles = await fs.readdir('/path/to/directory', { depth: 'infinity' });
```

#### 删除目录

```typescript
// 删除空目录
await fs.rmdir('/path/to/directory');

// 递归删除目录及其内容
await fs.rmdir('/path/to/directory', { recursive: true });
```

### 复制和移动

#### 复制文件或目录

```typescript
// 复制文件
await fs.copy('/source/file.txt', '/destination/file.txt');

// 复制目录
await fs.copy('/source/directory', '/destination/directory', { recursive: true });
```

#### 移动文件或目录

```typescript
await fs.move('/source/file.txt', '/destination/file.txt');
```

#### 重命名文件或目录

```typescript
await fs.rename('/path/to/oldname.txt', 'newname.txt');
```

### 流操作

#### 创建可读流

```typescript
const readStream = await fs.createReadStream('/path/to/file.txt');
// 使用流...
```

#### 创建可写流

```typescript
const writeStream = fs.createWriteStream('/path/to/file.txt');
// 使用流...
writeStream.write('Hello');
writeStream.write(' WebDAV!');
await writeStream.close();
```

## 错误处理

所有方法在失败时都会抛出 `WebDAVError` 异常：

```typescript
try {
  await fs.readFile('/path/to/nonexistent.txt');
} catch (error) {
  if (error.name === 'WebDAVError') {
    console.error(`WebDAV 错误: ${error.message}, 状态码: ${error.status}`);
  } else {
    console.error(`其他错误: ${error}`);
  }
}
```

## 浏览器兼容性

该库使用现代 Web API，如 `fetch` 和 `ReadableStream`/`WritableStream`。确保你的目标浏览器支持这些 API，或者使用适当的 polyfill。

## 项目结构

```
├── .eslintrc.js - ESLint 配置文件
├── .eslintrc.json - ESLint 配置文件
├── .gitignore - Git 忽略规则
├── .npmignore - NPM 发布忽略规则
├── .prettierrc - Prettier 配置
├── .prettierrc.js - Prettier 配置文件
├── CHANGELOG.md - 变更日志
├── CONTRIBUTING.md - 贡献指南
├── coverage/ - 测试覆盖率报告
├── docs/ - 文档
│   └── api.md - API 文档
├── examples/ - 示例代码
│   ├── basic-usage.js - 基础使用示例(JS)
│   ├── basic-usage.ts - 基础使用示例(TS)
│   ├── browser-example.html - 浏览器示例
│   ├── browser-usage.ts - 浏览器使用示例
│   ├── node-example.js - Node.js 示例
│   ├── node-usage.ts - Node.js 使用示例
├── jest.config.js - Jest 配置
├── jest.setup.js - Jest 设置
├── LICENSE - 许可证文件
├── package.json - 项目配置
├── package-lock.json - 依赖锁定文件
├── prompt.md - 提示文档
├── README.md - 项目说明文档
├── rollup.config.js - Rollup 配置
├── src/ - 源代码目录
│   ├── constants.ts - 常量定义
│   ├── errors.ts - 错误处理
│   ├── index.ts - 主入口文件
│   ├── types.ts - 类型定义
│   ├── ui/ - UI 相关代码
│   ├── utils.ts - 工具函数
│   ├── webdav-fs.ts - WebDAV 文件系统实现
│   ├── webdav.ts - WebDAV 核心功能
│   ├── WebDAVError.ts - WebDAV 错误类
│   ├── WebDAVFileSystem.ts - WebDAV 文件系统类
│   └── __tests__/ - 测试代码
│       ├── errors.test.ts - 错误测试
│       ├── integration.test.ts - 集成测试
│       ├── utils.test.ts - 工具函数测试
│       ├── webdav-fs.test.ts - 文件系统测试
│       └── WebDAVFileSystem.test.ts - 文件系统类测试
├── tests/ - 测试代码
│   ├── webdav.test.ts - WebDAV 测试
│   └── WebDAVFileSystem.test.ts - 文件系统测试
├── tsconfig.json - TypeScript 配置
├── tsup.config.ts - Tsup 构建配置
└── __tests__/ - 测试代码
    ├── utils.test.ts - 工具函数测试
    ├── webdav-fs.test.ts - 文件系统测试
    └── WebDAVFileSystem.test.ts - 文件系统测试
```

## 许可证

MIT