/** Accessible descriptions of the illustrative demonstrations.
 *  Every name, figure and event is sample data, not recorded client performance.
 *  Keep these descriptions aligned with the visible examples and demo timelines. */

import type { DemoId } from '@/components/sections/demos';

export const DEMO_TRANSCRIPTS: Record<DemoId, { title: string; steps: string[] }> = {
  signage: {
    title: 'Illustrative example: scheduling content with MR Signage',
    steps: [
      'This is a simulated playlist and screen setup, not a live connection to customer screens.',
      'The sample dashboard shows a breakfast menu from 7 to 11 am, an evening offer from 6 to 10 pm, and new arrivals all day.',
      'An item is selected and the illustration publishes it to three screens.',
      'The sample TV changes between a breakfast menu, an evening offer and new arrivals.',
      'A TV in Calicut, a tablet in Kochi and a TV in Bangalore show the sample status “3 screens online, synced”. A progress bar illustrates playlist playback.',
      'Real offline playback uses content already downloaded to compatible devices; new content and remote status need connectivity.',
    ],
  },
  website: {
    title: 'Illustrative example: a business website with changing content',
    steps: [
      'This is a sample website interface. The score and availability values are illustrative, not measured performance or live bookings.',
      'A plain wireframe becomes a styled business website, and a sample visitor taps its contact button.',
      'A sample score of 99 out of 100 appears. It does not state a loading time or guarantee a score for your project.',
      'The example changes to editable content: a sample badge changes from “3 tables free” to “2 tables free”.',
      'The badge cycles through example availability states. A real availability feature needs the agreed data source and integration.',
    ],
  },
  app: {
    title: 'Illustrative example: a bookings dashboard',
    steps: [
      'This dashboard uses fictional bookings and figures, not client results or a live account.',
      'A sample chart draws and totals show 128 bookings, ₹4.2 lakh revenue and 61 percent repeat customers.',
      'A sample table booking for four at 7:30 pm appears in the list, with a notification labelled “Booking from WhatsApp”.',
      'The illustration cycles through website, walk-in, WhatsApp and Google booking labels and updates its sample total.',
      'Real bookings, permissions and connected channels are agreed and tested as part of the app scope.',
    ],
  },
  whatsapp: {
    title: 'Illustrative example: a WhatsApp enquiry and order flow',
    steps: [
      'This is a scripted conversation. It sends no WhatsApp messages and does not measure response times.',
      'A sample customer asks, “Do you deliver near the station?” The example reply explains a fictional delivery policy.',
      'Buttons offer Order now, See menu and Talk to a person.',
      'The sample customer chooses Order now. A fictional confirmation shows delivery by 7:40 pm and blue message ticks.',
      'Further sample conversations show a cake-shop pre-order and an AC-service booking. Their prices, availability and confirmations are invented for the illustration.',
      'A real system requires approved answers, a suitable platform account, connected services, human handoff and launch testing.',
    ],
  },
  n8n: {
    title: 'Illustrative example: a form-to-record n8n workflow',
    steps: [
      'This is a simulated workflow diagram; it does not process a real enquiry or contact an external service.',
      'A sample Form trigger starts a run and a Google Sheets step illustrates saving the record.',
      'An optional AI step labels the sample message as an order and a question.',
      'A Switch illustrates two matching actions: a WhatsApp reply and a team alert.',
      'Green checks, highlighted connections and execution counts are illustrative status indicators.',
      'The real project defines its trigger, connected accounts, actions, approval rules, failure alerts and recovery process.',
    ],
  },
  seo: {
    title: 'Illustrative example: a local business listing and search activity',
    steps: [
      'This uses fictional search listings, ratings and activity figures. It is not a client result, a ranking guarantee or a forecast.',
      'A sample search for “ac installation kochi” displays a map and three example businesses.',
      'CoolAir Services is highlighted as the example listing. Actual search order varies and is decided by the search platform.',
      'A sample visitor selects Call. The illustration shows 148 sample clicks and 23 sample calls, then updates those fictional counts as example searches change.',
      'Real reporting uses the data available in agreed accounts, with its source and measurement limits explained.',
    ],
  },
  nfc: {
    title: 'Illustrative example: opening a destination with an NFC tag',
    steps: [
      'This is a sample phone and tag interaction, not a live tap record.',
      'A compatible phone reads the sample tag and opens a destination page.',
      'The example review page lets the customer choose their own rating and write an honest review.',
      'The destination cycles through a sample warranty lookup, contact page and review page. Warranty dates and business details are fictional.',
      'A real tag needs a compatible phone or the QR fallback. Managed destination updates and any connected records are agreed in the project scope.',
    ],
  },
  quote: {
    title: 'Illustrative example: a quotation and warranty workflow',
    steps: [
      'This is a fictional job sequence, not a real customer record, sent quotation, signature or reminder.',
      'The rail shows enquiry, quote, sent, opened, accepted, installed, warranty and reminder stages.',
      'Sample quote Q-2041 uses an AC priced at ₹38,500, an installation and copper kit at ₹4,200, and a stabiliser at ₹3,100, for a total of ₹45,800.',
      'The illustration shows the quote shared, opened and accepted, then turns it into a sample warranty card with serial LF-AC-88213 and example installation and expiry dates.',
      'QR or NFC lookup and WhatsApp reminders are illustrated options. Real delivery and reminder integrations must be agreed, connected and tested.',
      'Other sample jobs and figures appear: a solar water heater at ₹48,300, CCTV cameras at ₹30,800, 42 quotes, 74 percent accepted and 1.8 days to accept. None are recorded business results.',
      'The demonstration does not establish subscription, ownership or warranty terms for a customer project.',
    ],
  },
};
