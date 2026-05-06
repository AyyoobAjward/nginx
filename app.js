const express = require('express');

const app = express();
const PORT = 3080;

app.use(express.json());

app.post('/data', (req, res) => {

    const recivedData = {
        body: req.body,
        params: req.params,
        headers: req.headers,
        query: req.query
    }

    res.status(200).json({
        status: 'success',
        message: 'Request received',
        timestamp: new Date().toISOString(),
        data: recivedData
    });
});

app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});