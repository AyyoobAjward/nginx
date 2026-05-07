const express = require('express');

const app = express();
const PORT = 3080;

app.use(express.json());

app.get('/data', (req, res) => {

    const receivedData = {
        params: req.params,
        headers: req.headers,
        query: req.query
    }

    // Tell nginx (and clients) to cache this response for 60 minutes
    // res.set('Cache-Control', 'public, max-age=3600');

    res.status(200).json({
        status: 'success',
        message: 'Request received',
        timestamp: new Date().toISOString(),
        data: receivedData
    });
});

app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});