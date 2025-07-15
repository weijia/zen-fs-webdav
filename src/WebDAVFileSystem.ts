import {
  Stats,
  ReadFileOptions,
  WriteFileOptions,
  ReaddirOptions,
  MkdirOptions,
  WebDAVResult,
} from './types';

export interface WebDAVFileSystem {
  readFile(path: string, options?: ReadFileOptions): Promise<Buffer | string>;
  writeFile(path: string, data: Buffer | string, options?: WriteFileOptions): Promise<WebDAVResult>;
  deleteFile(path: string): Promise<WebDAVResult>;
  readDir(path: string, options?: ReaddirOptions): Promise<Stats[]>;
  mkdir(path: string, options?: MkdirOptions): Promise<void>;
  rm(path: string, options?: { recursive?: boolean, force?: boolean }): Promise<void>;
  rmdir(path: string, options?: boolean | { recursive?: boolean, force?: boolean }): Promise<void>;
  stat(path: string): Promise<Stats>;
  exists(path: string): Promise<boolean>;
  copy(source: string, destination: string, overwrite?: boolean): Promise<WebDAVResult>;
  move(source: string, destination: string, overwrite?: boolean): Promise<WebDAVResult>;
  unlink(path: string): Promise<void>;
}