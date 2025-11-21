const express = require('express');
const { Rcon } = require('rcon-client');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- CONFIGURATION ---
const RCON_HOST = process.env.RCON_HOST || 'minecraft-server';
const RCON_PORT = process.env.RCON_PORT || 25575;
const RCON_PASSWORD = process.env.RCON_PASSWORD || 'mySecretPassword';
const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID || ''; // Loaded from Docker

// 1. NEW: Endpoint to send Client ID to the frontend
app.get('/config', (req, res) => {
    res.json({ clientId: AZURE_CLIENT_ID });
});

// 2. Whitelist Logic
app.post('/whitelist', async (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: "No username provided" });

    console.log(`Request to whitelist: ${username}`);
    
    const rcon = new Rcon({ 
        host: RCON_HOST, 
        port: parseInt(RCON_PORT), 
        password: RCON_PASSWORD 
    });

    try {
        await rcon.connect();
        const response = await rcon.send(`whitelist add ${username}`);
        await rcon.end();
        console.log(`RCON Response: ${response}`);
        res.json({ success: true, message: response });
    } catch (error) {
        console.error("RCON Error:", error.message);
        res.status(500).json({ success: false, error: "Connection to Minecraft Server failed." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Portal running on port ${PORT}`));