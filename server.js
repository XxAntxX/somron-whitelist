const express = require('express');
const { Rcon } = require('rcon-client');
const path = require('path');
const axios = require('axios'); // Import Axios

const app = express();

// Middleware to parse JSON bodies
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- CONFIGURATION ---
const RCON_HOST = process.env.RCON_HOST || 'minecraft-server';
const RCON_PORT = process.env.RCON_PORT || 25575;
const RCON_PASSWORD = process.env.RCON_PASSWORD || 'mySecretPassword';
const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID || '';

// 1. Config Endpoint
app.get('/config', (req, res) => {
    res.json({ clientId: AZURE_CLIENT_ID });
});

// 2. NEW: Custom CORS Proxy Endpoint
app.use('/proxy', async (req, res) => {
    const targetUrl = req.query.url;

    if (!targetUrl) {
        return res.status(400).send("Missing 'url' query parameter");
    }

    // Security: Allow Microsoft domains
    const allowedDomains = ['xboxlive.com', 'minecraftservices.com', 'microsoftonline.com', 'live.com'];
    if (!allowedDomains.some(d => targetUrl.includes(d))) {
        return res.status(403).send("Proxy Forbidden: Domain not allowed");
    }

    try {
        console.log(`Proxying: ${targetUrl}`);

        // Forward the request with the CRITICAL headers
        const response = await axios({
            method: req.method,
            url: targetUrl,
            data: req.body,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                // Forward the Auth token
                'Authorization': req.headers.authorization,
                // CRITICAL: Forward the contract version so Xbox sends the right JSON format
                'x-xbl-contract-version': req.headers['x-xbl-contract-version'] || '2'
            }
        });

        res.json(response.data);

    } catch (error) {
        console.error(`Proxy Error:`, error.message);
        // If the remote server gave us a response (like a 400 or 401), pass it to the frontend
        if (error.response) {
            res.status(error.response.status).json(error.response.data);
        } else {
            res.status(500).json({ error: "Proxy internal error" });
        }
    }
});

// 3. Whitelist Logic
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
        res.json({ success: true, message: response });
    } catch (error) {
        console.error("RCON Error:", error.message);
        res.status(500).json({ success: false, error: "Connection to Minecraft Server failed." });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Portal running on port ${PORT}`));