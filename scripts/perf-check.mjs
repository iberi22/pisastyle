import fs from 'fs';
import path from 'path';

const budget = JSON.parse(fs.readFileSync('perf-budget.json', 'utf-8'));
const distClientDir = path.join(process.cwd(), 'dist', 'client', '_astro');

let totalJsSize = 0;
let totalCssSize = 0;

if (fs.existsSync(distClientDir)) {
  const files = fs.readdirSync(distClientDir);
  files.forEach(file => {
    const filePath = path.join(distClientDir, file);
    const stats = fs.statSync(filePath);
    if (file.endsWith('.js')) {
      totalJsSize += stats.size;
    } else if (file.endsWith('.css')) {
      totalCssSize += stats.size;
    }
  });
}

const totalJsKb = totalJsSize / 1024;
const totalCssKb = totalCssSize / 1024;

console.log(`Performance Budget Check:`);
console.log(`JS: ${totalJsKb.toFixed(2)} KB (Budget: ${budget.js_max_kb} KB)`);
console.log(`CSS: ${totalCssKb.toFixed(2)} KB (Budget: ${budget.css_max_kb} KB)`);

if (totalJsKb > budget.js_max_kb || totalCssKb > budget.css_max_kb) {
  console.error('Performance budget exceeded!');
} else {
  console.log('Performance budget met.');
}
