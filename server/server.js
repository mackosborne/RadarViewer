// server.js
const express = require('express');
const codegrid = require('./codegrid');
const grid = codegrid.CodeGrid();
const cors = require('cors');

const app = express();

app.use(cors());

app.get('/getcode', (req, res) => {
    const lat = req.query.lat;
    const lng = req.query.lng;

    grid.getCode(lat, lng, (err, code) => {
        if (err) {
            res.status(500).send(err);
        } else {
            res.send({ code });
        }
    });
});

app.listen(3333, () => {
    console.log('Server is running on port 3333');
});