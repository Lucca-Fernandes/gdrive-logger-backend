// src/server.js
const express = require('express');
const cors = require('cors');
const { getAllWithFilters } = require('./queries.js');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/data', async (req, res) => {
  try {
    const result = await getAllWithFilters(req.query);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API → http://localhost:${PORT}/api/data`);
});