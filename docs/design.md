# WebDAV 文件系统核心设计文档

## 文件概览

### 1. WebDAVError.ts
- **职责**: 处理 WebDAV 操作中的所有错误情况
- **主要功能**:
  - 提供标准化的错误处理机制
  - 包含 HTTP 状态码和原始错误信息
  - 提供多种预定义的错误类型
- **关键类**:
  - `WebDAVError`: 继承自 JavaScript 的 Error 类
- **主要方法**:
  - 静态工厂方法创建特定错误:
    - `fileNotFound()`
    - `permissionDenied()`
    - `authenticationFailed()`
    - `connectionTimeout()`
    - `serverError()`
    - `networkError()`
    - `invalidArgument()`

### 2. WebDAVFileSystem.ts
- **职责**: 提供类似文件系统的 API 来操作 WebDAV 服务器
- **主要功能**:
  - 文件系统基本操作(CRUD)
  - 目录操作
  - 流操作
  - 认证和连接管理
- **关键类**:
  - `WebDAVFileSystem`: 主文件系统类
- **主要方法**:
  - 文件操作:
    - `readFile()`
    - `writeFile()`
    - `appendFile()`
    - `unlink()`
  - 目录操作:
    - `mkdir()`
    - `rmdir()`
    - `readdir()`
  - 流操作:
    - `createReadStream()`
    - `createWriteStream()`
  - 其他:
    - `exists()`
    - `stat()`
    - `copy()`
    - `move()`
    - `rename()`

### 3. webdav.ts
- **职责**: WebDAV 核心实现
- **主要功能**:
  - 处理 HTTP 请求和认证
  - 解析 WebDAV XML 响应
  - 属性管理
  - 连接池和缓存管理
- **关键实现**:
  - 使用 fetch API 发送请求
  - 支持 Basic 和 Bearer 认证
  - 超时控制
  - 错误处理

### 4. webdav-fs.ts
- **职责**: WebDAV 文件系统实现
- **主要功能**:
  - 实现文件系统接口
  - 处理 WebDAV 特定协议
  - 提供兼容 Node.js fs 模块的 API
- **关键实现**:
  - PROPFIND 方法处理
  - 资源类型解析
  - 文件属性处理

## 设计思路

### 1. 分层架构
- **错误层**: WebDAVError 提供统一的错误处理
- **核心层**: webdav.ts 处理底层协议
- **接口层**: WebDAVFileSystem 提供高级 API
- **实现层**: webdav-fs.ts 实现具体功能

### 2. 错误处理
- 所有错误都通过 WebDAVError 抛出
- 包含 HTTP 状态码和详细错误信息
- 支持错误链(原始错误)

### 3. 认证机制
- 支持 Basic 和 Bearer Token 认证
- 认证信息通过构造函数配置
- 自动添加认证头

### 4. 性能考虑
- 使用流处理大文件
- 支持分块传输
- 连接复用

## 关键实现细节

### 1. XML 处理
- 使用 DOMParser 解析 WebDAV XML 响应
- 处理 PROPFIND 响应中的资源类型和属性

### 2. 路径规范化
- 确保路径格式一致
- 处理相对路径和绝对路径
- URL 编码/解码

### 3. 流处理
- 支持可读流和可写流
- 自动处理流结束和错误
- 内存优化

## 使用示例

```typescript
const fs = new WebDAVFileSystem({
  baseUrl: 'https://webdav.example.com',
  username: 'user',
  password: 'pass'
});

// 读取目录
const files = await fs.readdir('/documents');

// 上传文件
await fs.writeFile('/documents/test.txt', 'Hello World');

// 下载文件
const content = await fs.readFile('/documents/test.txt');
```