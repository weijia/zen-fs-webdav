/**
 * Node.js环境下使用zen-fs-webdav的示例
 * 
 * 运行方法：
 * 1. 确保已安装zen-fs-webdav: npm install zen-fs-webdav
 * 2. 运行: node node-example.js
 */

// 在实际使用中，应该使用 require('zen-fs-webdav') 导入
// 这里假设我们在本地开发环境中
const { WebDAVFS } = require('../dist/index');

// 创建WebDAVFS实例
const webdavFs = new WebDAVFS({
  baseUrl: 'https://your-webdav-server.com/webdav',
  auth: {
    username: 'your-username',
    password: 'your-password'
  },
  // 启用缓存
  cache: true,
  cacheExpiration: 60000, // 1分钟
});

// 异步函数用于演示各种操作
async function runExample() {
  try {
    console.log('开始WebDAV操作示例...');

    // 检查文件是否存在
    const fileExists = await webdavFs.exists('/test.txt');
    console.log(`文件存在: ${fileExists}`);

    // 如果文件不存在，创建它
    if (!fileExists) {
      console.log('创建文件...');
      await webdavFs.writeFile('/test.txt', 'Hello from zen-fs-webdav!');
      console.log('文件创建成功');
    }

    // 读取文件内容
    console.log('读取文件内容...');
    const content = await webdavFs.readFile('/test.txt', { encoding: 'utf8' });
    console.log(`文件内容: ${content}`);

    // 获取文件信息
    console.log('获取文件信息...');
    const stats = await webdavFs.stat('/test.txt');
    console.log('文件信息:', {
      name: stats.name,
      size: stats.size,
      isDirectory: stats.isDirectory,
      lastModified: stats.lastModified,
      contentType: stats.contentType
    });

    // 创建目录
    console.log('创建目录...');
    const dirExists = await webdavFs.exists('/example-dir');
    if (!dirExists) {
      await webdavFs.mkdir('/example-dir');
      console.log('目录创建成功');
    } else {
      console.log('目录已存在');
    }

    // 复制文件到目录
    console.log('复制文件到目录...');
    await webdavFs.copy('/test.txt', '/example-dir/test-copy.txt');
    console.log('文件复制成功');

    // 列出目录内容
    console.log('列出目录内容...');
    const files = await webdavFs.readDir('/example-dir');
    console.log('目录内容:');
    files.forEach(file => {
      console.log(`- ${file.name} (${file.isDirectory ? '目录' : '文件'})`);
    });

    // 移动文件
    console.log('移动文件...');
    await webdavFs.move('/example-dir/test-copy.txt', '/example-dir/test-moved.txt');
    console.log('文件移动成功');

    // 删除文件
    console.log('删除文件...');
    await webdavFs.deleteFile('/example-dir/test-moved.txt');
    console.log('文件删除成功');

    // 删除目录
    console.log('删除目录...');
    await webdavFs.rmdir('/example-dir');
    console.log('目录删除成功');

    console.log('示例完成!');
  } catch (error) {
    console.error('发生错误:', error);
  }
}

// 运行示例
runExample();