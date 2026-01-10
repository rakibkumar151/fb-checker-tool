import fetch from 'node-fetch';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    const { uids } = req.body;
    if (!uids || !Array.isArray(uids)) return res.status(400).json({ error: 'No UIDs' });

    const checkUID = async (uid) => {
        try {
            const response = await fetch(`https://graph.facebook.com/${uid}/picture?type=normal`, {
                method: 'GET',
                redirect: 'manual',
                headers: { "User-Agent": "Mozilla/5.0" }
            });
            const location = response.headers.get('location') || "";
            if (response.status === 302 && location.includes("scontent")) {
                return { uid, status: "live" };
            }
            return { uid, status: "dead" };
        } catch { return { uid, status: "dead" }; }
    };

    const results = await Promise.all(uids.map(uid => checkUID(uid)));
    if (res.status) res.status(200).json(results);
    else return results;
}