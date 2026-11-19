/**
 * Host half of the session-delete bundle.
 *
 * The Client half owns the sidebar UI. This half owns the one operation the
 * page cannot perform itself: permanently deleting archived Session logs.
 *
 * `POST /plugins/session-delete/purge` accepts
 *   { "dryRun": true }  -> { count, bytes, items }
 *   { "apply": true }   -> deletes archived logs + projection caches, then
 *                          unarchives/detaches every removed Session.
 *
 * Request policy (the web server has no global auth): loopback Host, matching
 * Origin port, same-origin fetch metadata, JSON content type, and a private
 * header. The route never runs for cross-site form or script requests.
 */
import { copyFile, readFile, readdir, rm, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

export const inject = ['webServer', 'workspaceRegistry', 'sessions'];

const ROUTE = '/plugins/session-delete/purge';
const SESSION_ID = /^session-[A-Za-z0-9-]+$/;
const MAX_BODY_BYTES = 4096;

function isLoopback(hostname) {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  return host === '127.0.0.1' || host === 'localhost' || host === '::1';
}

function portOf(url) {
  if (url.port !== '') return url.port;
  return url.protocol === 'https:' ? '443' : '80';
}

function send(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(body);
}

function rejectReason(req, serverOrigin) {
  if (req.method !== 'POST') return 'method';
  const hostHeader = req.headers.host;
  if (typeof hostHeader !== 'string') return 'host';
  let host;
  try {
    host = new URL(`http://${hostHeader}`);
  } catch {
    return 'host';
  }
  if (!isLoopback(host.hostname) || portOf(host) !== portOf(serverOrigin)) return 'host';

  const originHeader = req.headers.origin;
  if (typeof originHeader !== 'string') return 'origin';
  let origin;
  try {
    origin = new URL(originHeader);
  } catch {
    return 'origin';
  }
  if (!isLoopback(origin.hostname) || portOf(origin) !== portOf(serverOrigin)) return 'origin';

  const site = req.headers['sec-fetch-site'];
  if (typeof site === 'string' && site !== 'same-origin') return 'site';
  const type = req.headers['content-type'];
  if (typeof type !== 'string' || type.split(';')[0].trim().toLowerCase() !== 'application/json') return 'type';
  if (req.headers['x-dsh-session-delete'] !== 'purge') return 'header';
  return null;
}

function dshHome() {
  return process.env.DSH_HOME || path.join(homedir(), '.dsh');
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error('request too large');
    chunks.push(chunk);
  }
  if (size === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function readArchivedIds(home) {
  const file = path.join(home, 'storages', 'workspace.json');
  const data = JSON.parse(await readFile(file, 'utf8'));
  const ids = data?.global?.archivedSessionIds;
  if (!Array.isArray(ids)) return [];
  return ids.filter((id) => typeof id === 'string' && SESSION_ID.test(id));
}

async function readTitle(home, id) {
  try {
    const cache = path.join(home, 'storages', 'session_projcache', 'sessions', `${id}.json`);
    const data = JSON.parse(await readFile(cache, 'utf8'));
    const title = data?.record?.rows?.title?.val;
    return typeof title === 'string' ? title : '';
  } catch {
    return '';
  }
}

async function dirSize(dir) {
  let total = 0;
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) total += await dirSize(full);
    else if (entry.isFile()) {
      try {
        total += (await stat(full)).size;
      } catch {
        /* a vanished file contributes nothing */
      }
    }
  }
  return total;
}

async function findSessionDirs(home, ids) {
  const root = path.join(home, 'sessions');
  const map = new Map();
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return map;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    for (const id of ids) {
      const dir = path.join(root, entry.name, id);
      try {
        if ((await stat(dir)).isDirectory()) map.set(id, dir);
      } catch {
        /* not in this workspace directory */
      }
    }
  }
  return map;
}

function inside(root, target) {
  const relative = path.relative(root, target);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

async function buildPlan(ctx, home) {
  const archived = await readArchivedIds(home);
  const live = new Set(ctx.sessions.list().map((session) => session.id));
  const agents = ctx.get('agents');
  if (agents !== undefined) {
    for (const agent of agents.list()) live.add(agent.id);
  }
  const dirs = await findSessionDirs(home, archived);
  const items = [];
  const skipped = [];
  for (const id of archived) {
    if (live.has(id)) {
      skipped.push({ id, reason: 'live' });
      continue;
    }
    const dir = dirs.get(id);
    items.push({
      id,
      title: await readTitle(home, id),
      bytes: dir === undefined ? 0 : await dirSize(dir),
      present: dir !== undefined,
    });
  }
  const bytes = items.reduce((total, item) => total + item.bytes, 0);
  return { items, skipped, count: items.length, bytes };
}

async function cleanRegistry(ctx, id) {
  try {
    await ctx.workspaceRegistry.unarchiveSession(id);
  } catch {
    /* the archive record is harmless when the log is gone */
  }
  try {
    const owner = ctx.workspaceRegistry.list().find((workspace) => workspace.sessionIds.includes(id));
    if (owner !== undefined) await owner.detachSession(id);
  } catch {
    /* membership is filtered by the header index once the log is gone */
  }
}

async function purge(ctx, home) {
  const plan = await buildPlan(ctx, home);
  const sessionsRoot = path.join(home, 'sessions');
  const cacheRoot = path.join(home, 'storages', 'session_projcache', 'sessions');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const workspaceFile = path.join(home, 'storages', 'workspace.json');
  try {
    await copyFile(workspaceFile, `${workspaceFile}.bak-purge-${stamp}`);
  } catch {
    /* a backup is best effort; deletion stays explicit below */
  }

  const deleted = [];
  const failed = [];
  let freedBytes = 0;

  for (const item of plan.items) {
    const cache = path.join(cacheRoot, `${item.id}.json`);
    if (!item.present) {
      // No log: clean the dangling archive record and its cache without files.
      if (inside(cacheRoot, cache)) await rm(cache, { force: true }).catch(() => {});
      await cleanRegistry(ctx, item.id);
      continue;
    }
    const dir = (await findSessionDirs(home, [item.id])).get(item.id);
    if (dir === undefined || !inside(sessionsRoot, dir) || path.basename(dir) !== item.id) {
      failed.push({ id: item.id, message: 'session path failed validation' });
      continue;
    }
    try {
      await rm(dir, { recursive: true, force: true, maxRetries: 2 });
      if (inside(cacheRoot, cache)) {
        await rm(cache, { force: true }).catch(() => {});
      }
      freedBytes += item.bytes;
      deleted.push({ id: item.id, title: item.title, bytes: item.bytes });
      await cleanRegistry(ctx, item.id);
    } catch (error) {
      failed.push({ id: item.id, message: error instanceof Error ? error.message : String(error) });
    }
  }

  return { deleted, failed, freedBytes };
}

export function apply(ctx) {
  const home = dshHome();

  const handler = async (req, res) => {
    try {
      const serverOrigin = new URL(ctx.webServer.getOrigin());
      const reason = rejectReason(req, serverOrigin);
      if (reason !== null) {
        send(res, 403, { error: `forbidden (${reason})` });
        return;
      }
      const body = await readBody(req);
      if (body.dryRun === true) {
        send(res, 200, await buildPlan(ctx, home));
        return;
      }
      if (body.apply === true) {
        send(res, 200, { ok: true, ...(await purge(ctx, home)) });
        return;
      }
      send(res, 400, { error: 'expected {"dryRun":true} or {"apply":true}' });
    } catch (error) {
      console.warn('session-delete purge failed:', error);
      send(res, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  };

  ctx.effect(
    () => ctx.webServer.register({ kind: 'exact', path: ROUTE, handler }),
    'session-delete: purge route',
  );
}
