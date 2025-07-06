/**
 * zen-fs-webdav Node.js使用示例
 * 
 * 此示例展示如何在Node.js环境中使用WebDAV文件系统
 * 实现了一个简单的命令行工具，可以执行基本的WebDAV操作
 */

import { WebDAVFS } from '../src/webdav-fs';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

// 创建命令行交互界面
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// WebDAV实例
let webdav: WebDAVFS | null = null;

// 当前远程路径
let currentRemotePath = '/';

// 帮助信息
const helpText = `
可用命令:
  connect <url> <username> <password> - 连接到WebDAV服务器
  ls [path]                           - 列出目录内容
  cd <path>                           - 更改当前目录
  mkdir <path>                        - 创建目录
  rm <path>                           - 删除文件
  rmdir <path> [--recursive]          - 删除目录
  cat <path>                          - 显示文件内容
  upload <localPath> <remotePath>     - 上传文件
  download <remotePath> <localPath>   - 下载文件
  copy <source> <destination>         - 复制文件或目录
  move <source> <destination>         - 移动文件或目录
  stat <path>                         - 显示文件或目录信息
  pwd                                 - 显示当前目录
  help                                - 显示帮助信息
  exit                                - 退出程序
`;

// 规范化路径
function normalizePath(inputPath: string): string {
  // 如果是绝对路径，直接返回
  if (inputPath.startsWith('/')) {
    return inputPath;
  }
  
  // 如果是相对路径，与当前路径合并
  const parts = [...currentRemotePath.split('/'), ...inputPath.split('/')];
  const result: string[] = [];
  
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (result.length > 0) result.pop();
    } else {
      result.push(part);
    }
  }
  
  return '/' + result.join('/');
}

// 连接到WebDAV服务器
function connect(url: string, username: string, password: string): void {
  try {
    webdav = new WebDAVFS({
      baseUrl: url,
      auth: {
        username,
        password
      },
      timeout: 30000,
      cache: true
    });
    
    console.log(`已连接到 ${url}`);
    currentRemotePath = '/';
    prompt();
  } catch (error) {
    console.error('连接失败:', (error as Error).message);
    prompt();
  }
}

// 列出目录内容
async function listDirectory(path?: string): Promise<void> {
  if (!webdav) {
    console.error('未连接到WebDAV服务器，请先使用connect命令');
    prompt();
    return;
  }
  
  try {
    const targetPath = path ? normalizePath(path) : currentRemotePath;
    const files = await webdav.readDir(targetPath);
    
    console.log(`目录 ${targetPath} 的内容:`);
    console.log('类型\t大小\t修改时间\t\t\t名称');
    console.log('------------------------------------------------------------');
    
    files.forEach(file => {
      const type = file.isDirectory ? 'DIR' : 'FILE';
      const size = file.isDirectory ? '-' : formatSize(file.size);
      const date = file.modifiedAt.toISOString().replace('T', ' ').substring(0, 19);
      console.log(`${type}\t${size}\t${date}\t${file.name}`);
    });
    
    prompt();
  } catch (error) {
    console.error('列出目录失败:', (error as Error).message);
    prompt();
  }
}

// 格式化文件大小
function formatSize(size: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let index = 0;
  let formattedSize = size;
  
  while (formattedSize >= 1024 && index < units.length - 1) {
    formattedSize /= 1024;
    index++;
  }
  
  return `${formattedSize.toFixed(2)} ${units[index]}`;
}

// 更改当前目录
async function changeDirectory(path: string): Promise<void> {
  if (!webdav) {
    console.error('未连接到WebDAV服务器，请先使用connect命令');
    prompt();
    return;
  }
  
  try {
    const targetPath = normalizePath(path);
    const stat = await webdav.stat(targetPath);
    
    if (!stat.isDirectory) {
      console.error(`${targetPath} 不是一个目录`);
      prompt();
      return;
    }
    
    currentRemotePath = targetPath;
    console.log(`当前目录: ${currentRemotePath}`);
    prompt();
  } catch (error) {
    console.error('更改目录失败:', (error as Error).message);
    prompt();
  }
}

// 创建目录
async function makeDirectory(path: string): Promise<void> {
  if (!webdav) {
    console.error('未连接到WebDAV服务器，请先使用connect命令');
    prompt();
    return;
  }
  
  try {
    const targetPath = normalizePath(path);
    await webdav.mkdir(targetPath);
    console.log(`目录 ${targetPath} 创建成功`);
    prompt();
  } catch (error) {
    console.error('创建目录失败:', (error as Error).message);
    prompt();
  }
}

// 删除文件
async function removeFile(path: string): Promise<void> {
  if (!webdav) {
    console.error('未连接到WebDAV服务器，请先使用connect命令');
    prompt();
    return;
  }
  
  try {
    const targetPath = normalizePath(path);
    await webdav.deleteFile(targetPath);
    console.log(`文件 ${targetPath} 删除成功`);
    prompt();
  } catch (error) {
    console.error('删除文件失败:', (error as Error).message);
    prompt();
  }
}

// 删除目录
async function removeDirectory(path: string, recursive: boolean): Promise<void> {
  if (!webdav) {
    console.error('未连接到WebDAV服务器，请先使用connect命令');
    prompt();
    return;
  }
  
  try {
    const targetPath = normalizePath(path);
    await webdav.rmdir(targetPath, recursive);
    console.log(`目录 ${targetPath} 删除成功`);
    prompt();
  } catch (error) {
    console.error('删除目录失败:', (error as Error).message);
    prompt();
  }
}

// 显示文件内容
async function showFileContent(path: string): Promise<void> {
  if (!webdav) {
    console.error('未连接到WebDAV服务器，请先使用connect命令');
    prompt();
    return;
  }
  
  try {
    const targetPath = normalizePath(path);
    const content = await webdav.readFile(targetPath, { encoding: 'utf8' });
    console.log(`文件 ${targetPath} 的内容:`);
    console.log('------------------------------------------------------------');
    console.log(content);
    console.log('------------------------------------------------------------');
    prompt();
  } catch (error) {
    console.error('读取文件失败:', (error as Error).message);
    prompt();
  }
}

// 上传文件
async function uploadFile(localPath: string, remotePath: string): Promise<void> {
  if (!webdav) {
    console.error('未连接到WebDAV服务器，请先使用connect命令');
    prompt();
    return;
  }
  
  try {
    // 读取本地文件
    const content = fs.readFileSync(localPath);
    
    // 上传到WebDAV
    const targetPath = normalizePath(remotePath);
    await webdav.writeFile(targetPath, content);
    
    console.log(`文件 ${localPath} 上传到 ${targetPath} 成功`);
    prompt();
  } catch (error) {
    console.error('上传文件失败:', (error as Error).message);
    prompt();
  }
}

// 下载文件
async function downloadFile(remotePath: string, localPath: string): Promise<void> {
  if (!webdav) {
    console.error('未连接到WebDAV服务器，请先使用connect命令');
    prompt();
    return;
  }
  
  try {
    // 从WebDAV下载
    const targetPath = normalizePath(remotePath);
    const content = await webdav.readFile(targetPath);
    
    // 确保本地目录存在
    const localDir = path.dirname(localPath);
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    
    // 写入本地文件
    fs.writeFileSync(localPath, content);
    
    console.log(`文件 ${targetPath} 下载到 ${localPath} 成功`);
    prompt();
  } catch (error) {
    console.error('下载文件失败:', (error as Error).message);
    prompt();
  }
}

// 复制文件或目录
async function copyItem(source: string, destination: string): Promise<void> {
  if (!webdav) {
    console.error('未连接到WebDAV服务器，请先使用connect命令');
    prompt();
    return;
  }
  
  try {
    const sourcePath = normalizePath(source);
    const destinationPath = normalizePath(destination);
    
    await webdav.copy(sourcePath, destinationPath);
    console.log(`${sourcePath} 复制到 ${destinationPath} 成功`);
    prompt();
  } catch (error) {
    console.error('复制失败:', (error as Error).message);
    prompt();
  }
}

// 移动文件或目录
async function moveItem(source: string, destination: string): Promise<void> {
  if (!webdav) {
    console.error('未连接到WebDAV服务器，请先使用connect命令');
    prompt();
    return;
  }
  
  try {
    const sourcePath = normalizePath(source);
    const destinationPath = normalizePath(destination);
    
    await webdav.move(sourcePath, destinationPath);
    console.log(`${sourcePath} 移动到 ${destinationPath} 成功`);
    prompt();
  } catch (error) {
    console.error('移动失败:', (error as Error).message);
    prompt();
  }
}

// 显示文件或目录信息
async function showItemStat(path: string): Promise<void> {
  if (!webdav) {
    console.error('未连接到WebDAV服务器，请先使用connect命令');
    prompt();
    return;
  }
  
  try {
    const targetPath = normalizePath(path);
    const stat = await webdav.stat(targetPath);
    
    console.log(`${targetPath} 的信息:`);
    console.log(`名称: ${stat.name}`);
    console.log(`类型: ${stat.isDirectory ? '目录' : '文件'}`);
    console.log(`大小: ${formatSize(stat.size)}`);
    console.log(`创建时间: ${stat.createdAt.toISOString()}`);
    console.log(`修改时间: ${stat.modifiedAt.toISOString()}`);
    if (stat.contentType) console.log(`内容类型: ${stat.contentType}`);
    if (stat.etag) console.log(`ETag: ${stat.etag}`);
    
    prompt();
  } catch (error) {
    console.error('获取信息失败:', (error as Error).message);
    prompt();
  }
}

// 显示当前目录
function showCurrentDirectory(): void {
  console.log(`当前目录: ${currentRemotePath}`);
  prompt();
}

// 显示提示符
function prompt(): void {
  const prefix = webdav ? `webdav:${currentRemotePath}` : 'webdav';
  rl.setPrompt(`${prefix}> `);
  rl.prompt();
}

// 处理命令
function processCommand(input: string): void {
  const args = input.trim().split(/\s+/);
  const command = args[0].toLowerCase();
  
  switch (command) {
    case 'connect':
      if (args.length < 4) {
        console.error('用法: connect <url> <username> <password>');
      } else {
        connect(args[1], args[2], args[3]);
      }
      break;
      
    case 'ls':
      listDirectory(args[1]);
      break;
      
    case 'cd':
      if (args.length < 2) {
        console.error('用法: cd <path>');
        prompt();
      } else {
        changeDirectory(args[1]);
      }
      break;
      
    case 'mkdir':
      if (args.length < 2) {
        console.error('用法: mkdir <path>');
        prompt();
      } else {
        makeDirectory(args[1]);
      }
      break;
      
    case 'rm':
      if (args.length < 2) {
        console.error('用法: rm <path>');
        prompt();
      } else {
        removeFile(args[1]);
      }
      break;
      
    case 'rmdir':
      if (args.length < 2) {
        console.error('用法: rmdir <path> [--recursive]');
        prompt();
      } else {
        const recursive = args.includes('--recursive');
        removeDirectory(args[1], recursive);
      }
      break;
      
    case 'cat':
      if (args.length < 2) {
        console.error('用法: cat <path>');
        prompt();
      } else {
        showFileContent(args[1]);
      }
      break;
      
    case 'upload':
      if (args.length < 3) {
        console.error('用法: upload <localPath> <remotePath>');
        prompt();
      } else {
        uploadFile(args[1], args[2]);
      }
      break;
      
    case 'download':
      if (args.length < 3) {
        console.error('用法: download <remotePath> <localPath>');
        prompt();
      } else {
        downloadFile(args[1], args[2]);
      }
      break;
      
    case 'copy':
      if (args.length < 3) {
        console.error('用法: copy <source> <destination>');
        prompt();
      } else {
        copyItem(args[1], args[2]);
      }
      break;
      
    case 'move':
      if (args.length < 3) {
        console.error('用法: move <source> <destination>');
        prompt();
      } else {
        moveItem(args[1], args[2]);
      }
      break;
      
    case 'stat':
      if (args.length < 2) {
        console.error('用法: stat <path>');
        prompt();
      } else {
        showItemStat(args[1]);
      }
      break;
      
    case 'pwd':
      showCurrentDirectory();
      break;
      
    case 'help':
      console.log(helpText);
      prompt();
      break;
      
    case 'exit':
      console.log('再见!');
      rl.close();
      process.exit(0);
      break;
      
    default:
      console.error(`未知命令: ${command}`);
      console.log('输入 "help" 查看可用命令');
      prompt();
      break;
  }
}

// 启动程序
console.log('WebDAV命令行客户端');
console.log('输入 "help" 查看可用命令');
console.log('输入 "connect <url> <username> <password>" 连接到WebDAV服务器');
prompt();

// 监听命令输入
rl.on('line', (input) => {
  processCommand(input);
}).on('close', () => {
  console.log('再见!');
  process.exit(0);
});