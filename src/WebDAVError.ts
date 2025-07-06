/**
 * WebDAV 错误类
 * 用于表示 WebDAV 操作中发生的错误
 */
export class WebDAVError extends Error {
  /**
   * HTTP 状态码
   */
  public status: number;
  
  /**
   * 原始错误对象（如果有）
   */
  public originalError?: Error;

  /**
   * 创建 WebDAV 错误实例
   * 
   * @param message 错误消息
   * @param status HTTP 状态码
   * @param originalError 原始错误对象（可选）
   */
  constructor(message: string, status: number = 0, originalError?: Error) {
    super(message);
    
    // 设置正确的原型链，使 instanceof 操作符能正常工作
    Object.setPrototypeOf(this, WebDAVError.prototype);
    
    this.name = 'WebDAVError';
    this.status = status;
    this.originalError = originalError;
    
    // 捕获堆栈跟踪（仅在 V8 引擎中有效）
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, WebDAVError);
    }
  }

  /**
   * 创建表示文件未找到的错误
   * 
   * @param path 文件路径
   * @returns WebDAVError 实例
   */
  static fileNotFound(path: string): WebDAVError {
    return new WebDAVError(`文件未找到: ${path}`, 404);
  }

  /**
   * 创建表示权限被拒绝的错误
   * 
   * @param path 文件路径
   * @returns WebDAVError 实例
   */
  static permissionDenied(path: string): WebDAVError {
    return new WebDAVError(`权限被拒绝: ${path}`, 403);
  }

  /**
   * 创建表示认证失败的错误
   * 
   * @returns WebDAVError 实例
   */
  static authenticationFailed(): WebDAVError {
    return new WebDAVError('认证失败', 401);
  }

  /**
   * 创建表示连接超时的错误
   * 
   * @returns WebDAVError 实例
   */
  static connectionTimeout(): WebDAVError {
    return new WebDAVError('连接超时', 408);
  }

  /**
   * 创建表示服务器错误的错误
   * 
   * @param status HTTP 状态码
   * @returns WebDAVError 实例
   */
  static serverError(status: number): WebDAVError {
    return new WebDAVError(`服务器错误: ${status}`, status);
  }

  /**
   * 创建表示网络错误的错误
   * 
   * @param originalError 原始错误对象
   * @returns WebDAVError 实例
   */
  static networkError(originalError: Error): WebDAVError {
    return new WebDAVError(`网络错误: ${originalError.message}`, 0, originalError);
  }

  /**
   * 创建表示无效参数的错误
   * 
   * @param message 错误消息
   * @returns WebDAVError 实例
   */
  static invalidArgument(message: string): WebDAVError {
    return new WebDAVError(`无效参数: ${message}`, 0);
  }
}