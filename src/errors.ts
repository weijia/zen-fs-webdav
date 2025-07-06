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

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'WebDAVError';
    this.statusCode = statusCode;
    
    // 兼容ES5
    Object.setPrototypeOf(this, WebDAVError.prototype);
  }
}

/**
 * 文件或目录不存在错误
 */
export class NotFoundError extends WebDAVError {
  constructor(path: string) {
    super(`File or directory not found: ${path}`, 404);
    this.name = 'NotFoundError';
    
    // 兼容ES5
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * 认证错误
 */
export class AuthenticationError extends WebDAVError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401);
    this.name = 'AuthenticationError';
    
    // 兼容ES5
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * 授权错误
 */
export class AuthorizationError extends WebDAVError {
  constructor(message: string = 'Not authorized to access this resource') {
    super(message, 403);
    this.name = 'AuthorizationError';
    
    // 兼容ES5
    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }
}

/**
 * 服务器错误
 */
export class ServerError extends WebDAVError {
  constructor(message: string = 'Server error', statusCode: number = 500) {
    super(message, statusCode);
    this.name = 'ServerError';
    
    // 兼容ES5
    Object.setPrototypeOf(this, ServerError.prototype);
  }
}

/**
 * 文件已存在错误
 */
export class FileExistsError extends WebDAVError {
  constructor(path: string) {
    super(`File already exists: ${path}`, 412);
    this.name = 'FileExistsError';
    
    // 兼容ES5
    Object.setPrototypeOf(this, FileExistsError.prototype);
  }
}

/**
 * 锁定错误
 */
export class LockError extends WebDAVError {
  constructor(path: string, message: string = 'Resource is locked') {
    super(`${message}: ${path}`, 423);
    this.name = 'LockError';
    
    // 兼容ES5
    Object.setPrototypeOf(this, LockError.prototype);
  }
}

/**
 * 超时错误
 */
export class TimeoutError extends WebDAVError {
  constructor(message: string = 'Request timed out') {
    super(message, 408);
    this.name = 'TimeoutError';
    
    // 兼容ES5
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

/**
 * 网络错误
 */
export class NetworkError extends WebDAVError {
  constructor(message: string = 'Network error occurred') {
    super(message);
    this.name = 'NetworkError';
    
    // 兼容ES5
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

/**
 * 参数错误
 */
export class ArgumentError extends WebDAVError {
  constructor(message: string) {
    super(message);
    this.name = 'ArgumentError';
    
    // 兼容ES5
    Object.setPrototypeOf(this, ArgumentError.prototype);
  }
}