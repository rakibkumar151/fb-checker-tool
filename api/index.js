import fetch from 'node-fetch';
import https from 'https';

// Keep-Alive এজেন্ট তৈরি করা (স্পিড বাড়ানোর জন্য)
const agent = new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 10000,
    maxSockets: Infinity
});

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    
    const { uids } = req.body;
    if (!uids || !Array.isArray(uids)) return res.status(400).json({ error: 'No UIDs' });

    const checkUID = async (uid) => {
        try {
            const response = await fetch(`https://graph.facebook.com/${uid}/picture?type=normal`, {
                method: 'GET',
                redirect: 'manual',
                headers: { "User-Agent": "Mozilla/5.0" },
                agent: agent, // এজেন্ট ব্যবহার করা হচ্ছে
                timeout: 3000 // ৩ সেকেন্ডের বেশি সময় লাগলে বাদ
            });
            
            const location = response.headers.get('location') || "";
            if (response.status === 302 && location.includes("scontent")) {
                return { uid, status: "live" };
            }
            return { uid, status: "dead" };
        } catch { return { uid, status: "dead" }; }
    };

    // সব রিকোয়েস্ট প্যারালালি রান হবে
    const results = await Promise.all(uids.map(uid => checkUID(uid)));
    return res.status(200).json(results);
}
