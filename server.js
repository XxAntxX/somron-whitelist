const express = require('express');
const { Rcon } = require('rcon-client');
const path = require('path');
const axios = require('axios');
const fs = require('fs');

const app = express();
app.use(express.json());

// --- CONFIGURATION ---
const RCON_HOST = process.env.RCON_HOST || 'minecraft-server';
const RCON_PORT = process.env.RCON_PORT || 25575;
const RCON_PASSWORD = process.env.RCON_PASSWORD || 'mySecretPassword';
const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID || '';

// --- DYNAMIC API ROUTES (Regex matches any prefix) ---

// 1. CONFIG: Matches "/anything/here/config"
app.get(/.*\/config$/, (req, res) => {
    res.json({ clientId: AZURE_CLIENT_ID });
});

// 2. WHITELIST: Matches "/anything/here/whitelist"
app.post(/.*\/whitelist$/, async (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: "No username provided" });

    console.log(`Whitelist request for: ${username}`);
    
    const rcon = new Rcon({ 
        host: RCON_HOST, 
        port: parseInt(RCON_PORT), 
        password: RCON_PASSWORD 
    });

    try {
        await rcon.connect();
        const response = await rcon.send(`whitelist add ${username}`);
        await rcon.end();
        res.json({ success: true, message: response });
    } catch (error) {
        console.error("RCON Error:", error.message);
        res.status(500).json({ success: false, error: "RCON Connection failed." });
    }
});

// 3. PROXY: Matches "/anything/here/proxy"
// We use a middleware style here to capture the regex group easily
app.use(/.*\/proxy/, async (req, res) => {
    const targetUrl = req.query.url;

    if (!targetUrl) return res.status(400).send("Missing 'url'");

    const allowedDomains = ['xboxlive.com', 'minecraftservices.com', 'microsoftonline.com', 'live.com'];
    if (!allowedDomains.some(d => targetUrl.includes(d))) {
        return res.status(403).send("Forbidden Domain");
    }

    try {
        const response = await axios({
            method: req.method,
            url: targetUrl,
            data: req.body,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': req.headers.authorization,
                'x-xbl-contract-version': req.headers['x-xbl-contract-version'] || '2'
            }
        });
        res.json(response.data);
    } catch (error) {
        if (error.response) {
            res.status(error.response.status).json(error.response.data);
        } else {
            res.status(500).json({ error: "Proxy Error" });
        }
    }
});

// 4. CATCH-ALL: Serve index.html for EVERYTHING else
// This ensures that if you go to server.com/my/weird/path, it serves the HTML
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Portal running on port ${PORT} (Path Agnostic)`));