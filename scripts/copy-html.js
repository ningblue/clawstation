/**
 * 构建后复制静态文件到 dist 目录
 */
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src', 'renderer');
const distDir = path.join(__dirname, '..', 'dist', 'renderer');

// 确保目标目录存在
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// 要复制的文件
const filesToCopy = [
  'index.html',
  'styles.css',
  // 添加其他需要复制的静态文件
];

filesToCopy.forEach(file => {
  const srcPath = path.join(srcDir, file);
  const distPath = path.join(distDir, file);

  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, distPath);
    console.log(`Copied: ${file}`);
  } else {
    console.log(`Warning: ${file} not found in source`);
  }
});

// 复制 JavaScript 组件文件（不被 TypeScript 编译的 .js 文件）
const jsComponentsDir = path.join(srcDir, 'components', 'chat');
const distComponentsDir = path.join(distDir, 'components', 'chat');

if (fs.existsSync(jsComponentsDir) && fs.existsSync(distComponentsDir)) {
  const jsFiles = fs.readdirSync(jsComponentsDir).filter(f => f.endsWith('.js'));
  jsFiles.forEach(file => {
    const srcPath = path.join(jsComponentsDir, file);
    const distPath = path.join(distComponentsDir, file);
    fs.copyFileSync(srcPath, distPath);
    console.log(`Copied JS component: ${file}`);
  });
}

// 复制 styles 目录
const srcStylesDir = path.join(srcDir, 'styles');
const distStylesDir = path.join(distDir, 'styles');

if (fs.existsSync(srcStylesDir)) {
  if (!fs.existsSync(distStylesDir)) {
    fs.mkdirSync(distStylesDir, { recursive: true });
  }

  const styleFiles = fs.readdirSync(srcStylesDir);
  styleFiles.forEach(file => {
    const srcPath = path.join(srcStylesDir, file);
    const distPath = path.join(distStylesDir, file);
    if (fs.statSync(srcPath).isFile()) {
      fs.copyFileSync(srcPath, distPath);
      console.log(`Copied style: ${file}`);
    }
  });
}

console.log('Static files copied successfully!');
