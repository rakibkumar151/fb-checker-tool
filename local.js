import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import handler from './api/index.js';

const app = express();
const PORT = 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api', async (req, res) => {
    await handler(req, res);
});

app.listen(PORT, () => {
    console.log(`\n🚀 Server running at: http://localhost:${PORT}\n`);
});