const db = require('../db');
const { id } = require('../utils/ids');

// Seed pool. Replace/extend freely — the Snick engine only reads this table.
const SEED = [
  ['Two truths, one lie', 'Har ek 3 baatein bolo — 2 sach, 1 jhoot. Partner guess kare.', 'Fun', 1, 'text'],
  ['Song dedication', 'Ek gaana bhejo jo aaj unki yaad dila gaya. Bolo kyun.', 'Romantic', 1, 'text'],
  ['Photo of your view', 'Abhi jo saamne dikh raha hai uski photo bhejo.', 'Fun', 1, 'photo'],
  ['Compliment, out loud', 'Ek tareef bolo — type mat karo, awaaz me bolo.', 'Romantic', 2, 'partner'],
  ['Cook something together', 'Saath me kuch banao, chahe 5 minute ka ho. Photo kheencho.', 'Teamwork', 3, 'photo'],
  ['Unfinished sentence', '"Mujhe tumhari sabse acchi baat lagti hai..." — poora karo.', 'Understanding', 2, 'text'],
  ['Old photo', 'Purani photo dhoondo aur uske peeche ki kahani batao.', 'Memory', 2, 'photo'],
  ['10 minute walk', 'Saath me 10 minute chalo, bina phone ke.', 'Challenge', 3, 'partner'],
  ['Ask something new', 'Ek sawaal poocho jo aaj tak nahi poocha.', 'Communication', 2, 'text'],
  ['Plan one small thing', 'Is hafte ka ek chhota plan abhi decide karo.', 'Teamwork', 2, 'partner'],
  ['Screenshot your day', 'Din ka ek moment capture karo jo unhe pasand aayega.', 'Fun', 1, 'photo'],
  ['Thank you note', 'Ek cheez ke liye thank you bolo jo unhone kiya tha.', 'Romantic', 1, 'text'],
  ['Teach them a word', 'Apni koi inside-joke ya nayi cheez sikhao.', 'Communication', 2, 'text'],
  ['Mirror selfie', 'Aaj ka look bhejo. Judge nahi, sirf share.', 'Fun', 1, 'photo'],
  ['Hard question', 'Ek cheez batao jo aap badalna chahte ho — apne aap me.', 'Understanding', 3, 'text'],
];

// Rare/legendary entries only ever land in the Mystery slot.
const RARE = [
  ['Letter, handwritten', 'Kagaz pe likho. Photo bhejo. Chhota hi sahi.', 'Romantic', 3, 'photo', 'LEGENDARY'],
  ['Recreate a first', 'Apni pehli date ka koi ek hissa dobara karo.', 'Memory', 3, 'partner', 'LEGENDARY'],
  ['No-phone dinner', 'Poora khana bina phone ke. Baad me confirm karo.', 'Challenge', 3, 'partner', 'RARE'],
  ['Voice note story', 'Ek 60-second voice note bhejo — aaj ka best part.', 'Communication', 2, 'text', 'RARE'],
];

function seedIfEmpty() {
  const n = db.prepare('SELECT COUNT(*) c FROM snick_catalog').get().c;
  if (n > 0) return;
  const ins = db.prepare(
    `INSERT INTO snick_catalog (id,title,prompt,category,difficulty,verification,rarity)
     VALUES (?,?,?,?,?,?,?)`
  );
  const tx = db.transaction(() => {
    SEED.forEach((r) => ins.run(id('sc_'), r[0], r[1], r[2], r[3], r[4], 'NORMAL'));
    RARE.forEach((r) => ins.run(id('sc_'), r[0], r[1], r[2], r[3], r[4], r[5]));
  });
  tx();
  console.log(`[catalog] seeded ${SEED.length + RARE.length} snicks`);
}

module.exports = { seedIfEmpty };
