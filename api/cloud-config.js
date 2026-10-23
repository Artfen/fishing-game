// Vercel serverless function: tells the game where the optional cloud save backend is.
// Set SUPABASE_URL and SUPABASE_ANON_KEY (the public anon / publishable key) in the Vercel
// project's environment variables. With neither set, the game stays guest-only.
//
// This only ever returns the public anon key, which is designed to be used in browsers:
// row level security on the saves table is what keeps each player's save private. It
// refuses to hand out a service_role or secret key, should one be put here by mistake.

function isPrivileged(key) {
  if (key.startsWith('sb_secret_')) return true;
  const parts = key.split('.');
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    return payload.role === 'service_role';
  } catch {
    return false;
  }
}

export default function handler(req, res) {
  const url = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const anonKey = (process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '').trim();
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.setHeader('Content-Type', 'application/json');
  if (!url || !anonKey || !/^https:\/\//.test(url)) {
    res.status(200).send(JSON.stringify({ enabled: false }));
    return;
  }
  if (isPrivileged(anonKey)) {
    res.status(200).send(JSON.stringify({ enabled: false, error: 'SUPABASE_ANON_KEY holds a privileged key. Use the anon / publishable key.' }));
    return;
  }
  res.status(200).send(JSON.stringify({ enabled: true, url, anonKey }));
}
