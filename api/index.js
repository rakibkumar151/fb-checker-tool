import fetch from 'node-fetch';
import https from 'https';

// Keep-Alive Agent to reuse TCP connections (Super Fast)
const agent = new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 1000,
    maxSockets: 1000
});

export default async function handler(req, res) {
    // CORS Setup for Vercel
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { uids } = req.body;
    if (!uids || !Array.isArray(uids)) return res.status(400).json({ error: 'No UIDs' });

    // The Checker Logic
    const checkUID = async (uid) => {
        try {
            // Timeout set to 3 seconds to skip slow requests quickly
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);

            const response = await fetch(`https://graph.facebook.com/${uid}/picture?type=normal`, {
                method: 'GET',
                redirect: 'manual',
                agent: agent, // Using Keep-Alive Agent
                signal: controller.signal,
                headers: { "User-Agent": "Mozilla/5.0" }
            });

            clearTimeout(timeout);

            const location = response.headers.get('location') || "";
            
            // Logic: 302 Redirect + location containing "scontent" means LIVE
            if (response.status === 302 && location.includes("scontent")) {
                return { uid, status: "live" };
            }
            return { uid, status: "dead" };
        } catch (error) {
            return { uid, status: "dead" }; // Network error treated as dead to keep speed up
        }
    };

    // Run all checks in parallel
    const results = await Promise.all(uids.map(uid => checkUID(uid)));
    
    return res.status(200).json(results);
}
