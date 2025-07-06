/**
 * 集成测试
 * 
 * 注意：这些测试需要一个真实的WebDAV服务器才能运行。
 * 你可以使用以下方式设置测试环境变量：
 * 
 * WEBDAV_TEST_URL=https://your-webdav-server.com/webdav
 * WEBDAV_TEST_USERNAME=your-username
 * WEBDAV_TEST_PASSWORD=your-password
 * 
 * 如果没有设置这些环境变量，测试将被跳过。
 */

import { WebDAVFS } from '../webdav-fs';
import { WebDAVError } from '../errors';

// 从环境变量获取测试配置
const testUrl = process.env.WEBDAV_TEST_URL;
const testUsername = process.env.WEBDAV_TEST_USERNAME;
const testPassword = process.env.WEBDAV_TEST_PASSWORD;

// 如果没有设置测试环境变量，跳过所有测试
const shouldSkipTests = !testUrl;

// 生成随机测试目录名称
const testDirName = `test-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
const testDir = `/${testDirName}`;

// 创建WebDAVFS实例
const webdavFs = new WebDAVFS({
  baseUrl: testUrl || 'https://example.com',
  auth: testUsername && testPassword
    ? { username: testUsername, password: testPassword }
    : undefined,
});

// 在所有测试开始前创建测试目录
beforeAll(async () => {
  if (shouldSkipTests) {
    return;
  }

  try {
    await webdavFs.mkdir(testDir);
  } catch (error) {
    console.error('Failed to create test directory:', error);
    throw error;
  }
});

// 在所有测试结束后删除测试目录
afterAll(async () => {
  if (shouldSkipTests) {
    return;
  }

  try {
    await webdavFs.rmdir(testDir, { recursive: true });
  } catch (error) {
    console.error('Failed to clean up test directory:', error);
  }
});

// 条件性跳过测试的辅助函数
const conditionalTest = shouldSkipTests ? test.skip : test;

describe('WebDAVFS Integration Tests', () => {
  conditionalTest('should create and read a text file', async () => {
    const filePath = `${testDir}/test-file.txt`;
    const content = 'Hello, WebDAV!';

    // 写入文件
    await webdavFs.writeFile(filePath, content);

    // 检查文件是否存在
    const exists = await webdavFs.exists(filePath);
    expect(exists).toBe(true);

    // 读取文件内容
    const readContent = await webdavFs.readFile(filePath, { encoding: 'utf8' });
    expect(readContent).toBe(content);

    // 获取文件信息
    const stats = await webdavFs.stat(filePath);
    expect(stats.name).toBe('test-file.txt');
    expect(stats.isDirectory).toBe(false);
    expect(stats.size).toBe(content.length);
    expect(stats.lastModified).toBeInstanceOf(Date);
  });

  conditionalTest('should create and read a binary file', async () => {
    const filePath = `${testDir}/test-binary.bin`;
    const content = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04]);

    // 写入文件
    await webdavFs.writeFile(filePath, content);

    // 检查文件是否存在
    const exists = await webdavFs.exists(filePath);
    expect(exists).toBe(true);

    // 读取文件内容
    const readContent = await webdavFs.readFile(filePath);
    expect(readContent instanceof Uint8Array).toBe(true);
    expect(readContent.length).toBe(content.length);
    for (let i = 0; i < content.length; i++) {
      expect(readContent[i]).toBe(content[i]);
    }
  });

  conditionalTest('should create, list and remove directories', async () => {
    const dirPath = `${testDir}/test-dir`;
    const subDirPath = `${dirPath}/sub-dir`;

    // 创建目录
    await webdavFs.mkdir(dirPath);
    await webdavFs.mkdir(subDirPath);

    // 检查目录是否存在
    const dirExists = await webdavFs.exists(dirPath);
    expect(dirExists).toBe(true);

    const subDirExists = await webdavFs.exists(subDirPath);
    expect(subDirExists).toBe(true);

    // 获取目录信息
    const stats = await webdavFs.stat(dirPath);
    expect(stats.name).toBe('test-dir');
    expect(stats.isDirectory).toBe(true);

    // 列出目录内容
    const files = await webdavFs.readDir(dirPath);
    expect(files.length).toBe(1);
    expect(files[0].name).toBe('sub-dir');
    expect(files[0].isDirectory).toBe(true);

    // 删除子目录
    await webdavFs.rmdir(subDirPath);
    const subDirExistsAfterDelete = await webdavFs.exists(subDirPath);
    expect(subDirExistsAfterDelete).toBe(false);

    // 删除父目录
    await webdavFs.rmdir(dirPath);
    const dirExistsAfterDelete = await webdavFs.exists(dirPath);
    expect(dirExistsAfterDelete).toBe(false);
  });

  conditionalTest('should copy and move files', async () => {
    const sourceFilePath = `${testDir}/source.txt`;
    const copyFilePath = `${testDir}/copy.txt`;
    const moveFilePath = `${testDir}/moved.txt`;
    const content = 'File to be copied and moved';

    // 创建源文件
    await webdavFs.writeFile(sourceFilePath, content);

    // 复制文件
    await webdavFs.copy(sourceFilePath, copyFilePath);
    const copyExists = await webdavFs.exists(copyFilePath);
    expect(copyExists).toBe(true);

    // 检查复制的文件内容
    const copyContent = await webdavFs.readFile(copyFilePath, { encoding: 'utf8' });
    expect(copyContent).toBe(content);

    // 移动文件
    await webdavFs.move(copyFilePath, moveFilePath);
    const copyExistsAfterMove = await webdavFs.exists(copyFilePath);
    expect(copyExistsAfterMove).toBe(false);

    const moveExists = await webdavFs.exists(moveFilePath);
    expect(moveExists).toBe(true);

    // 检查移动后的文件内容
    const moveContent = await webdavFs.readFile(moveFilePath, { encoding: 'utf8' });
    expect(moveContent).toBe(content);

    // 清理
    await webdavFs.deleteFile(sourceFilePath);
    await webdavFs.deleteFile(moveFilePath);
  });

  conditionalTest('should handle errors correctly', async () => {
    const nonExistentFile = `${testDir}/non-existent.txt`;

    // 尝试读取不存在的文件
    await expect(webdavFs.readFile(nonExistentFile))
      .rejects
      .toThrow(WebDAVError);

    // 尝试获取不存在的文件的信息
    await expect(webdavFs.stat(nonExistentFile))
      .rejects
      .toThrow(WebDAVError);

    // 尝试删除不存在的文件
    await expect(webdavFs.deleteFile(nonExistentFile))
      .rejects
      .toThrow(WebDAVError);

    // 尝试创建已存在的目录
    const dirPath = `${testDir}/existing-dir`;
    await webdavFs.mkdir(dirPath);
    await expect(webdavFs.mkdir(dirPath))
      .rejects
      .toThrow(WebDAVError);

    // 清理
    await webdavFs.rmdir(dirPath);
  });

  conditionalTest('should handle recursive directory operations', async () => {
    const dirPath = `${testDir}/recursive-test`;
    const subDirPath = `${dirPath}/sub-dir`;
    const filePath1 = `${dirPath}/file1.txt`;
    const filePath2 = `${subDirPath}/file2.txt`;

    // 创建目录结构
    await webdavFs.mkdir(dirPath);
    await webdavFs.mkdir(subDirPath);
    await webdavFs.writeFile(filePath1, 'File 1');
    await webdavFs.writeFile(filePath2, 'File 2');

    // 递归删除目录
    await webdavFs.rmdir(dirPath, { recursive: true });

    // 验证目录及其内容已被删除
    const dirExists = await webdavFs.exists(dirPath);
    expect(dirExists).toBe(false);
  });

  conditionalTest('should handle special characters in paths', async () => {
    const specialFileName = `${testDir}/special-chars-测试-!@#$%^&()_+.txt`;
    const content = 'File with special characters in name';

    // 写入文件
    await webdavFs.writeFile(specialFileName, content);

    // 检查文件是否存在
    const exists = await webdavFs.exists(specialFileName);
    expect(exists).toBe(true);

    // 读取文件内容
    const readContent = await webdavFs.readFile(specialFileName, { encoding: 'utf8' });
    expect(readContent).toBe(content);

    // 清理
    await webdavFs.deleteFile(specialFileName);
  });
});