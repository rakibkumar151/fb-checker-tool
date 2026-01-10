import fetch from 'node-fetch';
import https from 'https';

// Keep-Alive Agent for Fast Connection on Vercel
const agent = new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 1000,
    maxSockets: 1000
});

export default async function handler(req, res) {
    // CORS Setup
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { uids } = req.body;
    if (!uids || !Array.isArray(uids)) return res.status(400).json({ error: 'No UIDs' });

    const checkUID = async (uid) => {
        try {
            // 2.5 seconds timeout per request to prevent Vercel freeze
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 2500);

            const response = await fetch(`https://graph.facebook.com/${uid}/picture?type=normal`, {
                method: 'GET',
                redirect: 'manual',
                agent: agent,
                signal: controller.signal,
                headers: { "User-Agent": "Mozilla/5.0" }
            });

            clearTimeout(timeout);

            const location = response.headers.get('location') || "";
            
            if (response.status === 302 && location.includes("scontent")) {
                return { uid, status: "live" };
            }
            return { uid, status: "dead" };
        } catch (error) {
            return { uid, status: "dead" };
        }
    };

    // Run parallel checks
    const results = await Promise.all(uids.map(uid => checkUID(uid)));
    
    return res.status(200).json(results);
}
