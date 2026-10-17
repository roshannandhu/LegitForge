import 'server-only';
import { adminDb } from './db';

/** Who the WhatsApp bot alerts first (D1 bot_team, migration 0013; read by bot/worker.ts route()). */
export interface BotMember { whatsapp: string; name: string; services: string; status: 'free' | 'busy' | 'off'; status_until: string | null }

export async function listBotTeam() {
  // a busy or off that has run out shows (and saves) as free, as the bot treats it
  return (await (await adminDb()).prepare(`SELECT whatsapp, name, services,
      CASE WHEN julianday(status_until) <= julianday('now') THEN 'free' ELSE status END AS status,
      CASE WHEN julianday(status_until) <= julianday('now') THEN NULL ELSE status_until END AS status_until
    FROM bot_team ORDER BY name, whatsapp`).all<BotMember>()).results;
}

/** Saved from Admin → Team. Setting a status here clears its end time (the bot's "busy 2h" sets one). */
export async function saveBotMember(v: { whatsapp: string; name: string; services: string[]; status: BotMember['status'] }) {
  await (await adminDb()).prepare(`INSERT INTO bot_team (whatsapp, name, services, status, status_until, updated_at) VALUES (?, ?, ?, ?, NULL, datetime('now'))
    ON CONFLICT(whatsapp) DO UPDATE SET name = excluded.name, services = excluded.services,
      status = excluded.status, status_until = CASE WHEN bot_team.status = excluded.status AND julianday(bot_team.status_until) > julianday('now')
        THEN bot_team.status_until END, updated_at = excluded.updated_at`)
    .bind(v.whatsapp, v.name, JSON.stringify(v.services), v.status).run();
}

export async function deleteBotMember(whatsapp: string) {
  await (await adminDb()).prepare('DELETE FROM bot_team WHERE whatsapp = ?').bind(whatsapp).run();
}
