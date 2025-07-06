/**
 * WebDAV 相关常量
 */

/**
 * WebDAV 方法
 */
export enum WebDAVMethod {
  GET = 'GET',
  PUT = 'PUT',
  POST = 'POST',
  DELETE = 'DELETE',
  PROPFIND = 'PROPFIND',
  PROPPATCH = 'PROPPATCH',
  MKCOL = 'MKCOL',
  COPY = 'COPY',
  MOVE = 'MOVE',
  LOCK = 'LOCK',
  UNLOCK = 'UNLOCK',
}

/**
 * WebDAV 命名空间
 */
export const WebDAVNamespace = {
  DAV: 'DAV:',
  CALDAV: 'urn:ietf:params:xml:ns:caldav',
  CARDDAV: 'urn:ietf:params:xml:ns:carddav',
  OWNCLOUD: 'http://owncloud.org/ns',
  NEXTCLOUD: 'http://nextcloud.org/ns',
};

/**
 * WebDAV 属性名称
 */
export const WebDAVPropName = {
  RESOURCE_TYPE: 'resourcetype',
  DISPLAY_NAME: 'displayname',
  GET_CONTENT_LENGTH: 'getcontentlength',
  GET_CONTENT_TYPE: 'getcontenttype',
  GET_LAST_MODIFIED: 'getlastmodified',
  CREATION_DATE: 'creationdate',
  ETAG: 'getetag',
};

/**
 * WebDAV 资源类型
 */
export enum WebDAVResourceType {
  FILE = 'file',
  DIRECTORY = 'directory',
  COLLECTION = 'collection',
}

/**
 * WebDAV 深度
 */
export enum WebDAVDepth {
  /**
   * 仅当前资源
   */
  ZERO = '0',
  
  /**
   * 当前资源及其直接子资源
   */
  ONE = '1',
  
  /**
   * 当前资源及其所有后代资源
   */
  INFINITY = 'infinity',
}

/**
 * 默认超时时间（毫秒）
 */
export const DEFAULT_TIMEOUT = 30000;

/**
 * 默认请求头
 */
export const DEFAULT_HEADERS = {
  'Content-Type': 'application/xml; charset=utf-8',
  'Accept': 'application/xml, */*',
};

/**
 * XML 命名空间前缀
 */
export const XML_NAMESPACE_PREFIX = {
  'd': WebDAVNamespace.DAV,
  'oc': WebDAVNamespace.OWNCLOUD,
  'nc': WebDAVNamespace.NEXTCLOUD,
};

/**
 * 错误消息
 */
export const ErrorMessage = {
  INVALID_URL: '无效的 URL',
  TIMEOUT: '请求超时',
  NETWORK_ERROR: '网络错误',
  UNAUTHORIZED: '未授权',
  FORBIDDEN: '禁止访问',
  NOT_FOUND: '资源不存在',
  METHOD_NOT_ALLOWED: '方法不允许',
  CONFLICT: '资源冲突',
  PRECONDITION_FAILED: '前提条件失败',
  INTERNAL_SERVER_ERROR: '服务器内部错误',
  NOT_IMPLEMENTED: '未实现',
  BAD_GATEWAY: '错误的网关',
  SERVICE_UNAVAILABLE: '服务不可用',
  GATEWAY_TIMEOUT: '网关超时',
};

/**
 * HTTP 状态码
 */
export enum HttpStatus {
  OK = 200,
  CREATED = 201,
  NO_CONTENT = 204,
  MULTI_STATUS = 207,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  METHOD_NOT_ALLOWED = 405,
  CONFLICT = 409,
  PRECONDITION_FAILED = 412,
  INTERNAL_SERVER_ERROR = 500,
  NOT_IMPLEMENTED = 501,
  BAD_GATEWAY = 502,
  SERVICE_UNAVAILABLE = 503,
  GATEWAY_TIMEOUT = 504,
}