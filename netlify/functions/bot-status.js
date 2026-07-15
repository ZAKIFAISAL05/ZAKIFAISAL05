const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json',
};

const ADMIN_PASS_HASH = process.env.ADMIN_TICKET_KEY || '821bc6e7ed5ec0007c1d7b88e8ffdd428df9ae1444325fd5c97a372773b31df4';

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyAdmin(adminToken) {
  if (!adminToken) return false;
  try {
    const hash = await sha256(adminToken);
    return hash === ADMIN_PASS_HASH;
  } catch {
    return false;
  }
}

function getBotBackendConfig() {
  const backendUrl = String(
    process.env.BOT_BACKEND_URL ||
    process.env.TG_BOT_BACKEND_URL ||
    process.env.WA_BOT_BACKEND_URL ||
    process.env.BOT_SERVER_URL ||
    ''
  ).trim().replace(/\/$/, '');
  const apiKey = String(
    process.env.BOT_API_KEY ||
    process.env.TG_BOT_API_KEY ||
    process.env.WA_BOT_API_KEY ||
    ''
  ).trim();

  let source = 'shared';
  if (!process.env.BOT_BACKEND_URL && process.env.TG_BOT_BACKEND_URL) source = 'telegram-alias';
  else if (!process.env.BOT_BACKEND_URL && process.env.WA_BOT_BACKEND_URL) source = 'whatsapp-alias';

  return { backendUrl, apiKey, source };
}

function getSafeOrigin(url) {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: CORS,
      body: JSON.stringify({ error: 'Method tidak diizinkan' }),
    };
  }

  const q = event.queryStringParameters || {};
  if (!(await verifyAdmin(q.adminToken))) {
    return {
      statusCode: 403,
      headers: CORS,
      body: JSON.stringify({ error: 'Akses ditolak' }),
    };
  }

  const { backendUrl, apiKey, source } = getBotBackendConfig();
  if (!backendUrl || !apiKey) {
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        ok: true,
        configured: false,
        reachable: false,
        connected: false,
        backendOrigin: getSafeOrigin(backendUrl),
        source,
        message: 'BOT_BACKEND_URL / BOT_API_KEY belum diisi di env Netlify.',
      }),
    };
  }

  try {
    const response = await fetch(`${backendUrl}/bot-status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify({
          ok: true,
          configured: true,
          reachable: false,
          connected: false,
          backendOrigin: getSafeOrigin(backendUrl),
          source,
          message: data?.msg || data?.error || `HTTP ${response.status}`,
        }),
      };
    }

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        ok: true,
        configured: true,
        reachable: true,
        connected: !!data?.isConnected,
        backendOrigin: getSafeOrigin(backendUrl),
        source,
        channel: data?.channel || '',
        platform: data?.platform || '',
        botNumber: data?.botNumber || '',
        uptime: typeof data?.uptime === 'number' ? data.uptime : null,
        telegramGroupConfigured: !!data?.telegramGroupConfigured,
        telegramAdminCount: typeof data?.telegramAdminCount === 'number' ? data.telegramAdminCount : 0,
        message: data?.isConnected
          ? 'Backend bot aktif dan terhubung.'
          : (data?.msg || 'Backend bot aktif, tapi channel bot sedang offline.'),
      }),
    };
  } catch (e) {
    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        ok: true,
        configured: true,
        reachable: false,
        connected: false,
        backendOrigin: getSafeOrigin(backendUrl),
        source,
        message: e.message || 'Gagal menghubungi backend bot.',
      }),
    };
  }
};
