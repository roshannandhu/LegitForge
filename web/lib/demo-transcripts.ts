/** What each working-flow demo shows, step by step (SEO plan B: hidden text only). The demos
 *  are aria-hidden pictures; this is their text: read aloud by screen readers and read by
 *  search engines, never shown. Keep each step true to components/sections/demos.ts. */

import type { DemoId } from '@/components/sections/demos';

export const DEMO_TRANSCRIPTS: Record<DemoId, { title: string; steps: string[] }> = {
  website: {
    title: 'How a fast static website works, and when it turns dynamic',
    steps: [
      'A plain wireframe becomes the finished, styled business website.',
      'A visitor taps the call-to-action button.',
      'The page speed score reaches 99 out of 100: the site loads in about a second on a phone.',
      'The site turns dynamic: a live badge changes from “3 tables free” to “2 tables free” on its own, with nobody editing the page.',
    ],
  },
  app: {
    title: 'How a web app dashboard shows a business at a glance',
    steps: [
      'A sales chart draws itself for the week.',
      'The totals count up: 128 bookings, ₹4.2 lakh revenue and 61 % repeat customers.',
      'A new booking, a table for 4 at 7:30 pm, arrives in the list.',
      'A notification says it came in from WhatsApp, with no one typing it in.',
    ],
  },
  whatsapp: {
    title: 'How a WhatsApp bot answers a customer and takes an order',
    steps: [
      'A customer asks on WhatsApp: “Do you deliver near the station?”',
      'The bot replies in seconds: delivery near the station is free on orders over 500.',
      'It offers three buttons: Order now, See menu, and Talk to a person.',
      'The customer taps Order now, and the bot confirms the order will arrive by 7:40 pm. The message ticks turn blue.',
    ],
  },
  n8n: {
    title: 'How an n8n automation moves one enquiry through five steps without copy-paste',
    steps: [
      'A customer fills in the website form: a new entry.',
      'n8n saves it to a Google Sheet as row 214.',
      'An AI step reads the message and tags the intent as an order.',
      'A WhatsApp reply goes to the customer automatically.',
      'The team gets an alert, so a person follows up.',
    ],
  },
  seo: {
    title: 'How local SEO brings a business to the top of Google',
    steps: [
      'Someone nearby searches Google for “ac installation kochi”.',
      'The results load, and CoolAir climbs from third place to the top result, with 4.9 stars from 212 reviews.',
      'The clicks from Google this week count up to 148, and the calls from Google to 23.',
    ],
  },
  nfc: {
    title: 'How an NFC card or tag works with one tap',
    steps: [
      'A customer holds their phone near an NFC card or sticker.',
      'The chip is read at once, with no app needed.',
      'The phone opens the business’s page: here, a Google review form with five stars, ready to post.',
      'The same tap can save a contact, open a menu, or show a product’s warranty, and the page can be changed without reprinting.',
    ],
  },
  quote: {
    title: 'How a quotation and warranty system works for an AC installation',
    steps: [
      'Quote Q-2041 is built line by line: a 1.5 ton split AC for ₹38,500, installation and copper kit for ₹4,200, and a stabiliser for ₹3,100.',
      'The total, ₹45,800, is sent to the customer as a link.',
      'The customer opens it twice and accepts it on 14 September.',
      'After installation the customer scans the warranty code: serial LF-AC-88213 is valid for parts and labour until 14 September 2027.',
      'A reminder is set on WhatsApp before the warranty expires, and claims can be made on WhatsApp.',
    ],
  },
};
