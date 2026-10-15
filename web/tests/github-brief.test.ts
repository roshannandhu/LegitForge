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

/* ---------------------------------------------- the review's findings (each failed before its fix) */

const ASTRO_README = `# Astro Starter Kit: Basics

\`\`\`sh
npm create astro@latest -- --template basics
\`\`\`

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

To learn more about the folder structure of an Astro project, refer to [our guide on project structure](https://docs.astro.build/en/basics/project-structure/).

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).
`;
const NUXT_README = `# Nuxt Minimal Starter

Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Make sure to install dependencies:

## Production

Build the application for production:

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.
`;
const ANGULAR_README = `# CoolairQuotes

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 19.2.0.

## Development server

To start a local development server, run:

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
`;
const SVELTEKIT_README = `# sv

Everything you need to build a Svelte project, powered by [\`sv\`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!
`;
const LARAVEL_README = `<p align="center"><a href="https://laravel.com" target="_blank"><img src="https://raw.githubusercontent.com/laravel/art/master/logo-lockup/5%20SVG/2%20CMYK/1%20Full%20Color/laravel-logolockup-cmyk-red.svg" width="400" alt="Laravel Logo"></a></p>

## About Laravel

Laravel is a web application framework with expressive, elegant syntax. We believe development must be an enjoyable and creative experience to be truly fulfilling. Laravel takes the pain out of development by easing common tasks used in many web projects, such as:

- [Simple, fast routing engine](https://laravel.com/docs/routing).

Laravel is accessible, powerful, and provides tools required for large, robust applications.
`;

test('Astro, Nuxt, Angular, SvelteKit and Laravel starters give no summary and no starter title', () => {
  for (const [name, readme] of [['astro-site', ASTRO_README], ['nuxt-site', NUXT_README], ['coolair-quotes', ANGULAR_README], ['svelte-site', SVELTEKIT_README], ['laravel-site', LARAVEL_README]] as const) {
    const b = briefFrom({ repo: repo(name), languages: LANGS, readme });
    assert.equal(b.summary, '', `${name}: summary from the starter's README: ${b.summary}`);
    assert.equal(b.challenge, null, `${name}: challenge from the starter's README`);
    assert.ok(!/starter|^sv$/i.test(b.title), `${name}: title ${b.title}`);
  }
});

test('business names that contain how-to words keep their intro and challenge', () => {
  const intro = (biz: string) => `# ${biz}\n\nThe website for ${biz} in Kochi: services, past projects, and a form that books a site visit.\n\n## About the builders\n\nFamily-run since 1998, they lost leads because their only listing was a phone number in an old directory.`;
  for (const biz of ['Skyline Builders & Developers', 'CoolAir AC Installation & Service', 'Sparkline Licensed Electricians', 'Kochi Running Club']) {
    const b = briefFrom({ repo: repo('client-site'), languages: LANGS, readme: intro(biz) });
    assert.equal(b.title, biz);
    assert.ok(b.summary.startsWith(`The website for ${biz}`), `${biz}: summary "${b.summary}"`);
    assert.ok(b.challenge?.startsWith('Family-run since 1998'), `${biz}: challenge ${b.challenge}`);
  }
});

test('"+" in a real name stays; a stack in brackets leaves the title; a stack joined by "+" is a template', () => {
  const brew = briefFrom({ repo: repo('brew-and-bake'), languages: LANGS, readme: '# Brew + Bake\n\nA website for Brew + Bake, a café and bakery in Fort Kochi, with the menu, opening hours and table booking.' });
  assert.equal(brew.title, 'Brew + Bake');
  assert.ok(brew.summary.startsWith('A website for Brew + Bake'));
  const crumbs = briefFrom({ repo: repo('crumbs'), languages: LANGS, readme: '# Sweet Crumbs Bakery (Next.js + Tailwind)\n\nOnline orders and a cake gallery for a family bakery in Kochi, with pickup slots.' });
  assert.equal(crumbs.title, 'Sweet Crumbs Bakery');
  assert.ok(crumbs.summary.startsWith('Online orders and a cake gallery'));
  const vue = briefFrom({ repo: repo('gym-site'), languages: LANGS, readme: '# Vue 3 + TypeScript + Vite\n\nThis template should help get you started developing with Vue 3 and TypeScript in Vite.' });
  assert.equal(vue.title, 'Gym Site');
  assert.equal(vue.summary, '');
});

test('one template sentence does not cost the paragraph its real sentences', () => {
  const b = briefFrom({ repo: repo('sweet-crumbs'), languages: LANGS, readme: '# Sweet Crumbs\n\nThe website for Sweet Crumbs, a bakery in Kochi: menu, cake gallery and online orders. Bootstrapped with create-next-app and deployed on Vercel.' });
  assert.equal(b.summary, 'The website for Sweet Crumbs, a bakery in Kochi: menu, cake gallery and online orders.');
  const bookly = briefFrom({ repo: repo('bookly'), languages: LANGS, readme: '# Bookly\n\nAn appointment booking widget that salons in Kochi can add to their existing website with minimal setup.' });
  assert.ok(bookly.summary.startsWith('An appointment booking widget'));
});

test('a long About paragraph is the lead once: the challenge is only what follows it', () => {
  const para = 'Sweet Crumbs is the ordering site for a family bakery in Kochi that used to take every cake order by phone and lose half of them. ' +
    'Customers now pick a cake, a size and a pickup slot online, and the bakery sees every order on one screen the night before. ' +
    'Weekend rushes no longer mean missed calls, and the owners finally know how many cakes to bake.';
  assert.ok(para.length > 300);
  const b = briefFrom({ repo: repo('sweet-crumbs'), languages: LANGS, readme: `# Sweet Crumbs\n\n## About\n\n${para}` });
  assert.ok(para.startsWith(b.summary));
  assert.ok(b.challenge && !b.challenge.startsWith(b.summary.slice(0, 40)), `challenge repeats the lead: ${b.challenge}`);
  assert.ok(b.challenge?.startsWith('Weekend rushes'), `challenge: ${b.challenge}`);
  const described = briefFrom({ repo: repo('sweet-crumbs', { description: para.split('. ')[0] + '.' }), languages: LANGS, readme: `# Sweet Crumbs\n\n## About\n\n${para}` });
  assert.ok(described.challenge?.startsWith('Customers now pick a cake'), `challenge: ${described.challenge}`);
});

test('a quote builder keeps its Quote tag; Graph API posts and Firebase Hosting add nothing; a WhatsApp order button is not a bot', () => {
  const quotes = briefFrom({ repo: repo('coolair-quotes', { description: 'Quote builder for an AC dealer: line items, PDF quotes, acceptance tracking.' }), languages: LANGS, readme: '# CoolAir Quote Builder\n\nLine items, PDF output and a link the customer accepts.' });
  assert.ok(quotes.tags.includes('Quote'));
  const posts = briefFrom({ repo: repo('spice-route'), languages: LANGS, readme: '# Spice Route\n\nA restaurant website. A nightly job calls https://graph.facebook.com/v19.0/1234567890/posts to show the latest Facebook posts on the home page.' });
  assert.ok(!posts.stack.includes('WhatsApp Cloud API'));
  const bot = briefFrom({ repo: repo('wa-orders'), languages: LANGS, readme: 'Replies are sent with POST https://graph.facebook.com/v19.0/1099887766/messages for each new order.' });
  assert.ok(bot.stack.includes('WhatsApp Cloud API'));
  const hosted = briefFrom({ repo: repo('bakery'), languages: LANGS, readme: '# Bakery\n\nA bakery website with the menu, opening hours and a cake gallery for Fort Kochi customers.\n\n## Deploy\n\nHosted on Firebase Hosting: run firebase deploy.' });
  assert.ok(!hosted.tags.includes('Web app'));
  assert.equal(hosted.category, 'static');
  assert.ok(hosted.stack.includes('Firebase'));                                  // still named in the stack
  const ordering = briefFrom({ repo: repo('sweet-crumbs', { description: 'Bakery website with menu, gallery and WhatsApp ordering' }), languages: LANGS, readme: '' });
  assert.ok(!ordering.tags.includes('WhatsApp'));
  assert.notEqual(ordering.category, 'whatsapp');
});

test('a business called Belle Vue or Astro is not the Vue or Astro framework', () => {
  const b = briefFrom({ repo: repo('belle-vue-resort'), languages: { HTML: 500, CSS: 300 }, readme: '# Belle Vue Resort\n\nA website for Belle Vue Resort in Munnar, with rooms, rates and a booking enquiry form. Astro Tours runs their treks.' });
  assert.ok(!b.stack.includes('Vue') && !b.stack.includes('Astro'), b.stack.join(', '));
  const real = briefFrom({ repo: repo('clinic'), languages: LANGS, readme: '# Clinic\n\nBuilt with Vue 3 and Pinia; pages live in src/views/Home.vue. The blog is an Astro 4 site (astro.config.mjs).' });
  assert.ok(real.stack.includes('Vue') && real.stack.includes('Astro'), real.stack.join(', '));
});
