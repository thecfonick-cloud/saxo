const fs = require('fs');
const content = fs.readFileSync('public/leaf/assets/index-B7CRb-Yy.js', 'utf8');

const targetStart = 'xo((e,t)=>({balance:1e6';
const targetEnd = 'slice(0,200)}:e})}),{name:`leaf-trading-v15`';

const startIndex = content.indexOf(targetStart);
const endIndex = content.indexOf(targetEnd);

// Let's print the segment of the original file
console.log('Original content segment size:', endIndex - startIndex);
console.log('Original start snippet:', content.slice(startIndex, startIndex + 150));
console.log('Original end snippet:', content.slice(endIndex - 150, endIndex + targetEnd.length + 50));
