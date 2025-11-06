// /api/debug-env.js
export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  res.status(200).json({
    message: "✅ Debug info — fjern denne fil når alt virker.",
    env: {
      OWNER: process.env.OWNER ?? null,
      REPO: process.env.REPO ?? null,
      BRANCH: process.env.BRANCH ?? null,
      FILEPATH: process.env.FILEPATH ?? null,
      MEDIA_DIR: process.env.MEDIA_DIR ?? null,
      GITHUB_TOKEN: process.env.GITHUB_TOKEN ? "*** (token fundet)" : null
    }
  });
}

