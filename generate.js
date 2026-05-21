const fs = require('fs');
const user = fs.readFileSync('routes/user.js', 'utf8');
const admin = fs.readFileSync('routes/admin.js', 'utf8');
const userModel = fs.readFileSync('models/User.js', 'utf8');

const combined = `### models/User.js
\`\`\`javascript
${userModel}
\`\`\`

### routes/user.js
\`\`\`javascript
${user}
\`\`\`

### routes/admin.js
\`\`\`javascript
${admin}
\`\`\`
`;

fs.writeFileSync('UPDATED_BACKEND_FILES.md', combined);
console.log('File generated successfully');
