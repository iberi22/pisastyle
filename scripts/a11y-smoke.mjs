import fs from 'fs';
import path from 'path';

const distDir = path.join(process.cwd(), 'dist');

function scanHtmlFiles(dir) {
    let results = [];
    if (!fs.existsSync(dir)) {
        return results;
    }
    const list = fs.readdirSync(dir);
    for (const file of list) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            results = results.concat(scanHtmlFiles(filePath));
        } else if (file.endsWith('.html')) {
            results.push(filePath);
        }
    }
    return results;
}

function analyzeFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');

    // Check lang
    const langMatch = content.match(/<html[^>]*lang=["']([^"']+)["'][^>]*>/i);
    const hasLang = !!langMatch;

    // Check title
    const titleMatch = content.match(/<title[^>]*>(.*?)<\/title>/i);
    const hasTitle = !!titleMatch && titleMatch[1].trim().length > 0;

    // Check alts in img
    const imgMatches = content.match(/<img[^>]+>/gi) || [];
    let imgCount = imgMatches.length;
    let imgWithAltCount = 0;
    imgMatches.forEach(img => {
        if (/alt=["'][^"']*["']/i.test(img)) {
            imgWithAltCount++;
        }
    });

    // Check roles
    const roleMatches = content.match(/\brole=["'][^"']+["']/gi) || [];
    const roleCount = roleMatches.length;

    return {
        file: path.relative(process.cwd(), filePath),
        hasLang,
        hasTitle,
        imgCount,
        imgWithAltCount,
        roleCount
    };
}

const htmlFiles = scanHtmlFiles(distDir);

console.log(`Found ${htmlFiles.length} HTML files in dist/\n`);

let totalImgCount = 0;
let totalImgWithAltCount = 0;
let totalRoleCount = 0;
let missingLangCount = 0;
let missingTitleCount = 0;

for (const file of htmlFiles) {
    const stats = analyzeFile(file);
    console.log(`File: ${stats.file}`);
    console.log(`  - lang attribute: ${stats.hasLang ? 'Yes' : 'No'}`);
    console.log(`  - <title>: ${stats.hasTitle ? 'Yes' : 'No'}`);
    console.log(`  - Images with alt: ${stats.imgWithAltCount}/${stats.imgCount}`);
    console.log(`  - Roles found: ${stats.roleCount}`);
    console.log('');

    totalImgCount += stats.imgCount;
    totalImgWithAltCount += stats.imgWithAltCount;
    totalRoleCount += stats.roleCount;
    if (!stats.hasLang) missingLangCount++;
    if (!stats.hasTitle) missingTitleCount++;
}

console.log('--- Summary ---');
console.log(`Total HTML files: ${htmlFiles.length}`);
console.log(`Files missing lang: ${missingLangCount}`);
console.log(`Files missing title: ${missingTitleCount}`);
console.log(`Images with alt / Total images: ${totalImgWithAltCount} / ${totalImgCount}`);
console.log(`Total roles found: ${totalRoleCount}`);
