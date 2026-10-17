#!/usr/bin/env python3
"""
تحويل تقرير "كميات أصناف الصيدلية" (E-Plus PDF) إلى data/products.csv

الاستخدام:
    python tools/pdf_to_csv.py ملف.pdf                 # الناتج: data/products.csv
    python tools/pdf_to_csv.py ملف.pdf -o مكان/تاني.csv
    python tools/pdf_to_csv.py ملف.pdf --in-stock-only # المتوفر بس

المطلوب: pip install pdfplumber

الأمان: الملف الناتج فيه (الاسم، الكمية، السعر) بس. التكلفة ونسبة الربح
واسم الشركة مش بتتنقل للموقع نهائيًا.
"""
import argparse
import csv
import multiprocessing as mp
import os
import re
import sys
import unicodedata
from collections import defaultdict
from decimal import Decimal

import pdfplumber

# ---- مواضع الأعمدة في التقرير (بالنقطة) — ثابتة في تقرير E-Plus ----------
# الأرقام محاذاة لليمين، فبنعتمد على الحافة اليمنى (x1) لكل رقم
NUM_COLS = [  # (الاسم, x1 المتوقع)
    ("pct", 60), ("total_sell", 124), ("total_cost", 198),
    ("price", 253), ("cost", 316), ("qty", 368),
]
NUM_REGION_MAX = 378      # أي حاجة على يسار ده = أعمدة أرقام
COMPANY_MIN = 445         # عمود الشركة بيبدأ من هنا ويخلص قبل الاسم
NAME_MIN = 503.5          # الاسم بيبدأ من هنا
ROW_TOL = 4.0             # أقصى فرق رأسي بين حروف نفس السطر

NUM_RE = re.compile(r"^-?[\d,]*\.?\d+$")

FIXES = {  # حروف فارسية طالعة من التحويل → حروف عربي عادية
    "\u06cc": "\u064a", "\u06be": "\u0647", "\u06a9": "\u0643",
    "\u0640": "",  # تطويلة
}


def clean_char(t):
    t = unicodedata.normalize("NFKC", t)
    return "".join(FIXES.get(ch, ch) for ch in t)


def rtl_kind(ch):
    b = unicodedata.bidirectional(ch)
    if b in ("AL", "R", "AN"):
        return "R"
    if b in ("L", "EN"):
        return "L"
    return None  # محايد


def build_text(chars):
    """chars: حروف الخلية بترتيب الـ stream (وهو الترتيب المنطقي الصح).
    الـ PDF بيشيل المسافة عند تغيير الاتجاه (عربي↔إنجليزي)، فبنرجّعها من الفجوة."""
    out = []
    runs = []  # [kind, x0, x1, start_idx_in_out]
    for c in chars:
        txt = clean_char(c["text"])
        if not txt:
            continue
        k = rtl_kind(txt[0])
        if txt.isspace():
            out.append(" ")
            runs.append(None)
            continue
        prev = runs[-1] if runs else None
        if k is not None and prev and prev[0] is not None and prev[0] != k:
            gap = min(c["x0"], prev[2] and c["x0"]) if False else None
        out.append(txt)
        runs.append([k, c["x0"], c["x1"]])
    # مرحلة تانية: إدخال مسافات عند حدود الاتجاه لو فيه فجوة ≥ 1.5 نقطة
    res = []
    run_kind, run_min, run_max = None, None, None
    last_nonspace_kind = None
    for ch, info in zip(out, runs):
        if info is None:  # مسافة
            res.append(" ")
            run_kind, run_min, run_max = None, None, None
            last_nonspace_kind = None
            continue
        k, x0, x1 = info
        if k is None:  # رمز محايد: يتبع الجار
            res.append(ch)
            if run_kind is not None:
                run_min, run_max = min(run_min, x0), max(run_max, x1)
            continue
        if run_kind is not None and k != run_kind:
            gap = x0 - run_max  # الجملة LTR: الخلية الجاية على يمين اللي قبلها
            gap2 = run_min - x1  # احتياطي لو اتجاه الصف معكوس
            if max(gap, gap2) >= 1.5:
                res.append(" ")
            run_kind, run_min, run_max = k, x0, x1
        elif run_kind is None:
            run_kind, run_min, run_max = k, x0, x1
        else:
            run_min, run_max = min(run_min, x0), max(run_max, x1)
        res.append(ch)
    s = "".join(res)
    s = re.sub(r"[\u200e\u200f\u202a-\u202e\u2066-\u2069]", "", s)
    return re.sub(r"\s+", " ", s).strip()


def to_num(s):
    return Decimal(s.replace(",", ""))


def parse_page(args):
    pdf_path, pno = args
    with pdfplumber.open(pdf_path) as pdf:
        page = pdf.pages[pno]
        chars = [dict(c, _i=i) for i, c in enumerate(page.chars)]
    for c in chars:
        c["cy"] = (c["top"] + c["bottom"]) / 2
    # تجميع الحروف في أسطر حسب الارتفاع
    chars_sorted = sorted(chars, key=lambda c: c["cy"])
    lines, cur = [], []
    for c in chars_sorted:
        if cur and c["cy"] - cur[-1]["cy"] > ROW_TOL:
            lines.append(cur)
            cur = []
        cur.append(c)
    if cur:
        lines.append(cur)

    rows, extra = [], {"count": None, "orphans": []}
    for ln in lines:
        ln.sort(key=lambda c: c["_i"])
        # الأرقام: نجمّع الحروف اللي في منطقة الأرقام لتوكنز بالفجوات
        numchars = sorted([c for c in ln if c["x1"] <= NUM_REGION_MAX], key=lambda c: c["x0"])
        toks, tcur = [], []
        for c in numchars:
            if c["text"].isspace():
                continue
            if tcur and c["x0"] - tcur[-1]["x1"] > 2.5:
                toks.append(tcur)
                tcur = []
            tcur.append(c)
        if tcur:
            toks.append(tcur)
        toks = [("".join(c["text"] for c in t), t[-1]["x1"]) for t in toks]
        numeric = [(s, x1) for s, x1 in toks if NUM_RE.match(s.replace("%", ""))]
        text_all = "".join(clean_char(c["text"]) for c in ln)

        # صف الإجمالي في آخر صفحة (عدد الأصناف)
        if ("ددع" in text_all or "عدد" in text_all) and numeric:
            # عدد الأصناف مكتوب على يمين الصف (x > 400) جنب كلمة "عدد الأصناف"
            digs = sorted([c for c in ln if c["x0"] >= 400 and (c["text"].isdigit() or c["text"] == ",")],
                          key=lambda c: c["x0"])
            cnt = "".join(c["text"] for c in digs).strip(",")
            if cnt.replace(",", "").isdigit():
                extra["count"] = int(cnt.replace(",", ""))
            continue
        if ("ىلامجلإا" in text_all or "الإجمالي" in text_all) and not numeric:
            continue

        if len(numeric) < 6 or not any("%" in s for s, _ in numeric):
            # سطر مش صف بيانات؛ لو فيه نص في منطقة الاسم نسجله كـ "يتيم"
            nm = [c for c in ln if c["x0"] >= NAME_MIN and c["x0"] < 700]
            if nm and pno >= 0 and len(numeric) == 0:
                t = build_text(nm)
                if t and not re.match(r"^(Page \d+ of \d+|Copyright|E-Plus)", t):
                    extra["orphans"].append((pno + 1, t))
            continue

        # ربط كل رقم بعموده بأقرب حافة يمنى
        vals = {}
        pct_tok = [s for s, _ in numeric if "%" in s]
        nums = [(s, x1) for s, x1 in numeric if "%" not in s]
        for name, ex in NUM_COLS[1:]:
            best = min(nums, key=lambda t: abs(t[1] - ex), default=None)
            if best and abs(best[1] - ex) < 12:
                vals[name] = best[0]
        if len(vals) != 5:
            extra["orphans"].append((pno + 1, "عمود رقمي ناقص: " + str(numeric)))
            continue

        name_chars = [c for c in ln if c["x0"] >= NAME_MIN]
        comp_chars = [c for c in ln if COMPANY_MIN <= c["x0"] < NAME_MIN and c["x1"] <= NAME_MIN]
        name = build_text(name_chars)
        company = build_text(comp_chars)
        rows.append({
            "page": pno + 1,
            "name": name, "company": company,
            "qty": to_num(vals["qty"]), "price": to_num(vals["price"]),
            "total_sell": to_num(vals["total_sell"]), "total_cost": to_num(vals["total_cost"]),
        })
    return rows, extra


def convert(pdf_path, out_path, in_stock_only=False, workers=None):
    with pdfplumber.open(pdf_path) as pdf:
        n = len(pdf.pages)
    workers = workers or max(1, min(os.cpu_count() or 1, 8))
    jobs = [(pdf_path, i) for i in range(n)]
    if workers > 1:
        with mp.Pool(workers) as pool:
            results = pool.map(parse_page, jobs, chunksize=4)
    else:
        results = [parse_page(j) for j in jobs]

    rows, orphans, declared = [], [], None
    for r, ex in results:
        rows.extend(r)
        orphans.extend(ex["orphans"])
        if ex["count"] is not None:
            declared = ex["count"]
    return n, rows, orphans, declared


def main():
    ap = argparse.ArgumentParser(description="PDF أصناف E-Plus → products.csv")
    ap.add_argument("pdf")
    ap.add_argument("-o", "--out", default=os.path.join("data", "products.csv"))
    ap.add_argument("--in-stock-only", action="store_true", help="اكتب الأصناف المتوفرة بس")
    ap.add_argument("--workers", type=int, default=None)
    ap.add_argument("--min-ratio", type=float, default=0.5,
                    help="لو عدد الأصناف أقل من النسبة دي من الملف القديم، وقّف (حماية)")
    a = ap.parse_args()

    n, rows, orphans, declared = convert(a.pdf, a.out, a.in_stock_only, a.workers)
    print(f"صفحات: {n} | صفوف مقروءة: {len(rows)} | إجمالي معلن في التقرير: {declared}")

    errors = []
    if len(rows) == 0:
        errors.append("ملقيتش ولا صنف — الملف ده مش تقرير الأصناف المعتاد.")
    if declared is not None and declared != len(rows):
        errors.append(f"عدد الأصناف المقروء ({len(rows)}) مش مطابق للمكتوب في آخر صفحة ({declared}).")
    for r in rows:  # فحص حسابي: الكمية × السعر = إجمالي البيع
        if abs(r["qty"] * r["price"] - r["total_sell"]) > Decimal("1.5"):
            errors.append(f"صفحة {r['page']}: حساب غير مطابق في «{r['name']}»")
            break
    if orphans:
        print(f"تنبيه: {len(orphans)} سطر مش مفهوم (مثال: {orphans[:3]})")
    empty = [r for r in rows if not r["name"]]
    if empty:
        errors.append(f"{len(empty)} صنف بدون اسم")

    if errors:
        print("❌ التحويل اتوقف:\n - " + "\n - ".join(errors), file=sys.stderr)
        sys.exit(2)

    products = [r for r in rows if (r["qty"] > 0 or not a.in_stock_only)]
    # المتوفر الأول، وبعدين أبجديًا
    products.sort(key=lambda r: (0 if r["qty"] > 0 else 1, r["name"].casefold()))

    if os.path.exists(a.out):  # حماية: ماتمسحش الموقع لو الملف الجديد أصغر بكتير
        with open(a.out, encoding="utf-8-sig") as f:
            old = max(0, sum(1 for _ in f) - 1)
        if old > 100 and len(products) < old * a.min_ratio:
            print(f"❌ الملف الجديد ({len(products)}) أقل بكتير من القديم ({old}). مراجعة يدوية مطلوبة.", file=sys.stderr)
            sys.exit(3)

    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    with open(a.out, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["الاسم", "الكمية", "السعر"])
        for r in products:
            q = r["qty"].normalize()
            w.writerow([r["name"], format(q, "f") if q == q.to_integral() else format(q.quantize(Decimal("0.001")).normalize(), "f"),
                        format(r["price"].normalize(), "f")])
    instock = sum(1 for r in products if r["qty"] > 0)
    print(f"✅ تم: {len(products)} صنف ({instock} متوفر) → {a.out}")


if __name__ == "__main__":
    main()
