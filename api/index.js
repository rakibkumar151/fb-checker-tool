const express = require('express');
const axios = require('axios');
const cors = require('cors');
const https = require('https');

const app = express();

// কনফিগারেশন
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Facebook এর জন্য ফাস্ট এজেন্ট (Speed Optimization)
const fbAgent = new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 1000,
    maxSockets: 1000
});

// =========================================================
// PART 1: OUTLOOK MAIL CHECKER API
// =========================================================

// টোকেন জেনারেট ফাংশন (Outlook)
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

// Outlook: ইমেইল লিস্ট
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

// Outlook: ইমেইল ডিটেইলস
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


// =========================================================
// PART 2: FACEBOOK FAST CHECKER API
// =========================================================

app.post('/api/fb-check', async (req, res) => {
    const { uids } = req.body;
    if (!uids || !Array.isArray(uids)) return res.status(400).json({ error: 'No UIDs' });

    const checkUID = async (uid) => {
        try {
            // Axios Request (with Redirect disabled to check headers)
            const response = await axios.get(`https://graph.facebook.com/${uid}/picture?type=normal`, {
                maxRedirects: 0, // রিডাইরেক্ট বন্ধ রাখা হচ্ছে যাতে 302 ধরা যায়
                validateStatus: status => status >= 200 && status < 400, // 302 কে এরর হিসেবে না ধরা
                httpsAgent: fbAgent,
                headers: { "User-Agent": "Mozilla/5.0" }
            });

            const location = response.headers.location || "";
            
            // যদি Location এ "scontent" থাকে, তার মানে লাইভ
            if (response.status === 302 && location.includes("scontent")) {
                return { uid, status: "live" };
            }
            return { uid, status: "dead" };
        } catch (error) {
            return { uid, status: "dead" };
        }
    };

    // প্যারালাল চেকিং (Parallel Execution)
    const results = await Promise.all(uids.map(uid => checkUID(uid)));
    
    return res.status(200).json(results);
});


// Vercel Export
module.exports = app;
