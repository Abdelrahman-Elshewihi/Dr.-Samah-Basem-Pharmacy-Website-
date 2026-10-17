/* ====================================================================
   كتالوج الأصناف: تحميل بيانات المنتجات، البحث، والتصفية حسب القسم
   ====================================================================
   مصدر البيانات: data/products.csv
   الأعمدة المطلوبة: الاسم,الكمية,السعر  (بيتولّد تلقائيًا من PDF الأصناف)
   ==================================================================== */

(function () {
  const DATA_URL = 'data/products.csv';
  const PAGE_SIZE = 60; // عدد الكروت اللي بتظهر في كل دفعة (الأصناف كتير)

  const grid = document.getElementById('productGrid');
  const statusEl = document.getElementById('catalogStatus');
  const searchInput = document.getElementById('productSearch');
  const categoryBar = document.getElementById('categoryBar');
  const moreBtn = document.getElementById('catalogMore');

  if (!grid || !searchInput || !categoryBar) return;

  let allProducts = [];
  let activeFilter = 'الكل';   // الكل | متوفر
  let currentResults = [];
  let shown = 0;

  /* ------------------------------------------------------------------
     1) تحويل نص CSV إلى مصفوفة صفوف
     بيتعامل مع فواصل داخل نص محاط بعلامات اقتباس، وأسطر فاضية
     ------------------------------------------------------------------ */
  function parseCSV(text) {
    // إزالة BOM لو موجود (بيظهر لما الملف يتحفظ من إكسل بترميز UTF-8)
    text = text.replace(/^\uFEFF/, '');

    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const next = text[i + 1];

      if (inQuotes) {
        if (char === '"' && next === '"') {
          field += '"';
          i++;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          field += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          row.push(field);
          field = '';
        } else if (char === '\n' || char === '\r') {
          if (char === '\r' && next === '\n') i++;
          row.push(field);
          rows.push(row);
          row = [];
          field = '';
        } else {
          field += char;
        }
      }
    }
    // آخر حقل/صف لو الملف مش منتهي بسطر فاضي
    if (field.length > 0 || row.length > 0) {
      row.push(field);
      rows.push(row);
    }

    return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
  }

  /* ------------------------------------------------------------------
     2) تحويل صفوف CSV إلى كائنات منتجات، مع تجاهل أي صف فيه بيانات ناقصة
        أو تصنيف غير معروف (بدل ما يكسر الصفحة كلها)
     ------------------------------------------------------------------ */
  function rowsToProducts(rows) {
    if (rows.length === 0) return [];

    const header = rows[0].map((h) => h.trim());
    const nameIdx = header.indexOf('الاسم');
    const qtyIdx = header.indexOf('الكمية');
    const priceIdx = header.indexOf('السعر');

    if (nameIdx === -1 || qtyIdx === -1 || priceIdx === -1) {
      console.error('ملف الأصناف لازم يحتوي على الأعمدة: الاسم, الكمية, السعر');
      return [];
    }

    const products = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const name = (r[nameIdx] || '').trim();
      const qty = parseFloat((r[qtyIdx] || '').trim());
      const price = parseFloat((r[priceIdx] || '').trim());

      if (!name || Number.isNaN(qty) || Number.isNaN(price)) continue;

      // الاسم المطبَّع بيتحسب مرة واحدة هنا، عشان البحث يفضل سريع مع آلاف الأصناف
      products.push({ name, qty, price, key: normalize(name) });
    }
    return products;
  }

  /* ------------------------------------------------------------------
     3) تطبيع النص للبحث: إزالة التشكيل، توحيد أشكال الألف والياء والتاء
        المربوطة، تصغير الحروف الإنجليزية — عشان البحث يكون متسامح
     ------------------------------------------------------------------ */
  function normalize(str) {
    return str
      .toLowerCase()
      .replace(/[\u064B-\u0652]/g, '') // إزالة التشكيل
      .replace(/[إأآا]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)) // الأرقام العربية → إنجليزي
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* ------------------------------------------------------------------
     4) تحويل نص بحث المستخدم (ممكن يحتوي على *) إلى تعبير نمطي آمن
     ------------------------------------------------------------------ */
  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function buildSearchRegex(query) {
    const escaped = escapeRegExp(query).replace(/\\\*/g, '.*');
    try {
      return new RegExp(escaped, 'iu');
    } catch (e) {
      return null;
    }
  }

  /* ------------------------------------------------------------------
     5) حماية من XSS: أي نص جاي من ملف البيانات بيتعرض كنص عادي فقط،
        مش HTML — حتى لو كان فيه رموز زي < أو >
     ------------------------------------------------------------------ */
  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatPrice(price) {
    return price.toLocaleString('ar-EG', { maximumFractionDigits: 2 }) + ' جنيه';
  }

  /* ------------------------------------------------------------------
     6) رسم كروت المنتجات — على دفعات (PAGE_SIZE) مع زرار "عرض المزيد"
     ------------------------------------------------------------------ */
  function formatQty(q) {
    return Number.isInteger(q) ? String(q) : String(Math.round(q * 100) / 100);
  }

  function makeCard(p) {
    const card = document.createElement('div');
    card.className = 'catalog-card reveal';

    const availability = p.qty > 0
      ? `<span class="stock-badge in-stock">متوفر — الكمية: ${escapeHTML(formatQty(p.qty))}</span>`
      : `<span class="stock-badge out-of-stock">غير متوفر حاليًا</span>`;

    card.innerHTML = `
      <h3 class="catalog-card-name">${escapeHTML(p.name)}</h3>
      ${availability}
      <p class="catalog-card-price">${formatPrice(p.price)}</p>
    `;
    return card;
  }

  function renderNextBatch() {
    const fragment = document.createDocumentFragment();
    const end = Math.min(shown + PAGE_SIZE, currentResults.length);
    for (let i = shown; i < end; i++) fragment.appendChild(makeCard(currentResults[i]));
    grid.appendChild(fragment);
    shown = end;

    if (window.observeRevealElements) {
      window.observeRevealElements(grid.querySelectorAll('.reveal:not(.reveal-seen)'));
      grid.querySelectorAll('.reveal').forEach((el) => el.classList.add('reveal-seen'));
    }

    if (moreBtn) {
      moreBtn.style.display = shown < currentResults.length ? 'inline-block' : 'none';
      moreBtn.textContent = `عرض المزيد (${(currentResults.length - shown).toLocaleString('ar-EG')} صنف متبقي)`;
    }
    statusEl.textContent = `${currentResults.length.toLocaleString('ar-EG')} صنف`;
    statusEl.style.display = 'block';
  }

  function renderProducts(products) {
    grid.innerHTML = '';
    currentResults = products;
    shown = 0;

    if (products.length === 0) {
      if (moreBtn) moreBtn.style.display = 'none';
      statusEl.textContent = 'مفيش نتائج مطابقة. جرّب كلمة تانية أو استخدم * بدل الحروف اللي مش متأكد منها.';
      statusEl.style.display = 'block';
      return;
    }
    renderNextBatch();
  }

  /* ------------------------------------------------------------------
     7) تطبيق البحث + فلتر "متوفر" معًا
        البحث: كل كلمة بتكتبها لازم تكون موجودة في الاسم (بأي ترتيب)،
        ويشتغل معاها * زي ما كان
     ------------------------------------------------------------------ */
  function applyFilters() {
    const rawQuery = searchInput.value.trim();
    let results = allProducts;

    if (activeFilter === 'متوفر') {
      results = results.filter((p) => p.qty > 0);
    }

    if (rawQuery) {
      const regexes = normalize(rawQuery)
        .split(' ')
        .filter(Boolean)
        .map(buildSearchRegex)
        .filter(Boolean);
      if (regexes.length) {
        results = results.filter((p) => regexes.every((re) => re.test(p.key)));
      }
    }

    renderProducts(results);
  }

  // تأخير بسيط بعد الكتابة عشان الأداء يبقى سلس مع قوائم كبيرة
  let debounceTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(applyFilters, 150);
  });

  categoryBar.addEventListener('click', (e) => {
    const btn = e.target.closest('.category-btn');
    if (!btn) return;

    categoryBar.querySelectorAll('.category-btn').forEach((b) => {
      b.classList.remove('is-active');
      b.setAttribute('aria-selected', 'false');
    });
    btn.classList.add('is-active');
    btn.setAttribute('aria-selected', 'true');

    activeFilter = btn.dataset.category;
    applyFilters();
  });

  if (moreBtn) moreBtn.addEventListener('click', renderNextBatch);

  /* ------------------------------------------------------------------
     8) تحميل البيانات
     ------------------------------------------------------------------ */
  fetch(DATA_URL)
    .then((res) => {
      if (!res.ok) throw new Error('تعذر تحميل ملف الأصناف');
      return res.text();
    })
    .then((text) => {
      allProducts = rowsToProducts(parseCSV(text));
      if (allProducts.length === 0) {
        statusEl.textContent = 'مفيش أصناف متاحة حاليًا.';
        statusEl.style.display = 'block';
        return;
      }
      applyFilters();
    })
    .catch(() => {
      statusEl.textContent = 'تعذر تحميل بيانات الأصناف. لو بتجرب الموقع من على جهازك مباشرة، لازم تشغّله من سيرفر محلي بسيط أو ترفعه أونلاين عشان التحميل يشتغل.';
      statusEl.style.display = 'block';
    });
})();
