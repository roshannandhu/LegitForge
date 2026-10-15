import test from 'node:test';
import assert from 'node:assert/strict';
import { briefFrom, type RepoData } from '../lib/admin/github';

/** "Add from GitHub" writes the draft case study (lib/admin/github.ts briefFrom). A starter
 *  template's README describes the template, not the project: none of it may become the title,
 *  summary, stack or tags that the project page shows. */

const repo = (name: string, extra: Partial<RepoData['repo']> = {}): RepoData['repo'] => ({
  name, full_name: `owner/${name}`, description: null, homepage: null, topics: [], language: 'TypeScript',
  created_at: '2026-09-01T00:00:00Z', private: false, html_url: `https://github.com/owner/${name}`, ...extra,
});
const LANGS = { TypeScript: 9000, CSS: 800, JavaScript: 120 };

// create-next-app's README, as generated
const NEXT_README = `This is a [Next.js](https://nextjs.org) project bootstrapped with [\`create-next-app\`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

\`\`\`bash
npm run dev
# or
yarn dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying \`app/page.tsx\`. The page auto-updates as you edit the file.

This project uses [\`next/font\`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new) from the creators of Next.js.
`;

// Vite's React + TypeScript template README
const VITE_README = `# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:
`;

// Create React App's README
const CRA_README = `# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### \`npm start\`

Runs the app in the development mode.\\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.
`;

test('a create-next-app README gives no summary, no Vercel, no "Web app" from "API"', () => {
  const b = briefFrom({ repo: repo('bakery-site'), languages: LANGS, readme: NEXT_README });
  assert.equal(b.title, 'Bakery Site');
  assert.equal(b.summary, '');                                      // the owner writes it; no filler
  assert.equal(b.challenge, null);
  assert.deepEqual(b.stack, ['Next.js', 'TypeScript', 'CSS', 'JavaScript']);
  assert.deepEqual(b.tags, ['Website']);
  assert.equal(b.category, 'static');
});

test('a Vite template heading is not the title, and its lead-in line is not the summary', () => {
  const b = briefFrom({ repo: repo('clinic-landing'), languages: LANGS, readme: VITE_README });
  assert.equal(b.title, 'Clinic Landing');
  assert.equal(b.summary, '');
  assert.ok(b.stack.includes('React'));
  assert.ok(!b.tags.includes('Web app'));
});

test('a Create React App README gives neither its title nor its run instructions', () => {
  const b = briefFrom({ repo: repo('gym-site'), languages: LANGS, readme: CRA_README });
  assert.equal(b.title, 'Gym Site');
  assert.equal(b.summary, '');
  assert.equal(b.challenge, null);
});

test('English words are not tools: "next steps", "react to", "express delivery", a graph "node"', () => {
  const readme = `# Spice Route\n\nAn online menu for a restaurant that offers express delivery across Kochi, so customers react to the daily specials quickly.\n\n## Next steps\n\nEvery node on the delivery map is a pickup point.`;
  const b = briefFrom({ repo: repo('spice-route'), languages: { HTML: 500, CSS: 300 }, readme });
  assert.equal(b.title, 'Spice Route');
  assert.ok(b.summary.startsWith('An online menu for a restaurant'));
  for (const wrong of ['Next.js', 'React', 'Express', 'Node.js']) assert.ok(!b.stack.includes(wrong), `${wrong} invented`);
});

test('a WhatsApp chat link is not WhatsApp automation; a WhatsApp bot is', () => {
  const site = briefFrom({ repo: repo('bakery'), languages: LANGS, readme: `# Bakery\n\nA bakery website with the menu, opening hours and an order button that opens a chat with us on [WhatsApp](https://wa.me/910000000000).` });
  assert.ok(!site.tags.includes('WhatsApp'));
  assert.ok(!site.stack.includes('WhatsApp Cloud API'));
  const bot = briefFrom({ repo: repo('order-bot', { description: 'WhatsApp bot that takes bakery orders' }), languages: LANGS, readme: 'Uses the WhatsApp Cloud API through graph.facebook.com webhooks to reply to orders.' });
  assert.ok(bot.tags.includes('WhatsApp'));
  assert.ok(bot.stack.includes('WhatsApp Cloud API'));
  assert.equal(bot.category, 'whatsapp');
});

test('a real web app keeps its description, challenge, features, stack and the Web app tag', () => {
  const readme = `# Clinic Booking

## About

Clinics in Kochi lost bookings to missed calls at the front desk. Patients now pick a free slot online and get a reminder.

## Features

- Online booking with free slots
- Admin dashboard for the front desk
- SMS reminders the day before

## Getting Started

Run the development server with npm run dev.`;
  const b = briefFrom({
    repo: repo('clinic-booking', { description: 'Online booking for a clinic, with an admin dashboard.', topics: ['nextjs', 'supabase'], homepage: 'https://clinic-booking.vercel.app' }),
    languages: LANGS, readme,
  });
  assert.equal(b.summary, 'Online booking for a clinic, with an admin dashboard.');
  assert.ok(b.challenge?.startsWith('Clinics in Kochi lost bookings'));
  assert.deepEqual(b.built, ['Online booking with free slots', 'Admin dashboard for the front desk', 'SMS reminders the day before']);
  assert.deepEqual(b.stack.slice(0, 3), ['Next.js', 'Supabase', 'Vercel']);   // Vercel from where it runs
  assert.ok(b.tags.includes('Web app'));
  assert.equal(b.category, 'dynamic');
  assert.equal(b.liveUrl, 'https://clinic-booking.vercel.app');
});
