import { createApp } from './src/app.js';

try { process.loadEnvFile?.('.env'); } catch { /* .env is optional */ }
const port = Number(process.env.PORT) || 5000;
createApp().listen(port, () => console.log(`EVM Cost Tracker API listening on http://localhost:${port}`));
