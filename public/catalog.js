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
   الأقسام: men=رجالي — women=نسائي — supplies=مستحضرات (مشتركة) — med=أدوية
   rank: 0 عادي يظهر الأول — 1 عطور — 8/9 حساس يتحط في آخر الرف.
   أي صنف اتصنف غلط: صلّحه من data/overrides.csv من غير ما تلمس الكود. */
function normalize(s){return s.toLowerCase().replace(/[\u064B-\u0652\u0640]/g,'').replace(/[إأآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-0x660)).replace(/\s+/g,' ').trim();}
const R=(s)=>new RegExp(s,'i');
const RX={
 form:R('\\b(tabs?|tablets?|caps?|capsules?|sach(et)?s?|amp(oule)?s?|vial|inj(ection)?|syp|syrup|susp(ension)?|supp(os)?|lozenges?|dps)\\b|\\d\\s?(mg|mcg|iu)\\b|قرص|اقراص|كبسول|مجم|شراب|حقن|امبول|لبوس|مرهم|نقط'),
 menSens:R('viagra|فياجرا|فياغرا|cialis|سياليس|sildenafil|tadalafil|vardenafil|levitra|kamagra|condom|كوندوم|durex|ديوركس|fiesta|performax|perfomax|lubric|مزلق|play feel|long love|vigour|maxman|cond\\.? ?$'),
 womenSens:R('maxi|always|kotex|sofy|sanitary|فوط|intima|intimate|femin|lactacyd|pregnancy|اختبار حمل|بريجنانسي|\\bbra\\b|ستيان'),
 medSens:R('vagin|\\bgyn|مهبل|postinor|contracep|منع حمل|suppos'),
 womenStrong:R('flamingo|فلامينجو|فلامنجو|venus|للسيدات|سيدات|حريمي|veet|casanova|coco wax|remowax|wax stripe|wax beans|hair remov|ازاله|lip ?stick|lip gloss|lip liner|روج|foundation|mascara|مسكره|eye ?liner|ايلاينر|كحل|\\bkohl\\b|blush|concealer|primer|eye ?shadow|highlighter|compact powder|كومباكت|make ?up|ميكاب|palette (colou?r|dark|intensive|cream)|palette \\d|\\bnails?\\b|اظافر|مانيكير|طلاء|رموش|\\blash(es)?\\b|حواجب|\\bbrow\\b|eyebrow|garnier colou?r|bigen|صبغه|hair (dye|colou?r)|colou?r naturals|decolorant|توكه|عصبيه|اكسسوار|\\b(women|woman|lady|ladies|girls?)\\b'),
 perfume:R('perfume|parfum|برفيوم|برفان|(^| )عطر|eau de (parfum|toilette|cologne)|\\bedt\\b|\\bedp\\b|cologne|كولونيا|body splash|بادي سبلاش|\\bmist\\b|بخاخ جسم'),
 notPerfume:R('baby|بيبي|اطفال|kids|johnson|glade|ambiance|frido|معطر|air ?fresh|hair|شعر|mouth|فم|nasal|eau de mer|talc'),
 menWord:R('for men|\\bmen\\b|\\bman\\b|homme|رجالي|رجال|sauvage|fogg|jacomo|\\blord\\b'),
 menGroom:R('حلاقه|shav|razor|gillette|gillete|جيليت|mach ?3|blades?|شفر|امواس|ماكينه|trimmer|beard|لحيه|after ?shave|بعد الحلاقه|sauvage|homme|for men|\\bmen\\b|\\bman\\b|رجالي|رجال|سيكو|spike|hair gel|styling gel|جيل شعر|pomade|بوميد|\\bwax\\b|hair ?do|\\baxe\\b|dorco|feather'),
 notMen:R('kids|baby|اطفال|curl|custard'),
 medSupply:R('bandage|شاش|gauze|plaster|لزق|بلاستر|betadine|بيتادين|alcohol|كحول|spirit|سبرتو|syringe|سرنج|needle|ابره|thermometer|ترمومتر|glucose|glucometer|accu ?chek|one ?touch|strips|شرائط|monitoring|nebuliz|جهاز|جوانتي|gloves|قطن|cotton|surgical|medical|طبي|elastic|ankle|knee|wrist|support|brace|حزام|جبيره|cannula|كانيولا|catheter|قسطره|swab|dressing|tulle|اصابع جلد|oxygen|اكسجين|wooden stick|استيك|sterile|معقم|antisept|مطهر'),
 care:R('shampoo|شامبو|conditioner|بلسم|serum|سيرم|moistur|مرطب|scrub|سكراب|soap|صابون|body wash|face wash|hand wash|wash|غسول|cleans|toner|sun ?block|sun ?screen|واقي شمس|\\bdeo|ديو|roll ?on|roll\\.on|مزيل|anti-?pers|hair oil|زيت (شعر|اطفال|خروع|لوز|جوز|جوجوبا|زيتون)|baby oil|vatika|nivea|garnier|vaseline|فازلين|\\bdove\\b|pantene|head ?& ?shoulders|headshoulders|\\bclear\\b|elvive|loreal|لوريال|neutrogena|cetaphil|bioderma|avene|vichy|eucerin|sebamed|cerave|beesline|biotherm|pampers|حفاض|diaper|wipes|مناديل|ماسك|face mask|فرشه|brush|مشط|\\bcomb\\b|ملقاط|zangaer|قصافه|مقص|مبرد|حجر خفاف|toothpaste|معجون|tooth|mouth ?wash|mouthwash|cerelac|سيرلاك|baby milk|\\bmilk\\b|حليب|biscuit|سكاته|بسكويت|bubbles|lotion|لوشن|body (butter|oil)|(face|hand|body|eye|day|night|foot|hair|beauty|sun|baby|whitening) (cream|gel|mask|serum|oil|spray)|كريم (وجه|يد|جسم|ايد|اطفال|شعر|تفتيح|مرطب|ترطيب|واقي|قدم)|whiten|تفتيح|بشره|baygon|مبيد|\\braid\\b|insect|styling|hair spray|فرد|مسواك|قطره ?شعر'),
 hasLatin:/[a-z]/i, hasArabic:/[\u0600-\u06FF]/
};
function classify(name){
 const k=normalize(name),T=(x)=>RX[x].test(k),F=T('form');
 if(/vagin|\bgyn|مهبل|postinor|contracep|منع حمل/.test(k))return{sec:'med',sub:'',rank:8,icon:'tube'};
 if(T('menSens'))return{sec:'men',sub:'',rank:9,icon:'box'};
 if(T('womenSens'))return{sec:'women',sub:'',rank:9,icon:'box'};
 if(!F&&T('womenStrong'))return{sec:'women',sub:'',rank:0,icon:/lip|روج|nail|اظافر|مانيكير|mascara|مسكره|ايلاينر|eyeliner/.test(k)?'lip':(/razor|blade|venus|شفر|امواس/.test(k)?'razor':'tube')};
 if(T('perfume')&&!T('notPerfume')){
   if(T('menWord'))return{sec:'men',sub:'',rank:1,icon:'perfume'};
   if(/splash|سبلاش|\bmist\b|بخاخ جسم/.test(k))return{sec:'women',sub:'',rank:1,icon:'perfume'};
   return{sec:'supplies',sub:'care',rank:0,icon:'perfume'};
 }
 if(!F&&T('menGroom')&&!T('notMen'))return{sec:'men',sub:'',rank:0,icon:/shav|razor|حلاقه|blade|شفر|امواس|gillet|جيليت/.test(k)?'razor':'tube'};
 if(!F&&T('medSupply'))return{sec:'supplies',sub:'med',rank:0,icon:/bandage|شاش|gauze|plaster|لزق|بلاستر|tulle|dressing|اصابع جلد/.test(k)?'bandage':'box'};
 if(T('care')&&!F)return{sec:'supplies',sub:'care',rank:0,icon:/shampoo|شامبو|wash|غسول|conditioner|بلسم|oil|زيت|lotion|لوشن/.test(k)?'bottle':'tube'};
 if(T('hasArabic')&&!T('hasLatin')&&!F)return{sec:'supplies',sub:'care',rank:0,icon:'box'};
 let icon='pill';
 if(/syp|syrup|susp|شراب|drops?|dps|نقط|solution|\bsol\b/.test(k))icon='bottle';
 else if(/amp|vial|inj|\bpen\b|حقن|امبول|فيال|cartidge|cartridge/.test(k))icon='syringe';
 else if(/cream|gel|oint|كريم|مرهم|\bcr\b/.test(k))icon='tube';
 return{sec:'med',sub:'',rank:T('medSens')?8:0,icon};
}

/* ---------------- الاسم الشائع (اسم بسيط يفهمه الزبون) ---------------- */
const NOISE=/(\*+|#+|\boffer\d*\b|\bofeer\b|\boff\b|\bfree\b|\bnew\b|\bcopy\b|\d+\s?%|عرض|اوفر|هديه|هدية|مجانا|بسلسله|جميع الالوان)/gi;
const SIZE=/\b\d+([.,]\d+)?\s?(ml|gm|gr|g|grams?|مل|ملي|مللي|مللى|جم|جرام|gram)\b/gi;
const SIZE_AR=/[\d٠-٩]+\s?(مل|ملي|مللي|مللى|جم|جرام)(?![\u0600-\u06FF])/g;
const FORMS=[[/(\d+)\s*(tabs?|tablets?)\b/gi,'$1 قرص'],[/(\d+)\s*(caps?|capsules?)\b/gi,'$1 كبسولة'],[/(\d+)\s*(amp(oules?)?s?)\b/gi,'$1 أمبولة'],[/(\d+)\s*(sach(ets?)?)\b/gi,'$1 ظرف'],[/(\d+)\s*(supp(os)?)\b/gi,'$1 لبوسة'],[/\b(syp|syrup)\b/gi,'شراب'],[/\bsusp(ension)?\b/gi,'معلق'],[/\b(drops?|dps)\b/gi,'نقط'],[/\boint(ment)?\b/gi,'مرهم'],[/\btabs?\b/gi,'أقراص'],[/\bcaps?\b/gi,'كبسولات'],[/\bamp(oules?)?\b/gi,'أمبول'],[/\bsach(ets?)?\b/gi,'ظروف'],[/\bvial\b/gi,'فيال']];
function titleCase(s){
  if(/[A-Z]/.test(s)&&!/[a-z]/.test(s))s=s.toLowerCase();
  return s.replace(/(^|[\s(\/+&-])([a-z])/g,(m,a,b)=>a+b.toUpperCase()).replace(/\b(\d+)\s?(Mg|Mcg|Iu)\b/g,(m,n,u)=>n+' '+u.toLowerCase());
}
function cleanBase(raw){
  return raw.replace(/^\d{3,}(?=[A-Za-z\u0600-\u06FF])/,'').replace(NOISE,' ').replace(/(?<!\d)\.|\.(?!\d)|_+/g,' ').replace(/\s+/g,' ').replace(/\s[Nن]\s*$/,'').replace(/[\s#.\-+*]+$/,'').replace(/^[\s#.\-+*]+/,'').trim();
}
function commonName(raw,keepSize){
  let s=cleanBase(raw);
  if(!keepSize)s=s.replace(SIZE,' ').replace(SIZE_AR,' ').replace(/\s+/g,' ').trim();
  s=titleCase(s);
  FORMS.forEach(([re,t])=>{s=s.replace(re,t);});
  s=s.replace(/\s+/g,' ').replace(/[\s#.\-+*]+$/,'').trim();
  return s||raw.trim();
}

/* ---------------- البحث بالعربي والإنجليزي (مطابقة صوتية) ----------------
   "بنادول" و "Panadol" بيطلعوا بنفس البصمة الصوتية فيتطابقوا. */
function skel(str){
  let s=normalize(str).replace(/(^|\s)ال(?=[\u0600-\u06FF]{3})/g,'$1').replace(/[ه](?=\s|$)/g,'');
  s=s.replace(/sch|tch|ch|sh|ش/g,'s').replace(/ph|ف|v/g,'f').replace(/kh|gh|خ|غ/g,'k').replace(/th|ث/g,'t').replace(/ck/g,'k').replace(/x/g,'ks')
     .replace(/c(?=[eiy])/g,'s').replace(/[cqكق]/g,'k').replace(/[gjج]/g,'j').replace(/[zsزسصظذ]/g,'s').replace(/[tdطتدض]/g,'t').replace(/[pب]/g,'b')
     .replace(/[مm]/g,'m').replace(/[نn]/g,'n').replace(/[لl]/g,'l').replace(/[رr]/g,'r').replace(/[حهh]/g,'h');
  s=s.replace(/[^bfjkmnlrhst0-9 ]/g,'').replace(/(.)\1+/g,'$1').replace(/\s+/g,' ').trim();
  return s;
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
const SECTIONS = { men: 'رجالي', women: 'نسائي', supplies: 'مستحضرات', med: 'أدوية' };
const SUBTITLES = { men: 'كل ما يخص الرجل: حلاقة وعناية وعطور', women: 'كل ما يخص المرأة: تجميل وعناية خاصة', supplies: 'مستحضرات مشتركة للجميع: عناية وبشرة وشعر ومستلزمات طبية', med: 'أدوية وأشربة وحقن ومكملات' };
const SEC_BY_AR = { 'رجالي': 'men', 'نسائي': 'women', 'مستحضرات': 'supplies', 'أدوية': 'med' };
const OVERRIDE_URL = 'data/overrides.csv';

const grid = document.getElementById('productGrid');
const statusEl = document.getElementById('catalogStatus');
const searchInput = document.getElementById('productSearch');
const aislesEl = document.getElementById('aisles');
const subChips = document.getElementById('subChips');
const moreBtn = document.getElementById('moreBtn');
const titleEl = document.getElementById('aisleTitle');
const subEl = document.getElementById('aisleSub');
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
function toProducts(rows, ov) {
  const h = rows[0].map((x) => x.trim());
  const ni = h.indexOf('الاسم'), qi = h.indexOf('الكمية'), pi = h.indexOf('السعر');
  if (ni < 0 || qi < 0 || pi < 0) return [];
  const out = [], groups = new Map();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i], name = (r[ni] || '').trim();
    const qty = parseFloat(r[qi]), price = parseFloat(r[pi]);
    if (!name || isNaN(qty) || isNaN(price) || qty <= 0) continue;   // المتوفر بس
    const c = classify(name), o = ov.get(normalize(name));
    if (o && o.sec) { c.sec = o.sec; c.sub = o.sec === 'supplies' ? (c.sub || 'care') : ''; if (c.rank >= 8) c.rank = 9; }
    const label = o && o.short ? o.short : commonName(name, false);
    const p = { name, label, full: commonName(name, true), manual: !!(o && o.short), price, qty, max: Math.max(1, Math.floor(qty)), sec: c.sec, sub: c.sub, rank: c.rank, icon: c.icon };
    out.push(p);
    const g = p.sec + '|' + normalize(label);
    groups.set(g, (groups.get(g) || 0) + 1);
  }
  // لو اسمين بقوا متطابقين بعد التبسيط (زي نفس الدوا بحجمين)، نرجّع الحجم عشان الزبون يفرّق
  out.forEach((p) => { if (!p.manual && groups.get(p.sec + '|' + normalize(p.label)) > 1) p.label = p.full; p.key = normalize(p.name + ' ' + p.label); p.pw = pwords(p.key); });
  return out;
}

/* العطر المميز (عرض) — أول حاجة في قسم الرجالي */
const FEATURED = { name: 'SB Perfume Sauvage 50ml', label: 'عطر SB Sauvage 50ml', price: 375, old: 400, max: 20, key: 'sb perfume sauvage عطر ساوفاج', pw: pwords('sb perfume sauvage عطر ساوفاج'), sec: 'men', sub: '', rank: -1, icon: 'perfume', img: 'assets/product-sauvage.jpg' };


function pwords(key) { return key.split(' ').filter(Boolean).map((w) => ({ s: skel(w), l: w.length })).filter((x) => x.s); }

/* ---------------- البحث ---------------- */
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function parseQuery(q) {
  return normalize(q).split(' ').filter(Boolean).map((t) => {
    let re = null; try { re = new RegExp(esc(t).replace(/\\\*/g, '.*'), 'iu'); } catch (e) {}
    const sq = /[\u0600-\u06FF]/.test(t) ? skel(t) : '';
    return { re, sq: sq.length >= 2 ? sq : '' };
  });
}
// تطابق صوتي: نفس البصمة، أو بداية الكلمة مع زيادة حرف/حرفين بالكتير (عشان "شامبو" ماتجيبش أدوية)
function phon(p, sq) {
  let best = 0;
  for (const w of p.pw) {
    if (w.s === sq && (sq.length >= 3 || w.l >= 5)) return 1;                       // نفس الكلمة صوتيًا
    if (!best && sq.length >= 4 && w.s.startsWith(sq) && w.s.length <= sq.length + (sq.length >= 6 ? 2 : 1)) best = 2;  // قريبة منها
  }
  return best;
}
// 0 = مطابقة نص مباشرة، 1/2 = مطابقة صوتية (عربي ↔ إنجليزي)، -1 = مفيش
function score(p, qs) {
  let s = 0;
  for (const t of qs) {
    if (t.re && t.re.test(p.key)) continue;
    const ph = t.sq ? phon(p, t.sq) : 0;
    if (ph) { s = Math.max(s, ph); continue; }
    return -1;
  }
  return s;
}
function matching() {
  const q = searchInput.value.trim();
  if (!q) { all.forEach((p) => (p._s = 0)); return all; }
  const qs = parseQuery(q);
  return all.filter((p) => (p._s = score(p, qs)) >= 0);
}
function sortShelf(a, b) { return a.rank - b.rank || a.label.localeCompare(b.label, 'ar'); }
function sortSearch(a, b) { return (a._s || 0) - (b._s || 0) || sortShelf(a, b); }

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
  const stock = p.qty ? `<div class="stock">${p.qty >= 1 ? 'المتوفر: ' + Math.floor(p.qty).toLocaleString('ar-EG') : 'كمية محدودة'}</div>` : '';
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
function render(auto) {
  const matches = matching();
  const counts = { men: 0, women: 0, supplies: 0, med: 0 };
  matches.forEach((p) => counts[p.sec]++);
  const searching = !!searchInput.value.trim();
  const featHit = !searching || score(FEATURED, parseQuery(searchInput.value)) >= 0;
  counts.men += featHit ? 1 : 0;
  Object.keys(counts).forEach((k) => { document.getElementById('n-' + k).textContent = searching ? counts[k].toLocaleString('ar-EG') + ' نتيجة' : ''; });

  // لو بتبحث والقسم الحالي مفيهوش نتايج، روح لأول قسم فيه
  if (searching && auto) {
    // أفضل قسم للنتيجة: اللي فيه أقوى تطابق، ولو اتساوا فالأكتر نتايج
    const best = {}; matches.forEach((p) => { if (!(p.sec in best) || p._s < best[p.sec]) best[p.sec] = p._s; });
    if (featHit) best.men = Math.min(best.men ?? 9, 0);
    const keys = Object.keys(counts).filter((k) => counts[k] > 0);
    if (keys.length) {
      keys.sort((a, b) => best[a] - best[b] || counts[b] - counts[a]);
      if (keys[0] !== activeSec) setSection(keys[0], true);
    }
  }
  subChips.hidden = activeSec !== 'supplies';
  let list = matches.filter((p) => p.sec === activeSec && (!activeSub || p.sub === activeSub));
  list.sort(searching ? sortSearch : sortShelf);
  if (activeSec === 'men' && featHit) list = [FEATURED, ...list];
  results = list; shown = 0; grid.innerHTML = ''; moreBtn.hidden = true;
  titleEl.textContent = SECTIONS[activeSec]; subEl.textContent = SUBTITLES[activeSec];
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
  if (!silent) { render(); const y = document.getElementById('aisleTitle').getBoundingClientRect().top + scrollY - 190; if (scrollY > y) scrollTo({ top: y, behavior: 'smooth' }); }
}

/* ---------------- تفاعل ---------------- */
aislesEl.addEventListener('click', (e) => { const b = e.target.closest('.aisle'); if (b) setSection(b.dataset.sec); });
subChips.addEventListener('click', (e) => {
  const c = e.target.closest('.chip'); if (!c) return;
  activeSub = c.dataset.sub;
  subChips.querySelectorAll('.chip').forEach((x) => x.classList.toggle('is-active', x === c));
  render();
});
let t; searchInput.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => render(true), 160); });

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
// data/overrides.csv (اختياري): الاسم الأصلي, الاسم المختصر, القسم — لتصحيح اسم أو قسم أي صنف بإيدك
function parseOverrides(text) {
  const m = new Map();
  parseCSV(text).slice(1).forEach((r) => {
    const orig = (r[0] || '').trim(); if (!orig) return;
    m.set(normalize(orig), { short: (r[1] || '').trim(), sec: SEC_BY_AR[(r[2] || '').trim()] || '' });
  });
  return m;
}
Promise.all([
  fetch(DATA_URL).then((r) => { if (!r.ok) throw 0; return r.text(); }),
  fetch(OVERRIDE_URL).then((r) => (r.ok ? r.text() : '')).catch(() => '')
]).then(([text, ovText]) => {
    all = toProducts(parseCSV(text), ovText ? parseOverrides(ovText) : new Map());
    all.forEach((p) => byName.set(p.name, p));
    byName.set(FEATURED.name, FEATURED);
    if (!all.length) { statusEl.textContent = 'مفيش أصناف متاحة حاليًا.'; return; }
    Cart.sync(byName);
    render();
  })
  .catch(() => { statusEl.textContent = 'تعذر تحميل الأصناف. لو بتجرب من على جهازك مباشرة، شغّل الموقع من سيرفر محلي أو ارفعه أونلاين.'; });
})();
