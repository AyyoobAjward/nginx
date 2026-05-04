const http = require('http');

const PORT = 3080;

const server = http.createServer((req, res) => {
    let body = '';

    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', () => {
        // Build full request info
        const requestInfo = {
            method: req.method,
            url: req.url,
            httpVersion: req.httpVersion,
            headers: req.headers,
            body: body || null
        };

        // Send as JSON response
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(requestInfo, null, 2));
    });
});

server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});