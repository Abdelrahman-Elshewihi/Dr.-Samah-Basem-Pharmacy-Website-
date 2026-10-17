/* ====================================================================
   catalog.js — الأرفف: تحميل الأصناف، التصنيف التلقائي، البحث، والعرض
   مصدر البيانات: data/products.csv  (الاسم, الكمية, السعر)
   الأصناف المتوفرة بس (الكمية > 0) هي اللي بتظهر على الأرفف.
   ==================================================================== */
(function () {
const DATA_URL = 'data/products.csv';
const BATCH = 10;   // عدد الأصناف في كل دفعة
const WA_NUMBER = '201284085786';

/* ---------------- التصنيف التلقائي (حسب الاسم) ----------------
   rank: 0 عادي يظهر الأول — 1 عطور — 8/9 حساس يتحط في آخر الرف.
   عايز تعدّل التصنيف؟ عدّل كلمات القواعد تحت. */
/* قواعد تصنيف الأصناف حسب الاسم — بتتطبق تلقائيًا على أي ملف CSV جديد */
function normalize(s){return s.toLowerCase().replace(/[\u064B-\u0652]/g,'').replace(/[إأآا]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-0x660)).replace(/\s+/g,' ').trim();}
const R=(s)=>new RegExp(s,'i');
const RULES={
 menSens:R('viagra|فياجرا|فياغرا|cialis|سياليس|sildenafil|tadalafil|vardenafil|levitra|kamagra|condom|كوندوم|cond\\. ?$|durex|ديوركس|fiesta|performax|perfomax|lubric|مزلق|play feel|long love|stud|vigour|maxman'),
 womenSens:R('maxi|always|kotex|sofy|sanitary|فوط|فوطه|نسائي|intima|intimate|femin|vagin|lactacyd|pregnancy|اختبار حمل|بريجنانسي|\\bbra\\b|ستيان'),
 medSens:R('vagin|suppos|hemorr|بواسير|contracep|منع حمل|postinor|ovulation|مهبل'),
 menGroom:R('حلاقه|shav|razor|gillette|جيليت|mach ?3|blade|شفر|ماكينه|trimmer|beard|لحيه|after ?shave|بعد الحلاقه|sauvage|homme|for men|\\bmen\\b|رجالي|رجال|سيكو|spike|hair gel|جيل شعر|pomade|بوميد|wax|ستايل|styling'),
 perfume:R('perfume|parfum|برفيوم|برفان|عطر|eau de|edt|edp|cologne|كولونيا|body splash|mist|بخاخ جسم'),
 womenWord:R('women|woman|lady|ladies|for her|حريمي|نسائي|girl|فيكتوريا'),
 womenBeauty:R('lipstick|lip stick|lip gloss|روج|foundation|mascara|مسكره|eyeliner|ايلاينر|كحل|kohl|blush|concealer|primer|eye ?shadow|highlighter|compact|بودره|nail|اظافر|مانيكير|طلاء|رموش|lash|حواجب|brow|garnier color|bigen|صبغه|hair dye|color naturals|color intensity|veet|casanova|hair remover|ازاله الشعر|شمع|توكه|عصبيه|اكسسوار|سوارس|makeup|ميكاب|lip liner|palette'),
 careWord:R('cerelac|biscuit|بسكويت|حليب|bebelac|aptamil|similac|\\bnan\\b|shampoo|شامبو|conditioner|بلسم|cream|كريم|lotion|لوشن|moistur|مرطب|scrub|سكراب|soap|صابون|wash|غسول|cleanser|toner|serum|سيرم|sun ?block|sun ?screen|واقي شمس|deo|ديو|مزيل عرق|lip|شفايف|nivea|garnier|vaseline|فازلين|eva |ايفا|dove|pantene|clear|loreal|لوريال|neutrogena|cetaphil|bioderma|avene|vichy|eucerin|sebamed|baby|بيبي|pampers|حفاض|diaper|wipes|مناديل|ماسك|mask|فرشه|brush|مشط|comb|ملقاط|zangaer|قصافه|قصافات|مقص|مبرد|مقلمه|oil|زيت|face|وجه|body|جسم|hair|شعر|skin|بشره|tooth|معجون|فرشه اسنان|mouth|فم|perfume|spray|سبراي'),
 medSupply:R('bandage|شاش|gauze|plaster|لزق|بلاستر|betadine|بيتادين|alcohol|كحول|spirit|سبرتو|syringe|سرنج|needle|ابره|thermometer|ترمومتر|glucometer|accu ?chek|strips|شرائط|جهاز|nebuliz|جوانتي|gloves|قطن|cotton|surgical|medical|طبي|elastic|ضغط|support|brace|حزام|جبيره|cannula|كانيولا|catheter|قسطره|swab|dressing|tulle|اصابع جلد|oxygen|اكسجين|wooden stick|استيك|one ?touch|sterile|معقم|dettol|ديتول|antisept|مطهر'),
 form:R('\\b(tab|tabs|tablets?|cap|caps|capsules?|syp|syrup|susp|suspension|amp|ampoules?|vial|inj|injection|supp|drops?|oint|ointment|sachets?|sol|solution|pen|flexpen|cartridge|inhaler|eye|ear|nasal|infusion|enema|gel|spray|powder)\\b|\\d+\\s?(mg|mcg|iu|gm|ml)\\b|اقراص|شراب|حقن|نقط|اقماع|امبول|فيال'),
 hasLatin:/[a-z]/i, hasArabic:/[\u0600-\u06FF]/
};
/* بيرجّع {sec, sub, rank, icon} — rank أعلى = أبعد (أخف ظهورًا) في آخر الرف */
function classify(name){
 const k=normalize(name),T=(x)=>RULES[x].test(k);
 if(/vagin|\\bgyn|suppos.*gyn|مهبل/.test(k))return{sec:'med',sub:'',rank:8,icon:'tube'};
 if(T('menSens'))return{sec:'men',sub:'',rank:9,icon:'box'};
 if(T('womenSens'))return{sec:'women',sub:'',rank:9,icon:'box'};
 if(T('perfume')&&!/baby|بيبي|اطفال|glade|معطر جو|ambiance|air |معطر شعر|hair|شعر|معطر فم|mouth/.test(k)){return T('womenWord')?{sec:'women',sub:'',rank:1,icon:'perfume'}:{sec:'men',sub:'',rank:1,icon:'perfume'};}
 if(T('menGroom')&&!T('womenWord'))return{sec:'men',sub:'',rank:0,icon:/shav|razor|حلاقه|blade|شفر|gillette|جيليت/.test(k)?'razor':'tube'};
 if(T('womenBeauty')||(T('womenWord')&&!T('form')))return{sec:'women',sub:'',rank:0,icon:/lip|روج|nail|اظافر|مانيكير|mascara|مسكره/.test(k)?'lip':'tube'};
 if(T('medSupply'))return{sec:'supplies',sub:'med',rank:0,icon:/bandage|شاش|gauze|plaster|لزق|بلاستر|tulle|dressing|اصابع جلد/.test(k)?'bandage':'box'};
 const care=T('careWord'),form=T('form');
 if(care&&!(form&&/\b(tab|tabs|cap|caps|amp|vial|inj|syp|susp|drops?|supp)\b|\d\s?(mg|mcg|iu)\b/.test(k)))
   return{sec:'supplies',sub:'care',rank:0,icon:/shampoo|شامبو|wash|غسول|conditioner|بلسم|oil|زيت|lotion|لوشن/.test(k)?'bottle':'tube'};
 if(T('hasArabic')&&!T('hasLatin')&&!form)return{sec:'supplies',sub:'care',rank:0,icon:'box'};
 let icon='pill';
 if(/syp|syrup|susp|شراب|drops?|نقط|solution|sol\b/.test(k))icon='bottle';
 else if(/amp|vial|inj|pen\b|حقن|امبول|فيال/.test(k))icon='syringe';
 else if(/cream|gel|oint|كريم|مرهم|جل/.test(k))icon='tube';
 return{sec:'med',sub:'',rank:T('medSens')?8:0,icon};
}


/* ---------------- أيقونات العبوات ---------------- */
const ICONS = {
  pill: '<rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-35 12 12)"/><path d="M9.5 6.5l5 5"/>',
  bottle: '<path d="M9 3h6v3l1.5 2v11a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2V8L9 6z"/><path d="M8 13h8"/>',
  syringe: '<path d="M4 20l5-5M14 5l5 5M12 7l5 5-7 7-5-5zM16 3l5 5"/>',
  tube: '<path d="M7 3h10l-1 4H8zM8 7l-1 14h10L16 7"/>',
  razor: '<path d="M5 17l9-9 4 4-9 9zM14 8l2-2 3 3-2 2"/>',
  lip: '<path d="M9 21V11h6v10zM10 11V6l4-3v8"/>',
  perfume: '<rect x="6" y="10" width="12" height="11" rx="2"/><path d="M10 10V7h4v3M11 4h2v3"/>',
  bandage: '<rect x="2" y="8" width="20" height="8" rx="4" transform="rotate(-30 12 12)"/><path d="M10 10l4 4"/>',
  box: '<path d="M3 8l9-5 9 5v9l-9 5-9-5zM3 8l9 5 9-5M12 13v9"/>'
};
const SECTIONS = { men: 'قسم الرجالي', women: 'قسم الحريم', supplies: 'قسم المستلزمات', med: 'قسم العلاج' };

const grid = document.getElementById('productGrid');
const statusEl = document.getElementById('catalogStatus');
const searchInput = document.getElementById('productSearch');
const aislesEl = document.getElementById('aisles');
const subChips = document.getElementById('subChips');
const moreBtn = document.getElementById('moreBtn');
const titleEl = document.getElementById('aisleTitle');
const askBox = document.getElementById('askDoctor');
const askLink = document.getElementById('askLink');
if (!grid) return;

let all = [], byName = new Map();
let activeSec = 'men', activeSub = '';
let results = [], shown = 0;

/* ---------------- CSV ---------------- */
function parseCSV(text) {
  text = text.replace(/^\uFEFF/, '');
  const rows = []; let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];
    if (q) { if (c === '"' && n === '"') { field += '"'; i++; } else if (c === '"') q = false; else field += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && n === '\n') i++; row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}

/* اسم العرض: شيل أكواد البداية والرموز الزايدة، وهدّي الحروف الكبيرة */
function prettyName(raw) {
  let s = raw.replace(/^\*+/, '').replace(/^\d{3,}(?=[A-Za-z\u0600-\u06FF])/, '').replace(/\s*[#.\-]+\s*$/, '').replace(/\s+N$/, '').replace(/\s+/g, ' ').trim();
  if (/[A-Z]/.test(s) && !/[a-z]/.test(s)) {
    s = s.toLowerCase().replace(/(^|[\s(\/+-])([a-z])/g, (m, a, b) => a + b.toUpperCase());
    s = s.replace(/\b(\d+)\s?(Mg|Gm|Ml|Mcg|Iu)\b/g, (m, n, u) => n + ' ' + u.toLowerCase()).replace(/\b(Tab|Tabs|Cap|Caps|Amp|Syp|Susp)\b/g, (m) => m.toLowerCase());
  }
  return s;
}

function toProducts(rows) {
  const h = rows[0].map((x) => x.trim());
  const ni = h.indexOf('الاسم'), qi = h.indexOf('الكمية'), pi = h.indexOf('السعر');
  if (ni < 0 || qi < 0 || pi < 0) return [];
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i], name = (r[ni] || '').trim();
    const qty = parseFloat(r[qi]), price = parseFloat(r[pi]);
    if (!name || isNaN(qty) || isNaN(price) || qty <= 0) continue;   // المتوفر بس
    const c = classify(name);
    out.push({ name, label: prettyName(name), price, qty, max: Math.max(1, Math.floor(qty)), key: normalize(name), sec: c.sec, sub: c.sub, rank: c.rank, icon: c.icon });
  }
  return out;
}

/* العطر المميز (عرض) — أول حاجة في قسم الرجالي */
const FEATURED = { name: 'SB Perfume Sauvage 50ml', label: 'عطر SB Sauvage 50ml', price: 375, old: 400, max: 20, key: 'sb perfume sauvage عطر', sec: 'men', sub: '', rank: -1, icon: 'perfume', img: 'assets/product-sauvage.jpg' };


/* ---------------- البحث ---------------- */
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function regexes(q) {
  return normalize(q).split(' ').filter(Boolean).map((t) => { try { return new RegExp(esc(t).replace(/\\\*/g, '.*'), 'iu'); } catch (e) { return null; } }).filter(Boolean);
}
function matching() {
  const q = searchInput.value.trim();
  if (!q) return all;
  const re = regexes(q);
  return re.length ? all.filter((p) => re.every((r) => r.test(p.key))) : all;
}
function sortShelf(a, b) { return a.rank - b.rank || a.label.localeCompare(b.label, 'ar'); }

/* ---------------- العرض ---------------- */
function money(n) { return Number(n).toLocaleString('ar-EG', { maximumFractionDigits: 2 }) + ' ج'; }

function controls(p) {
  const q = Cart.qty(p.name);
  return q > 0
    ? `<div class="stepper"><button type="button" data-a="plus" aria-label="زيادة">+</button><span>${q.toLocaleString('ar-EG')}</span><button type="button" data-a="minus" aria-label="نقص">−</button></div>`
    : '<button type="button" class="add" data-a="add">+ ضيف للعربية</button>';
}
function makeCard(p, idx) {
  const el = document.createElement('article');
  el.className = 'item';
  el.dataset.i = idx;
  el.style.animationDelay = Math.min((idx % BATCH) * 12, 250) + 'ms';
  const pack = p.img ? `<div class="pack photo"><img src="${p.img}" alt="" loading="lazy"></div>`
    : `<div class="pack"><svg class="ic" viewBox="0 0 24 24">${ICONS[p.icon] || ICONS.box}</svg></div>`;
  const h = document.createElement('h3'); h.textContent = p.label;
  const stock = p.qty ? `<div class="stock">المتوفر: ${(Math.round(p.qty * 100) / 100).toLocaleString('ar-EG')}</div>` : '';
  const price = `<div class="price">${p.old ? `<s>${money(p.old)}</s>` : ''}${money(p.price)}</div>`;
  el.innerHTML = (p.old ? '<span class="offer-tag">عرض</span>' : '') + pack;
  el.append(h);
  el.insertAdjacentHTML('beforeend', stock + price + `<div class="ctl">${controls(p)}</div>`);
  return el;
}
function nextBatch() {
  if (shown >= results.length) return;
  const frag = document.createDocumentFragment(), end = Math.min(shown + BATCH, results.length);
  for (let i = shown; i < end; i++) frag.appendChild(makeCard(results[i], i));
  grid.appendChild(frag);
  shown = end;
  moreBtn.hidden = shown >= results.length;
  moreBtn.textContent = `عرض المزيد (${(results.length - shown).toLocaleString('ar-EG')} صنف متبقي)`;
}
function render() {
  const matches = matching();
  const counts = { men: 0, women: 0, supplies: 0, med: 0 };
  matches.forEach((p) => counts[p.sec]++);
  counts.men += (!searchInput.value.trim() || regexes(searchInput.value).every((r) => r.test(FEATURED.key))) ? 1 : 0;
  const searching = !!searchInput.value.trim();
  Object.keys(counts).forEach((k) => { document.getElementById('n-' + k).textContent = searching ? counts[k].toLocaleString('ar-EG') + ' نتيجة' : ''; });

  // لو بتبحث والقسم الحالي مفيهوش نتايج، روح لأول قسم فيه
  if (searching && counts[activeSec] === 0) {
    const first = Object.keys(counts).find((k) => counts[k] > 0);
    if (first) setSection(first, true);
  }
  subChips.hidden = activeSec !== 'supplies';
  let list = matches.filter((p) => p.sec === activeSec && (!activeSub || p.sub === activeSub));
  if (activeSec === 'men' && (!searching || regexes(searchInput.value).every((r) => r.test(FEATURED.key)))) list = [FEATURED, ...list];
  list.sort(sortShelf);
  results = list; shown = 0; grid.innerHTML = ''; moreBtn.hidden = true;
  titleEl.textContent = SECTIONS[activeSec];
  statusEl.textContent = list.length ? `${list.length.toLocaleString('ar-EG')} صنف على الرف` : 'مفيش نتايج مطابقة في القسم ده.';
  const q = searchInput.value.trim();
  askBox.hidden = !(searching && list.length < 4);
  askLink.href = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent('السلام عليكم، بدوّر على صنف: ' + q)}`;
  nextBatch();
}
function setSection(sec, silent) {
  activeSec = sec; activeSub = '';
  aislesEl.querySelectorAll('.aisle').forEach((b) => b.classList.toggle('is-active', b.dataset.sec === sec));
  subChips.querySelectorAll('.chip').forEach((c) => c.classList.toggle('is-active', c.dataset.sub === ''));
  if (!silent) { render(); const y = document.getElementById('aisleTitle').getBoundingClientRect().top + scrollY - 150; if (scrollY > y) scrollTo({ top: y, behavior: 'smooth' }); }
}

/* ---------------- تفاعل ---------------- */
aislesEl.addEventListener('click', (e) => { const b = e.target.closest('.aisle'); if (b) setSection(b.dataset.sec); });
subChips.addEventListener('click', (e) => {
  const c = e.target.closest('.chip'); if (!c) return;
  activeSub = c.dataset.sub;
  subChips.querySelectorAll('.chip').forEach((x) => x.classList.toggle('is-active', x === c));
  render();
});
let t; searchInput.addEventListener('input', () => { clearTimeout(t); t = setTimeout(render, 160); });

// الإضافة/التعديل من الكارت نفسه (تفويض أحداث — سريع حتى مع آلاف الأصناف)
grid.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-a]'); if (!b) return;
  const card = b.closest('.item'), p = results[+card.dataset.i]; if (!p) return;
  const a = b.dataset.a;
  if (a === 'add') { Cart.add(p); flyToCart(b); }
  else if (a === 'plus') Cart.set(p, Cart.qty(p.name) + 1);
  else if (a === 'minus') Cart.set(p, Cart.qty(p.name) - 1);
});
// أي تغيير في العربية يحدّث أزرار الكروت الظاهرة
Cart.onChange(() => {
  grid.querySelectorAll('.item').forEach((el) => {
    const p = results[+el.dataset.i]; if (!p) return;
    el.querySelector('.ctl').innerHTML = controls(p);
  });
});

// الرف بيكمّل لوحده مع الاسكرول
moreBtn.addEventListener('click', nextBatch);

/* ---------------- تحميل البيانات ---------------- */
fetch(DATA_URL)
  .then((r) => { if (!r.ok) throw 0; return r.text(); })
  .then((text) => {
    all = toProducts(parseCSV(text));
    all.forEach((p) => byName.set(p.name, p));
    byName.set(FEATURED.name, FEATURED);
    if (!all.length) { statusEl.textContent = 'مفيش أصناف متاحة حاليًا.'; return; }
    Cart.sync(byName);
    render();
  })
  .catch(() => { statusEl.textContent = 'تعذر تحميل الأصناف. لو بتجرب من على جهازك مباشرة، شغّل الموقع من سيرفر محلي أو ارفعه أونلاين.'; });
})();
