const fs = require('fs');
const content = fs.readFileSync('public/investmentdashboard.html', 'utf8');

const target = '// ── Auto-refresh: poll dashboard data every 15 seconds ──';
let index = content.indexOf(target);
if (index !== -1) {
    console.log(content.slice(index, index + 2000));
} else {
    console.log('Not found');
}
