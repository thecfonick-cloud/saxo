const fs = require('fs');
const content = fs.readFileSync('routes/trade.js', 'utf8');

let index = 0;
let count = 0;
const target = 'activeTrades';
while ((index = content.indexOf(target, index)) !== -1) {
    count++;
    console.log(`Match #${count} at ${index}`);
    index += target.length;
}
if (count === 0) {
    console.log('No matches found for activeTrades in routes/trade.js');
}
