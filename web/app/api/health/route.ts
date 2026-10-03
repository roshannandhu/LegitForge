/** Build identity only: no bindings, credentials, customer data or infrastructure details. */
export const dynamic = 'force-dynamic';
export function GET() {
  return Response.json({ ok: true, revision: process.env.BUILD_REVISION || 'unknown' }, {
    headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' },
  });
}
