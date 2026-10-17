'use server';

/** Admin → Team → WhatsApp alerts (lib/admin/bot-team.ts). Each action checks requireAdmin()
 *  itself: Server Actions are public POST endpoints. */

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/auth';
import { deleteBotMember, saveBotMember, type BotMember } from '@/lib/admin/bot-team';
import { SERVICES } from '@/lib/wa-services';
import type { FormState } from '../actions';

const STATUSES: BotMember['status'][] = ['free', 'busy', 'off'];

export async function saveBotMemberAction(_: FormState, f: FormData): Promise<FormState> {
  await requireAdmin();
  const whatsapp = String(f.get('whatsapp') ?? '').replace(/[\s+()-]/g, '');
  if (!/^\d{8,15}$/.test(whatsapp)) return { error: 'The WhatsApp number is digits with the country code, e.g. 919876543210.' };
  const keys = new Set<string>(SERVICES.map((s) => s.key));
  const services = f.getAll('services').map(String).filter((k) => keys.has(k));
  const status = String(f.get('status') ?? 'free') as BotMember['status'];
  await saveBotMember({ whatsapp, name: String(f.get('name') ?? '').trim().slice(0, 60), services, status: STATUSES.includes(status) ? status : 'free' });
  revalidatePath('/admin/team');
  return { ok: 'Saved. The bot uses it for the next alert.' };
}

export async function deleteBotMemberAction(whatsapp: string) {
  await requireAdmin();
  await deleteBotMember(whatsapp);
  revalidatePath('/admin/team');
}
