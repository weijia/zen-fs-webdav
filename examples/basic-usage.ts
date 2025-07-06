import { WebDAVFileSystem } from '../src/WebDAVFileSystem';

// 创建 WebDAV 文件系统实例
const fs = new WebDAVFileSystem({
  baseUrl: 'https://example.com/webdav',
  username: 'user',
  password: 'pass',
});

// 异步函数来执行示例操作
async function runExample() {
  try {
    // 检查文件是否存在
    const fileExists = await fs.exists('/test.txt');
    console.log(`文件存在: ${fileExists}`);

    // 如果文件不存在，创建它
    if (!fileExists) {
      console.log('创建文件...');
      await fs.writeFile('/test.txt', 'Hello, WebDAV!');
      console.log('文件已创建');
    }

    // 读取文件内容
    const content = await fs.readFile('/test.txt');
    console.log(`文件内容: ${content}`);

    // 追加内容到文件
    console.log('追加内容到文件...');
    await fs.appendFile('/test.txt', '\nThis is a new line.');
    
    // 再次读取文件内容
    const updatedContent = await fs.readFile('/test.txt');
    console.log(`更新后的文件内容: ${updatedContent}`);

    // 创建目录
    console.log('创建目录...');
    await fs.mkdir('/example-dir', { recursive: true });

    // 复制文件到新目录
    console.log('复制文件到新目录...');
    await fs.copy('/test.txt', '/example-dir/test-copy.txt');

    // 列出目录内容
    console.log('列出目录内容...');
    const files = await fs.readdir('/example-dir');
    console.log('目录内容:');
    files.forEach(file => {
      console.log(`- ${file.name} (${file.isDirectory ? '目录' : '文件'}, 大小: ${file.size} 字节)`);
    });

    // 重命名文件
    console.log('重命名文件...');
    await fs.rename('/example-dir/test-copy.txt', 'renamed-test.txt');

    // 再次列出目录内容
    console.log('重命名后的目录内容:');
    const updatedFiles = await fs.readdir('/example-dir');
    updatedFiles.forEach(file => {
      console.log(`- ${file.name} (${file.isDirectory ? '目录' : '文件'}, 大小: ${file.size} 字节)`);
    });

    // 删除文件
    console.log('删除文件...');
    await fs.unlink('/example-dir/renamed-test.txt');

    // 删除目录
    console.log('删除目录...');
    await fs.rmdir('/example-dir');

    console.log('示例完成');
  } catch (error) {
    console.error('发生错误:', error);
  }
}

// 运行示例
runExample();