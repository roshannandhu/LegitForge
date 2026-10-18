import test from 'node:test';
import assert from 'node:assert/strict';
import { BACK_ASK, CANCEL_ASK, LANG_ASK, LANGS, MENU_ASK, MONEY, PERSON_ASK, PRICE_ASK, TEXT, clearService, guessLang, langFromText, type Lang } from '../bot/text';
import { contactFrom } from '../bot/worker';

/** The bot's own language reading (no AI): the examples customers really type. An AI reads the
 *  meaning later; this decides only which language and style the fixed questions come in. */
const CASES: [string, Lang | undefined][] = [
  // English
  ['I need a website for my shop', 'en'],
  ['How much does a website cost?', 'en'],
  // Malayalam, Manglish
  ['എനിക്ക് ഒരു വെബ്സൈറ്റ് വേണം', 'ml'],
  ['Enikku oru website venam. Ethra paisa aakum?', 'mg'],
  ['Website ethra aakum?', 'mg'],
  ['Bro payment gateway venam.', 'mg'],
  ['Bro enikku ecommerce site venam, payment gateway undakanam, budget 15k aanu.', 'mg'],
  ['enikk oru site venam chetta', 'mg'],
  // Kannada, Kanglish
  ['ನನಗೆ ವೆಬ್‌ಸೈಟ್ ಬೇಕು', 'kn'],
  ['Nanage website beku. Eshtu cost agutte?', 'kg'],
  ['Nanage dynamic website beku.', 'kg'],
  // Hindi, Hinglish
  ['मुझे वेबसाइट चाहिए', 'hi'],
  ['Mujhe business website chahiye. Kitna kharcha hoga?', 'hg'],
  ['Mujhe automation chahiye.', 'hg'],
  ['muje site chaiye bhai', 'hg'],
  // Tamil, Tanglish
  ['எனக்கு ஒரு இணையதளம் வேண்டும்', 'ta'],
  ['Enakku ecommerce website venum. Evlo aagum?', 'tg'],
  ['Enakku booking website venum.', 'tg'],
  ['oru website venum bro', 'tg'],
  // short replies never decide a language
  ['Ok.', undefined], ['Yes.', undefined], ['Nahi.', undefined], ['Venda.', undefined], ['👍', undefined], ['hmm', undefined], ['ha', undefined],
  // two languages at once, equally: the bot asks instead of guessing
  ['Bro enikku website venam, kitna lagega?', undefined],
  // English with a name or an English word that is also an Indian word: still English
  ['Hi, I need a website for Karna Motors', 'en'],
  ['I need a mere landing page for my shop', 'en'],
  ['Can you build a site for Panna Cotta Cafe', 'en'],
  ['I need a website for my boutique Meri Collections please', 'en'],
  ['Can you make a website for Unga Textiles in Chennai', 'en'],
];

test('which language and style a message is in (Romanised Indian languages are not English)', () => {
  const wrong = CASES.filter(([text, want]) => guessLang(text) !== want).map(([text, want]) => `${text} → ${guessLang(text)} (want ${want})`);
  assert.deepEqual(wrong, []);
});

test('a language named in any of its own forms; commands typed in their language', () => {
  assert.equal(langFromText('Tanglish please'), 'tg');
  assert.equal(langFromText('தமிழ்'), 'ta');
  assert.equal(langFromText('hinglish'), 'hg');
  assert.equal(langFromText('Kanglish'), 'kg');
  assert.equal(langFromText('Malayalam'), 'ml');
  for (const s of ['language', 'change language', 'Bhasha?', 'ഭാഷ', 'மொழி']) assert.ok(LANG_ASK.test(s), s);
  for (const s of ['menu', 'Main menu', 'മെനു']) assert.ok(MENU_ASK.test(s), s);
  for (const s of ['back', 'go back', 'pinnottu']) assert.ok(BACK_ASK.test(s), s);
  for (const s of ['cancel', 'cancel this']) assert.ok(CANCEL_ASK.test(s), s);
  for (const s of ['can I talk to a person?', 'speak with your team', 'insaan se baat karni hai']) assert.ok(PERSON_ASK.test(s), s);
  for (const s of ['I want a website about language learning', 'my menu card design', 'backend developer']) {
    assert.ok(!LANG_ASK.test(s) && !MENU_ASK.test(s) && !BACK_ASK.test(s), `not a command: ${s}`);
  }
  for (const s of ['ethra aakum?', 'kitna lagega', 'eshtu agutte', 'evlo aagum', 'how much', 'എത്ര ആകും', 'எவ்வளவு']) assert.ok(PRICE_ASK.test(s), s);
  assert.ok(!PRICE_ASK.test('I need a website for my bakery'));
});

test('every language has every fixed text, within WhatsApp limits', () => {
  assert.equal(LANGS.length, 9);
  assert.ok(LANGS.length <= 10 && LANGS.every((l) => l.title.length <= 24), 'one list');
  const keys = Object.keys(TEXT.en).sort();
  for (const l of LANGS) {
    assert.deepEqual(Object.keys(TEXT[l.key]).sort(), keys, l.key);
    for (const [k, v] of Object.entries(TEXT[l.key])) {
      if (Array.isArray(v)) assert.ok(v.every((b) => b.length > 0 && b.length <= 20), `${l.key}.${k}`);
      else assert.ok(v.trim().length > 0, `${l.key}.${k}`);
    }
    assert.ok(TEXT[l.key].menu.length <= 20 && TEXT[l.key].slotBtn.length <= 20, `${l.key} list buttons`);
    assert.ok(TEXT[l.key].langSet.includes('{lang}') && TEXT[l.key].langSet.includes('*language*'), `${l.key}.langSet`);
  }
});

test('the first message skips the menu only on an unmistakable service', () => {
  assert.equal(clearService('Can I get a quote for a website?'), 'website', 'a quote is not the quotation system');
  assert.equal(clearService('I found you on Google, can you help me?'), undefined);
  assert.equal(clearService('I saw your WhatsApp number on Instagram, need a website'), 'website');
  assert.equal(clearService('Got your number from a visiting card'), undefined);
  assert.equal(clearService('Enikku oru website venam, ethra aakum?'), 'website');
  assert.equal(clearService('I need a WhatsApp bot for my clinic'), 'whatsapp');
  assert.equal(clearService('website and a booking system'), undefined, 'two services: the menu');
});

test('"talk to a person" is a request, not a sentence that mentions one', () => {
  for (const s of ['A bot that answers FAQs and lets patients talk to a person when needed', 'customers can chat with staff after hours',
    'Website where people can talk to someone at the clinic']) assert.ok(!PERSON_ASK.test(s), s);
  for (const s of ['Can I talk to a person?', 'talk to a human please', 'I want to speak with your team', 'human']) assert.ok(PERSON_ASK.test(s), s);
});

test('money in Tamil and in romanised words is never in an automatic answer', () => {
  for (const s of ['சுமார் பத்தாயிரம் ரூபாய் ஆகும்', 'ரூ. 5000', 'lagbhag das hazaar lagega', 'suma hattu saavira aagutte', 'oru laksha aakum']) assert.ok(MONEY.test(s), s);
  for (const s of ['We build websites', 'ஆம், நாங்கள் இணையதளங்கள் செய்கிறோம்', 'Haan, hum website banate hain']) assert.ok(!MONEY.test(s), s);
});

test('a number and an email from what a website or Messenger visitor typed', () => {
  assert.deepEqual(contactFrom('My number is 98470 12345, mail ravi@bakery.in'), { phone: '919847012345', email: 'ravi@bakery.in' });
  assert.deepEqual(contactFrom('After 20-10-2026 call 9847012345'), { phone: '919847012345' }, 'the date before it is not the number');
  assert.deepEqual(contactFrom('0495 2723456'), {}, 'a landline is not a WhatsApp number');
  assert.deepEqual(contactFrom('+44 7700 900123'), { phone: '447700900123' });
  assert.deepEqual(contactFrom('call me'), {});
});
