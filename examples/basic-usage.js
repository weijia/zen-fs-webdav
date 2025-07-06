/**
 * 基本使用示例
 * 
 * 这个示例展示了 zen-fs-webdav 的基本用法，包括：
 * - 连接到 WebDAV 服务器
 * - 列出目录内容
 * - 读取和写入文件
 * - 创建和删除目录
 * - 复制和移动文件
 */

const { WebDAVFS } = require('../dist/index.js');

// 创建 WebDAV 客户端实例
const webdavFs = new WebDAVFS({
  baseUrl: 'https://your-webdav-server.com/webdav',
  auth: {
    username: 'your-username',
    password: 'your-password'
  },
  // 可选：启用缓存
  cache: true,
  cacheExpiration: 60000 // 缓存过期时间，单位毫秒
});

// 主函数
async function main() {
  try {
    console.log('开始 WebDAV 操作示例...');

    // 检查根目录是否存在
    const rootExists = await webdavFs.exists('/');
    console.log(`根目录存在: ${rootExists}`);

    // 列出根目录内容
    console.log('\n列出根目录内容:');
    const rootFiles = await webdavFs.readDir('/');
    rootFiles.forEach(file => {
      console.log(`- ${file.name} (${file.isDirectory ? '目录' : '文件'}, ${file.size} 字节)`);
    });

    // 创建测试目录
    const testDir = '/zen-fs-test-' + Date.now();
    console.log(`\n创建测试目录: ${testDir}`);
    await webdavFs.mkdir(testDir);

    // 写入文本文件
    const textFilePath = `${testDir}/hello.txt`;
    console.log(`\n写入文本文件: ${textFilePath}`);
    await webdavFs.writeFile(textFilePath, 'Hello, WebDAV!');

    // 读取文本文件
    console.log(`\n读取文本文件: ${textFilePath}`);
    const textContent = await webdavFs.readFile(textFilePath, { encoding: 'utf8' });
    console.log(`文件内容: ${textContent}`);

    // 写入二进制文件
    const binaryFilePath = `${testDir}/binary.dat`;
    console.log(`\n写入二进制文件: ${binaryFilePath}`);
    const binaryData = new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F]); // "Hello" in ASCII
    await webdavFs.writeFile(binaryFilePath, binaryData);

    // 读取二进制文件
    console.log(`\n读取二进制文件: ${binaryFilePath}`);
    const binaryContent = await webdavFs.readFile(binaryFilePath);
    console.log(`二进制文件内容 (前5字节): [${Array.from(binaryContent.slice(0, 5)).join(', ')}]`);

    // 获取文件信息
    console.log(`\n获取文件信息: ${textFilePath}`);
    const fileStats = await webdavFs.stat(textFilePath);
    console.log('文件信息:', {
      name: fileStats.name,
      size: fileStats.size,
      isDirectory: fileStats.isDirectory,
      lastModified: fileStats.lastModified,
      contentType: fileStats.contentType
    });

    // 复制文件
    const copiedFilePath = `${testDir}/hello-copy.txt`;
    console.log(`\n复制文件: ${textFilePath} -> ${copiedFilePath}`);
    await webdavFs.copy(textFilePath, copiedFilePath);

    // 移动/重命名文件
    const movedFilePath = `${testDir}/hello-moved.txt`;
    console.log(`\n移动文件: ${copiedFilePath} -> ${movedFilePath}`);
    await webdavFs.move(copiedFilePath, movedFilePath);

    // 列出测试目录内容
    console.log(`\n列出测试目录内容: ${testDir}`);
    const testDirFiles = await webdavFs.readDir(testDir);
    testDirFiles.forEach(file => {
      console.log(`- ${file.name} (${file.isDirectory ? '目录' : '文件'}, ${file.size} 字节)`);
    });

    // 创建子目录
    const subDir = `${testDir}/subdir`;
    console.log(`\n创建子目录: ${subDir}`);
    await webdavFs.mkdir(subDir);

    // 在子目录中创建文件
    const subDirFilePath = `${subDir}/subfile.txt`;
    console.log(`\n在子目录中创建文件: ${subDirFilePath}`);
    await webdavFs.writeFile(subDirFilePath, 'File in subdirectory');

    // 递归删除目录
    console.log(`\n递归删除测试目录: ${testDir}`);
    await webdavFs.rmdir(testDir, { recursive: true });

    // 验证目录已删除
    const dirExists = await webdavFs.exists(testDir);
    console.log(`测试目录存在: ${dirExists}`);

    console.log('\n示例完成!');
  } catch (error) {
    console.error('发生错误:', error);
    if (error.status) {
      console.error(`HTTP 状态码: ${error.status}`);
    }
  }
}

// 运行示例
main();