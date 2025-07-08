/**
 * WebDAV文件系统库的错误类型定义
 */

/**
 * WebDAV错误基类
 */
export class WebDAVError extends Error {
  /**
   * HTTP状态码
   */
  statusCode?: number;
  /**
   * 原始错误对象（如果有）
   */
  originalError?: Error;

  constructor(message: string, statusCode?: number, originalError?: Error) {
    super(message);
    this.name = 'WebDAVError';
    this.statusCode = statusCode;
    this.originalError = originalError;
    Object.setPrototypeOf(this, WebDAVError.prototype);
    // 捕获堆栈跟踪（仅在 V8 引擎中有效）
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, WebDAVError);
    }
  }
  /**
   * 兼容 status 字段
   */
  get status() {
    return this.statusCode;
  }
}

/**
 * 文件或目录不存在错误
 */
export class NotFoundError extends WebDAVError {
  constructor(path: string) {
    super(`文件未找到: ${path}`, 404);
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * 认证错误
 */
export class AuthenticationError extends WebDAVError {
  constructor(message: string = '认证失败') {
    super(message, 401);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * 授权错误
 */
export class AuthorizationError extends WebDAVError {
  constructor(message: string = '权限被拒绝') {
    super(message, 403);
    this.name = 'AuthorizationError';
    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }
}

/**
 * 服务器错误
 */
export class ServerError extends WebDAVError {
  constructor(message: string = '服务器错误', statusCode: number = 500) {
    super(message, statusCode);
    this.name = 'ServerError';
    Object.setPrototypeOf(this, ServerError.prototype);
  }
}

/**
 * 文件已存在错误
 */
export class FileExistsError extends WebDAVError {
  constructor(path: string) {
    super(`文件已存在: ${path}`, 412);
    this.name = 'FileExistsError';
    Object.setPrototypeOf(this, FileExistsError.prototype);
  }
}

/**
 * 锁定错误
 */
export class LockError extends WebDAVError {
  constructor(path: string, message: string = '资源被锁定') {
    super(`${message}: ${path}`, 423);
    this.name = 'LockError';
    Object.setPrototypeOf(this, LockError.prototype);
  }
}

/**
 * 超时错误
 */
export class TimeoutError extends WebDAVError {
  constructor(message: string = '连接超时') {
    super(message, 408);
    this.name = 'TimeoutError';
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

/**
 * 网络错误
 */
export class NetworkError extends WebDAVError {
  constructor(originalError?: Error, message: string = '网络错误') {
    super(originalError ? `${message}: ${originalError.message}` : message, 0, originalError);
    this.name = 'NetworkError';
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

/**
 * 参数错误
 */
export class ArgumentError extends WebDAVError {
  constructor(message: string) {
    super(`无效参数: ${message}`);
    this.name = 'ArgumentError';
    Object.setPrototypeOf(this, ArgumentError.prototype);
  }
}