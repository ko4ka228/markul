// Копирует сторонние библиотеки из node_modules в renderer/vendor,
// чтобы они попали в итоговую сборку приложения и грузились локально
// (без интернета) внутри упакованного .exe.
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const vendorDir = path.join(root, 'src', 'renderer', 'vendor');

const files = [
  {
    from: path.join(root, 'node_modules', 'chart.js', 'dist', 'chart.umd.js'),
    to: path.join(vendorDir, 'chart.umd.js'),
  },
];

fs.mkdirSync(vendorDir, { recursive: true });

let copied = 0;
for (const f of files) {
  if (!fs.existsSync(f.from)) {
    console.warn('[copy-vendor] пропущено (нет файла): ' + f.from);
    console.warn('[copy-vendor] Установите зависимости: npm install');
    continue;
  }
  fs.copyFileSync(f.from, f.to);
  copied++;
  console.log('[copy-vendor] ' + path.basename(f.to) + ' -> src/renderer/vendor/');
}

console.log('[copy-vendor] готово, файлов скопировано: ' + copied);
