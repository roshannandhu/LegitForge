import type { IconType } from 'react-icons';
import {
  SiCloudflare, SiFigma, SiGithub, SiGoogle, SiGsap, SiMeta, SiNextdotjs, SiPostgresql, SiRazorpay,
  SiReact, SiRender, SiSupabase, SiTailwindcss, SiTypescript, SiVercel, SiWhatsapp,
} from 'react-icons/si';
import type { Logo } from './tools-strip';

/** The stack we ship with, for the tools strip. A Server Component: the icons are rendered here to
 *  plain SVG, so react-icons adds nothing to the browser bundle. The brand colour shows on hover
 *  (the brands' own colours, like the Google G). */
const TOOLS: [string, IconType | null, string][] = [
  ['Next.js', SiNextdotjs, 'currentColor'], ['React', SiReact, '#61DAFB'], ['TypeScript', SiTypescript, '#3178C6'],
  ['Tailwind CSS', SiTailwindcss, '#06B6D4'], ['GSAP', SiGsap, '#0AE448'], ['GitHub', SiGithub, 'currentColor'],
  ['Cloudflare', SiCloudflare, '#F38020'], ['Vercel', SiVercel, 'currentColor'], ['Render', SiRender, 'currentColor'],
  ['Supabase', SiSupabase, '#3ECF8E'], ['PostgreSQL', SiPostgresql, '#4169E1'], ['n8n', null, '#EA4B71'],
  ['Meta', SiMeta, '#0081FB'], ['WhatsApp', SiWhatsapp, '#25D366'], ['Google', SiGoogle, '#4285F4'],
  ['Razorpay', SiRazorpay, '#3395FF'], ['Figma', SiFigma, '#F24E1E'],
];

export const TOOL_LOGOS: Logo[] = TOOLS.map(([title, Icon, color]) => ({
  title,
  node: (
    <span className="tool" style={{ '--brand': color } as React.CSSProperties}>
      {Icon ? <Icon aria-hidden="true" /> : <b className="tool-n8n" aria-hidden="true">n8n</b>}
      <span className="tool-name">{title}</span>
    </span>
  ),
}));
