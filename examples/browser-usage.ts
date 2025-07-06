/**
 * zen-fs-webdav 浏览器使用示例
 * 
 * 此示例展示如何在浏览器环境中使用WebDAV文件系统
 * 可以通过webpack、parcel等打包工具将此代码打包为浏览器可用的格式
 */

import { WebDAVFS } from '../src/webdav-fs';

// 创建WebDAV文件系统实例
const webdav = new WebDAVFS({
  baseUrl: 'https://example.com/webdav',
  auth: {
    username: 'user',
    password: 'password',
  },
  timeout: 30000,
  cache: true,
});

// DOM加载完成后执行
document.addEventListener('DOMContentLoaded', () => {
  // 获取DOM元素
  const fileListElement = document.getElementById('file-list') as HTMLDivElement;
  const pathInput = document.getElementById('path-input') as HTMLInputElement;
  const browseButton = document.getElementById('browse-button') as HTMLButtonElement;
  const uploadInput = document.getElementById('upload-input') as HTMLInputElement;
  const createFolderButton = document.getElementById('create-folder-button') as HTMLButtonElement;
  const folderNameInput = document.getElementById('folder-name-input') as HTMLInputElement;
  const statusElement = document.getElementById('status') as HTMLDivElement;

  // 显示状态信息
  function showStatus(message: string, isError = false) {
    statusElement.textContent = message;
    statusElement.className = isError ? 'error' : 'success';
    setTimeout(() => {
      statusElement.textContent = '';
      statusElement.className = '';
    }, 3000);
  }

  // 浏览目录
  async function browseDirectory(path: string) {
    try {
      // 清空文件列表
      fileListElement.innerHTML = '';
      
      // 获取目录内容
      const files = await webdav.readDir(path);
      
      // 添加返回上级目录的链接（如果不是根目录）
      if (path !== '/') {
        const parentDir = path.substring(0, path.lastIndexOf('/')) || '/';
        const backItem = document.createElement('div');
        backItem.className = 'file-item directory';
        backItem.innerHTML = `<span class="icon">📁</span> <span class="name">..</span>`;
        backItem.addEventListener('click', () => browseDirectory(parentDir));
        fileListElement.appendChild(backItem);
      }
      
      // 显示文件和目录
      files.forEach(file => {
        const fileItem = document.createElement('div');
        fileItem.className = `file-item ${file.isDirectory ? 'directory' : 'file'}`;
        
        const icon = file.isDirectory ? '📁' : '📄';
        fileItem.innerHTML = `<span class="icon">${icon}</span> <span class="name">${file.name}</span>`;
        
        // 添加点击事件
        if (file.isDirectory) {
          fileItem.addEventListener('click', () => browseDirectory(`${path}/${file.name}`.replace(/\/+/g, '/')));
        } else {
          fileItem.addEventListener('click', () => downloadFile(`${path}/${file.name}`.replace(/\/+/g, '/')));
        }
        
        // 添加右键菜单
        fileItem.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          showContextMenu(e, file, `${path}/${file.name}`.replace(/\/+/g, '/'));
        });
        
        fileListElement.appendChild(fileItem);
      });
      
      // 更新当前路径显示
      pathInput.value = path;
      
    } catch (error) {
      console.error('浏览目录失败:', error);
      showStatus(`浏览目录失败: ${(error as Error).message}`, true);
    }
  }

  // 下载文件
  async function downloadFile(path: string) {
    try {
      // 获取文件内容
      const content = await webdav.readFile(path);
      
      // 创建Blob对象
      const blob = new Blob([content]);
      
      // 创建下载链接
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = path.split('/').pop() || 'download';
      document.body.appendChild(a);
      a.click();
      
      // 清理
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 0);
      
      showStatus('文件下载成功');
    } catch (error) {
      console.error('下载文件失败:', error);
      showStatus(`下载文件失败: ${(error as Error).message}`, true);
    }
  }

  // 上传文件
  async function uploadFile(path: string, file: File) {
    try {
      // 读取文件内容
      const content = await file.arrayBuffer();
      
      // 上传到WebDAV
      const targetPath = `${path}/${file.name}`.replace(/\/+/g, '/');
      await webdav.writeFile(targetPath, new Uint8Array(content), {
        contentType: file.type || 'application/octet-stream',
      });
      
      // 刷新目录
      browseDirectory(path);
      showStatus('文件上传成功');
    } catch (error) {
      console.error('上传文件失败:', error);
      showStatus(`上传文件失败: ${(error as Error).message}`, true);
    }
  }

  // 创建文件夹
  async function createFolder(path: string, name: string) {
    if (!name) {
      showStatus('请输入文件夹名称', true);
      return;
    }
    
    try {
      const folderPath = `${path}/${name}`.replace(/\/+/g, '/');
      await webdav.mkdir(folderPath);
      
      // 刷新目录
      browseDirectory(path);
      showStatus('文件夹创建成功');
      folderNameInput.value = '';
    } catch (error) {
      console.error('创建文件夹失败:', error);
      showStatus(`创建文件夹失败: ${(error as Error).message}`, true);
    }
  }

  // 删除文件或文件夹
  async function deleteItem(path: string, isDirectory: boolean) {
    try {
      if (isDirectory) {
        await webdav.rmdir(path, true);
      } else {
        await webdav.deleteFile(path);
      }
      
      // 刷新目录
      const parentDir = path.substring(0, path.lastIndexOf('/')) || '/';
      browseDirectory(parentDir);
      showStatus(`${isDirectory ? '文件夹' : '文件'}删除成功`);
    } catch (error) {
      console.error('删除失败:', error);
      showStatus(`删除失败: ${(error as Error).message}`, true);
    }
  }

  // 显示右键菜单
  function showContextMenu(event: MouseEvent, file: any, path: string) {
    // 移除现有菜单
    const existingMenu = document.querySelector('.context-menu');
    if (existingMenu) {
      document.body.removeChild(existingMenu);
    }
    
    // 创建菜单
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.position = 'absolute';
    menu.style.left = `${event.pageX}px`;
    menu.style.top = `${event.pageY}px`;
    menu.style.backgroundColor = 'white';
    menu.style.border = '1px solid #ccc';
    menu.style.padding = '5px';
    menu.style.boxShadow = '2px 2px 5px rgba(0,0,0,0.2)';
    menu.style.zIndex = '1000';
    
    // 添加菜单项
    const deleteItem = document.createElement('div');
    deleteItem.textContent = `删除${file.isDirectory ? '文件夹' : '文件'}`;
    deleteItem.style.padding = '5px 10px';
    deleteItem.style.cursor = 'pointer';
    deleteItem.addEventListener('click', () => {
      if (confirm(`确定要删除${file.isDirectory ? '文件夹' : '文件'} "${file.name}" 吗？`)) {
        deleteItem(path, file.isDirectory);
      }
      document.body.removeChild(menu);
    });
    menu.appendChild(deleteItem);
    
    // 添加到文档
    document.body.appendChild(menu);
    
    // 点击其他地方关闭菜单
    document.addEventListener('click', function closeMenu() {
      if (document.body.contains(menu)) {
        document.body.removeChild(menu);
      }
      document.removeEventListener('click', closeMenu);
    });
  }

  // 绑定事件
  browseButton.addEventListener('click', () => {
    browseDirectory(pathInput.value || '/');
  });
  
  uploadInput.addEventListener('change', (e) => {
    const files = (e.target as HTMLInputElement).files;
    if (files && files.length > 0) {
      uploadFile(pathInput.value || '/', files[0]);
    }
  });
  
  createFolderButton.addEventListener('click', () => {
    createFolder(pathInput.value || '/', folderNameInput.value);
  });

  // 初始加载根目录
  browseDirectory('/');
});

// 以下是HTML结构示例，可以将其添加到你的HTML文件中
/*
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WebDAV文件浏览器</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    .controls {
      margin-bottom: 20px;
      display: flex;
      gap: 10px;
      align-items: center;
    }
    .file-list {
      border: 1px solid #ccc;
      padding: 10px;
      min-height: 300px;
    }
    .file-item {
      padding: 5px;
      cursor: pointer;
      display: flex;
      align-items: center;
    }
    .file-item:hover {
      background-color: #f0f0f0;
    }
    .file-item .icon {
      margin-right: 10px;
    }
    .directory {
      color: #0066cc;
    }
    .file {
      color: #333;
    }
    .status {
      margin-top: 10px;
      padding: 5px;
    }
    .success {
      color: green;
    }
    .error {
      color: red;
    }
  </style>
</head>
<body>
  <h1>WebDAV文件浏览器</h1>
  
  <div class="controls">
    <input type="text" id="path-input" placeholder="路径" value="/" style="flex-grow: 1;">
    <button id="browse-button">浏览</button>
  </div>
  
  <div class="file-list" id="file-list"></div>
  
  <div class="controls">
    <input type="file" id="upload-input">
    <button id="upload-button">上传文件</button>
  </div>
  
  <div class="controls">
    <input type="text" id="folder-name-input" placeholder="文件夹名称">
    <button id="create-folder-button">创建文件夹</button>
  </div>
  
  <div class="status" id="status"></div>
  
  <script src="browser-usage.js"></script>
</body>
</html>
*/