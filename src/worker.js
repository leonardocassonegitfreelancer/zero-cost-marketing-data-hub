import { SOURCES } from './sources.js';
import { isAuthorized } from './auth.js';
import { buildUpsertSql, toBindings, validateRows } from './ingest.js';

function reply(body, status) {
  const isText = typeof body === 'string';
  return new Response(isText ? body : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': isText ? 'text/plain' : 'application/json' },
  });
}

export async function handleIngest(request, env) {
  if (request.method !== 'POST') return reply('Method not allowed', 405);

  let body;
  try {
    body = await request.json();
  } catch {
    return reply('Invalid JSON', 400);
  }

  const source = Object.hasOwn(SOURCES, body?.source) ? SOURCES[body.source] : undefined;
  if (!source) return reply('Unknown source', 400);

  // Per-source write secrets: revoking one source's secret never touches
  // another's. Checked only once we know which source is being written.
  if (!isAuthorized(request.headers.get('Authorization'), env[source.secretEnv])) {
    return reply('Unauthorized', 401);
  }

  const result = validateRows(source, body.rows);
  if (!result.ok) return reply(result.error, 400);

  const statement = env.DB.prepare(buildUpsertSql(source));
  await env.DB.batch(result.rows.map((row) => statement.bind(...toBindings(source, row))));

  return reply({ ok: true, rows: result.rows.length }, 200);
}

export default {
  fetch(request, env) {
    return handleIngest(request, env);
  },
};
