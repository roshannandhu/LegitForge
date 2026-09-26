/** GET /admin/leads/export — every lead as CSV (PLAN §7.8). Opens in Excel and Sheets: UTF-8
 *  with a BOM, every field quoted, and cells starting with = + - @ defused. */

import { adminIdentity } from '@/lib/admin/auth';
import { listLeads } from '@/lib/admin/db';

export const dynamic = 'force-dynamic';

const cell = (v: unknown) => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

export async function GET() {
  if (!(await adminIdentity())) return new Response('Forbidden', { status: 403 });
  const cols = ['created_at', 'status', 'source', 'name', 'phone', 'service', 'budget', 'message', 'whatsapp_consent', 'id'] as const;
  const rows = await listLeads();
  const body = '﻿' + [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\r\n');
  return new Response(body, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="legitforge-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
      'cache-control': 'no-store',
    },
  });
}
