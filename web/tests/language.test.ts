import test from 'node:test';
import assert from 'node:assert/strict';
import { BACK_ASK, CANCEL_ASK, LANG_ASK, LANGS, MENU_ASK, PERSON_ASK, PRICE_ASK, TEXT, guessLang, langFromText, type Lang } from '../bot/text';

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
