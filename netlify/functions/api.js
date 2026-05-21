const serverless = require('serverless-http');
const app = require('../../server'); // Import our preconfigured Express app object

module.exports.handler = serverless(app, {
    binary: [
        'image/*',
        'application/pdf',
        'multipart/form-data'
    ]
});
