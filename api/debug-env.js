export const config = { runtime: 'nodejs' };


// === DEBUG ENV VARS (MIDLERITIDIG FIL) ===
// Denne fil bruges kun til at tjekke hvilke miljøvariabler (ENV vars) der faktisk er tilgængelige.
// Når alt virker, kan du roligt slette HELE denne fil fra /api-mappen igen.

export default function handler(req, res) {
  const envs = ['OWNER', 'REPO', 'BRANCH', 'FILEPATH', 'MEDIA_DIR', 'GITHUB_TOKEN'];
  const result = {};

  for (const key of envs) {
    // Vi viser kun om token eksisterer, ikke selve værdien
    result[key] = process.env[key]
      ? key === 'GITHUB_TOKEN'
        ? '*** (token fundet)'
        : process.env[key]
      : null;
  }

  res.status(200).json({
    message: "✅ Debug info — fjern denne fil når alt virker.",
    env: result,
  });
}
// === SLUT PÅ DEBUG ===
