# zen-fs-webdav API 文档

`zen-fs-webdav` 是一个用于与 WebDAV 服务器交互的文件系统库，提供了简单而强大的 API 来执行常见的文件操作。

## 目录

- [安装](#安装)
- [基本用法](#基本用法)
- [API 参考](#api-参考)
  - [createWebDAVFileSystem](#createwebdavfilesystem)
  - [文件操作](#文件操作)
  - [目录操作](#目录操作)
  - [属性操作](#属性操作)
  - [其他操作](#其他操作)
- [类型定义](#类型定义)
- [错误处理](#错误处理)
- [高级用法](#高级用法)
- [浏览器兼容性](#浏览器兼容性)

## 安装

使用 npm 安装:

```bash
npm install zen-fs-webdav
```

或者使用 yarn:

```bash
yarn add zen-fs-webdav
```

## 基本用法

```typescript
import { createWebDAVFileSystem } from 'zen-fs-webdav';

// 创建 WebDAV 文件系统实例
const fs = createWebDAVFileSystem({
  baseUrl: 'https://example.com/webdav/',
  username: 'user',
  password: 'password',
});

// 使用文件系统 API
async function example() {
  // 读取文件
  const content = await fs.readFile('/example.txt', 'utf8');
  console.log(content);
  
  // 写入文件
  await fs.writeFile('/new-file.txt', 'Hello, WebDAV!', 'utf8');
  
  // 列出目录内容
  const entries = await fs.readdir('/');
  console.log(entries);
}

example().catch(console.error);
```

## API 参考

### createWebDAVFileSystem

创建一个新的 WebDAV 文件系统实例。

```typescript
function createWebDAVFileSystem(options: WebDAVOptions): WebDAVFileSystem;
```

**参数:**

`options` 对象包含以下属性:

| 属性 | 类型 | 必需 | 描述 |
|------|------|------|------|
| baseUrl | string | 是 | WebDAV 服务器的基础 URL |
| username | string | 否 | 认证用户名 |
| password | string | 否 | 认证密码 |
| token | string | 否 | 用于 Bearer 认证的令牌 |
| timeout | number | 否 | 请求超时时间（毫秒），默认 30000 |
| headers | Record<string, string> | 否 | 要包含在所有请求中的额外 HTTP 头 |
| fetchOptions | RequestInit | 否 | 传递给 fetch API 的额外选项 |

**返回值:**

返回一个 `WebDAVFileSystem` 对象，提供各种文件系统操作方法。

### 文件操作

#### readFile

读取文件内容。

```typescript
function readFile(path: string, encoding?: string): Promise<string | ArrayBuffer>;
```

**参数:**

- `path`: 要读取的文件路径
- `encoding`: 如果指定（如 'utf8'），返回字符串；否则返回 ArrayBuffer

**返回值:**

如果指定了编码，返回字符串；否则返回 ArrayBuffer。

#### writeFile

写入文件内容。

```typescript
function writeFile(path: string, data: string | ArrayBuffer | Blob, encoding?: string): Promise<void>;
```

**参数:**

- `path`: 要写入的文件路径
- `data`: 要写入的内容（字符串、ArrayBuffer 或 Blob）
- `encoding`: 如果 data 是字符串，指定编码（如 'utf8'）

**返回值:**

Promise<void>

#### exists

检查文件或目录是否存在。

```typescript
function exists(path: string): Promise<boolean>;
```

**参数:**

- `path`: 要检查的文件或目录路径

**返回值:**

如果文件或目录存在，返回 `true`；否则返回 `false`。

#### stat

获取文件或目录的状态信息。

```typescript
function stat(path: string): Promise<FileStat>;
```

**参数:**

- `path`: 文件或目录路径

**返回值:**

返回包含以下属性的 `FileStat` 对象:

- `name`: 文件或目录名称
- `size`: 文件大小（字节）
- `mtime`: 最后修改时间
- `isDirectory`: 是否为目录
- `etag`: 实体标签（如果可用）
- `contentType`: 内容类型（如果可用）

#### remove

删除文件或目录。

```typescript
function remove(path: string, recursive?: boolean): Promise<void>;
```

**参数:**

- `path`: 要删除的文件或目录路径
- `recursive`: 如果为 `true` 且 path 是目录，则递归删除内容

**返回值:**

Promise<void>

### 目录操作

#### mkdir

创建目录。

```typescript
function mkdir(path: string): Promise<void>;
```

**参数:**

- `path`: 要创建的目录路径

**返回值:**

Promise<void>

#### readdir

列出目录内容。

```typescript
function readdir(path: string): Promise<string[]>;
```

**参数:**

- `path`: 目录路径

**返回值:**

返回目录中的文件和子目录名称数组。

### 属性操作

#### getProps

获取资源的 WebDAV 属性。

```typescript
function getProps(path: string, props?: string[]): Promise<Record<string, any>>;
```

**参数:**

- `path`: 资源路径
- `props`: 要获取的属性名称数组（可选）

**返回值:**

返回包含属性名称和值的对象。

#### setProps

设置资源的 WebDAV 属性。

```typescript
function setProps(path: string, props: Record<string, any>): Promise<void>;
```

**参数:**

- `path`: 资源路径
- `props`: 要设置的属性对象

**返回值:**

Promise<void>

### 其他操作

#### copy

复制文件或目录。

```typescript
function copy(src: string, dest: string, overwrite?: boolean): Promise<void>;
```

**参数:**

- `src`: 源路径
- `dest`: 目标路径
- `overwrite`: 如果为 `true`，则覆盖目标（如果存在）

**返回值:**

Promise<void>

#### move

移动文件或目录。

```typescript
function move(src: string, dest: string, overwrite?: boolean): Promise<void>;
```

**参数:**

- `src`: 源路径
- `dest`: 目标路径
- `overwrite`: 如果为 `true`，则覆盖目标（如果存在）

**返回值:**

Promise<void>

## 类型定义

### WebDAVOptions

```typescript
interface WebDAVOptions {
  baseUrl: string;
  username?: string;
  password?: string;
  token?: string;
  timeout?: number;
  headers?: Record<string, string>;
  fetchOptions?: RequestInit;
}
```

### FileStat

```typescript
interface FileStat {
  name: string;
  size: number;
  mtime: Date;
  isDirectory: boolean;
  etag?: string;
  contentType?: string;
}
```

### WebDAVFileSystem

```typescript
interface WebDAVFileSystem {
  stat(path: string): Promise<FileStat>;
  exists(path: string): Promise<boolean>;
  readFile(path: string, encoding?: string): Promise<string | ArrayBuffer>;
  writeFile(path: string, data: string | ArrayBuffer | Blob, encoding?: string): Promise<void>;
  remove(path: string, recursive?: boolean): Promise<void>;
  mkdir(path: string): Promise<void>;
  readdir(path: string): Promise<string[]>;
  getProps(path: string, props?: string[]): Promise<Record<string, any>>;
  setProps(path: string, props: Record<string, any>): Promise<void>;
  copy(src: string, dest: string, overwrite?: boolean): Promise<void>;
  move(src: string, dest: string, overwrite?: boolean): Promise<void>;
}
```

## 错误处理

库抛出的错误包含以下属性:

- `message`: 错误消息
- `status`: HTTP 状态码（如果适用）
- `path`: 相关资源路径

示例:

```typescript
try {
  await fs.readFile('/non-existent-file.txt');
} catch (error) {
  console.error(`错误: ${error.message}`);
  console.error(`状态码: ${error.status}`);
  console.error(`路径: ${error.path}`);
}
```

常见错误状态码:

- `404`: 资源不存在
- `401`: 未授权
- `403`: 禁止访问
- `409`: 冲突（例如，尝试创建已存在的资源）
- `423`: 资源已锁定

## 高级用法

### 自定义请求头

```typescript
const fs = createWebDAVFileSystem({
  baseUrl: 'https://example.com/webdav/',
  username: 'user',
  password: 'password',
  headers: {
    'User-Agent': 'MyApp/1.0',
    'X-Custom-Header': 'CustomValue',
  },
});
```

### 使用 Bearer 令牌认证

```typescript
const fs = createWebDAVFileSystem({
  baseUrl: 'https://example.com/webdav/',
  token: 'your-bearer-token',
});
```

### 处理大文件

对于大文件，可以使用流式 API（如果支持）:

```typescript
// 注意: 这是一个概念示例，实际实现可能不同
const readStream = fs.createReadStream('/large-file.mp4');
const writeStream = someWritableStream;

readStream.pipe(writeStream);
```

## 浏览器兼容性

该库在现代浏览器中工作，使用 `fetch` API 进行 HTTP 请求。对于旧浏览器，可能需要使用 polyfill。

在浏览器中使用时的注意事项:

1. 跨域限制: WebDAV 服务器需要启用 CORS 以允许浏览器访问
2. 认证: 浏览器可能会显示认证对话框，除非使用 Basic Auth 头或 Bearer 令牌
3. 缓存: 浏览器可能会缓存请求，可以通过设置适当的缓存控制头来避免

```typescript
const fs = createWebDAVFileSystem({
  baseUrl: 'https://example.com/webdav/',
  username: 'user',
  password: 'password',
  headers: {
    'Cache-Control': 'no-cache',
  },
});
```