export default async function handler(req, res) {
if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
try {
const token = process.env.GITHUB_TOKEN;
const owner = req.body?.owner || process.env.DATA_OWNER;
const repo = req.body?.repo || process.env.DATA_REPO;
const branch = req.body?.branch || process.env.DATA_BRANCH || 'main';
const path = req.body?.path || process.env.DATA_PATH || 'data.json';


const headers = { Authorization: `Bearer ${token}`, 'Content-Type':'application/json', 'User-Agent':'infoscreen' };
if (!token || !owner || !repo) return res.status(400).json({ error: 'Missing env vars or body: token/owner/repo' });


// 1) Læs nuværende SHA (hvis fil findes)
const getUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`;
let sha = undefined;
let current = null;
const getRes = await fetch(getUrl, { headers });
if (getRes.status === 200) {
const file = await getRes.json();
sha = file.sha; // optimistisk låsning
current = JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'));
}


// 2) Merge eller erstat (her erstatter vi bare med req.body.data)
const incoming = req.body?.data;
if (!incoming) return res.status(400).json({ error: 'Missing body.data' });


const content = Buffer.from(JSON.stringify(incoming, null, 2)).toString('base64');


// 3) PUT til GitHub Contents API
const putRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`, {
method: 'PUT',
headers,
body: JSON.stringify({
message: 'chore: update data.json via admin',
content,
}




