const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// 确保 resources 目录存在
const resourcesDir = path.join(__dirname, '../resources');
if (!fs.existsSync(resourcesDir)) {
    fs.mkdirSync(resourcesDir, { recursive: true });
}

const outputZipPath = path.join(resourcesDir, 'openclaw.zip');
const sourceDir = path.join(resourcesDir, 'openclaw');

console.log(`正在创建压缩包: ${outputZipPath}`);
console.log(`源目录: ${sourceDir}`);

const output = fs.createWriteStream(outputZipPath);
const archive = archiver('zip', {
    zlib: { level: 9 } // 设置最高压缩级别
});

output.on('close', function() {
    const sizeInMB = (archive.pointer() / 1024 / 1024).toFixed(2);
    console.log(`压缩完成！总大小: ${archive.pointer()} 字节 (${sizeInMB} MB)`);
});

archive.on('warning', function(err) {
    if (err.code === 'ENOENT') {
        console.warn('警告:', err);
    } else {
        throw err;
    }
});

archive.on('error', function(err) {
    console.error('压缩失败:', err);
    process.exit(1);
});

archive.pipe(output);

// 添加文件，同时应用过滤规则
// 参考 electron-builder.yml 中的 exclude 规则
const ignorePatterns = [
    'docs/**/*.md',
    'docs/**/images/**',
    'docs/**/assets/**',
    'node_modules/**/*.md',
    'node_modules/**/*.map',
    'node_modules/**/test/**',
    'node_modules/**/tests/**',
    'node_modules/**/docs/**',
    'node_modules/**/examples/**',
    'node_modules/**/.github/**',
    'node_modules/**/LICENSE*',
    'node_modules/**/README*',
    'node_modules/**/CHANGELOG*',
    'node_modules/**/AUTHORS*',
    'node_modules/**/CONTRIBUTORS*',
    'node_modules/**/*.d.ts',
    'node_modules/**/*.tsbuildinfo',
    'node_modules/pdfjs-dist/build/*.min.mjs',
    'node_modules/pdfjs-dist/cmaps/**',
    'node_modules/pdfjs-dist/legacy/**',
    'node_modules/pdfjs-dist/image_decoders/**',
    'node_modules/@napi-rs/canvas/**/*.dylib',
    'node_modules/@napi-rs/canvas/**/*.so',
    'node_modules/node-llama-cpp/**'
];

// 将 openclaw 目录下的所有内容添加到 zip 文件的根目录，应用过滤
archive.glob('**/*', {
    cwd: sourceDir,
    ignore: ignorePatterns,
    dot: true // 包含以 . 开头的文件
});

archive.finalize();
