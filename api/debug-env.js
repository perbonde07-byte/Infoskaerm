export const config = { runtime: 'nodejs20' };

export default function handler(req, res) {
  const mask = s => s ? s.replace(/.(?=.{4})/g, '•') : '';
  res.status(200).json({
    message: "✅ Debug info — fjern denne fil når alt virker.",
    env: {
      OWNER: process.env.OWNER || null,
      REPO: process.env.REPO || null,
      BRANCH: process.env.BRANCH || null,
      FILEPATH: process.env.FILEPATH || null,
      MEDIA_DIR: process.env.MEDIA_DIR || null,
      GITHUB_TOKEN: mask(process.env.GITHUB_TOKEN || ''),
      ADMIN_PIN: mask(process.env.ADMIN_PIN || '')
    }
  });
}


