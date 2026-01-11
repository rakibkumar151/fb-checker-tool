const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();

// কনফিগারেশন
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// টোকেন জেনারেট ফাংশন
async function getAccessToken(clientId, refreshToken) {
    const params = new URLSearchParams();
    params.append('client_id', clientId);
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', refreshToken);

    try {
        const response = await axios.post('https://login.microsoftonline.com/common/oauth2/v2.0/token', params);
        return response.data.access_token;
    } catch (error) {
        return null; 
    }
}

// API 1: ইমেইল লিস্ট
// Vercel এ রাউট '/api/...' দিয়ে শুরু করতে হয়
app.post('/api/get-emails', async (req, res) => {
    const { client_id, refresh_token, skip } = req.body;
    const mailLimit = 5; 
    const skipCount = parseInt(skip) || 0; 

    if (!client_id || !refresh_token) return res.status(400).send({ error: 'Missing credentials' });

    try {
        const accessToken = await getAccessToken(client_id, refresh_token);
        if (!accessToken) return res.status(401).send({ error: 'Bad Token' });

        const mailResponse = await axios.get('https://graph.microsoft.com/v1.0/me/messages', {
            headers: { Authorization: `Bearer ${accessToken}` },
            params: {
                '$top': mailLimit, 
                '$skip': skipCount, 
                '$select': 'id,subject,from,receivedDateTime,bodyPreview,isRead', 
                '$orderby': 'receivedDateTime DESC'
            }
        });

        res.json({ emails: mailResponse.data.value });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

// API 2: ইমেইল ডিটেইলস
app.post('/api/get-email-details', async (req, res) => {
    const { client_id, refresh_token, message_id } = req.body;

    if (!client_id || !refresh_token || !message_id) {
        return res.status(400).send({ error: 'Missing data' });
    }

    try {
        const accessToken = await getAccessToken(client_id, refresh_token);
        if (!accessToken) return res.status(401).send({ error: 'Bad Token' });

        const mailResponse = await axios.get(`https://graph.microsoft.com/v1.0/me/messages/${message_id}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            params: { '$select': 'body,subject,from,receivedDateTime' }
        });

        res.json(mailResponse.data);
    } catch (error) {
        res.status(500).send({ error: 'Failed to fetch body' });
    }
});

// Vercel Export
module.exports = app;
