const fs = require('fs');
const content = fs.readFileSync('public/leaf/assets/index-B7CRb-Yy.js', 'utf8');

const targets = ['location.hash', 'hash', 'replaceState', 'decodeURIComponent'];

for (const t of targets) {
    let index = 0;
    let count = 0;
    while ((index = content.indexOf(t, index)) !== -1) {
        count++;
        const start = Math.max(0, index - 200);
        const end = Math.min(content.length, index + 300);
        console.log(`--- Match for "${t}" #${count} (at index ${index}) ---`);
        console.log(content.slice(start, end));
        index += t.length;
        if (count >= 5) break;
    }
}
