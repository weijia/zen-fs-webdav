/**
 * zen-fs-webdav 调试日志模块
 *
 * 基于 @richard432/localstorage-logger 实现，但**缺省关闭**
 * （@richard432/localstorage-logger 默认是开启的，这里在加载时显式写入关闭状态覆盖默认值）。
 *
 * 控制方式：
 *   - 设置 localStorage 键 `debug:zen-fs-webdav` 为 '1' 开启，'0' 关闭
 *   - 或调用 setDebugEnabled(true) / enableDebug() / disableDebug()
 */

import {
  createLogger,
  setDebugEnabled as pkgSetDebugEnabled,
  isDebugEnabled as pkgIsDebugEnabled,
  listDebugModules,
} from '@richard432/localstorage-logger';

/** 当前模块名，对应 localStorage 键 `debug:zen-fs-webdav` */
export const MODULE = 'zen-fs-webdav';

// 缺省关闭：加载时写入关闭状态，覆盖 @richard432/localstorage-logger 的默认开启行为
pkgSetDebugEnabled(MODULE, false);

/**
 * 设置调试开关
 * @param enabled true 开启, false 关闭
 */
export function setDebugEnabled(enabled: boolean): void {
  pkgSetDebugEnabled(MODULE, enabled);
}

/**
 * 查询调试开关状态
 * @returns 是否开启
 */
export function isDebugEnabled(): boolean {
  return pkgIsDebugEnabled(MODULE);
}

/** 开启调试 */
export function enableDebug(): void {
  pkgSetDebugEnabled(MODULE, true);
}

/** 关闭调试 */
export function disableDebug(): void {
  pkgSetDebugEnabled(MODULE, false);
}

/**
 * 列出所有已注册的调试模块
 * @returns 模块名数组
 */
export function listDebugModulesNames(): string[] {
<<<<<<< HEAD
  return listDebugModules().map((m) => m.module);
=======
  return listDebugModules().map(m => m.module);
>>>>>>> 075812530926ed18f698744a29744a8c5bdb03fc
}

// 创建底层 logger（内部同样受包的开关控制，此处再包一层双保险）
const logger = createLogger(MODULE);

/** 调试日志（仅在开启时输出） */
export function log(...args: unknown[]): void {
  if (pkgIsDebugEnabled(MODULE)) {
    logger.log(...args);
  }
}

/** 调试警告（仅在开启时输出） */
export function warn(...args: unknown[]): void {
  if (pkgIsDebugEnabled(MODULE)) {
    logger.warn(...args);
  }
}

/** 调试错误（仅在开启时输出） */
export function error(...args: unknown[]): void {
  if (pkgIsDebugEnabled(MODULE)) {
    logger.error(...args);
  }
}
