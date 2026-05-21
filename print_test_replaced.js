const fs = require('fs');

const testPath = 'public/leaf/assets/index-B7CRb-Yy.test.js';
if (fs.existsSync(testPath)) {
    const content = fs.readFileSync(testPath, 'utf8');
    const startTarget = 'window.__setPositions';
    const index = content.indexOf(startTarget);
    if (index !== -1) {
        console.log('=== START OF REPLACEMENT IN TEST FILE ===');
        console.log(content.slice(index - 100, index + 300));
        
        console.log('=== END OF REPLACEMENT IN TEST FILE ===');
        const endTarget = 'leaf-trading-v15';
        const endIndex = content.indexOf(endTarget);
        if (endIndex !== -1) {
            console.log(content.slice(endIndex - 200, endIndex + 200));
        }
    } else {
        console.log('setPositions not found in test file');
    }
} else {
    console.log('Test file does not exist');
}
