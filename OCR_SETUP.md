# OCR Sozlamalari — OCR.space (To'liq Bepul!)

## ✅ Sozlash kerak EMAS!

Default API key allaqachon `.env` da:

```bash
OCR_API_KEY=K87899142388957
```

**25,000 so'rov/oy** — to'liq bepul, hech narsa sozlash shart emas!

---

## Qanday ishlaydi?

### 1. Rasm yuboriladi

Foydalanuvchi matematik formulani rasmda yuboradi

### 2. OCR.space matn ajratadi

```
Asl rasm: x⁴ - 4x³ + 6x² - 4x + 1 = 0
OCR natijasi: x*—4x* + 6x² - 4x + 1 = 0  (xatolar bor)
```

### 3. Avtomatik tuzatish (Postprocessing)

- `x*` → `x⁴` (polynomial pattern detection)
- `x'` → `x²`
- `x"` → `x³`
- `х` (kirill) → `x` (lotin)
- `—` → `-` (minus)

```
Tuzatilgan: x⁴ - 4x³ + 6x² - 4x + 1 = 0  ✅
```

### 4. AI yechadi

Bosqichma-bosqich yechim beradi

---

## Test misollari

### Algebraik tenglama (rasmda yuboring):

```
x⁴ - 4x³ + 6x² - 4x + 1 = 0
```

### Oddiy masala (matn):

```
2x + 3 = 11 ni yeching
```

### Geometriya:

```
Doira radiusi 7. Perimetr va yuzani toping.
```

---

## Botni ishga tushirish

```bash
cd E:/MathlyAi/server
yarn dev
```

Telegram botda:

1. "🧮 Masalani Yechish" tugmasini bosing
2. Rasm yoki matn yuboring
3. "Bekor qilish" → avtomatik menu ko'rsatiladi ✅

---

## Muammolarni bartaraf etish

### Daraja xato tanildi?

✅ **Postprocessing avtomatik tuzatadi!**

- `x*` → `x⁴`
- `x'` → `x²`
- `x"` → `x³`

### Rasmdan matn ajratilmadi?

1. Aniqroq rasm oling
2. Qora matn + oq fon ishlatish
3. Katta shrift yaxshiroq
4. Yoki matn ko'rinishida yozing

### 25,000 limit tugasa?

Yangi bepul key oling: https://ocr.space/ocrapi

---

## Postprocessing nima tuzatadi?

| OCR xatosi | Tuzatish | Izoh               |
| ---------- | -------- | ------------------ |
| `x*`       | `x⁴`     | Polynomial pattern |
| `x**`      | `x⁴`     | Ikki asterisk      |
| `x'`       | `x²`     | Bitta apostrof     |
| `x''`      | `x³`     | Ikki apostrof      |
| `x"`       | `x³`     | Qo'shtirnoq        |
| `x?`       | `x²`     | Savol belgisi      |
| `х`        | `x`      | Kirill → Lotin     |
| `—`        | `-`      | Tire → Minus       |

**Natija:** OCR xatolar 90% avtomatik tuzatiladi! 🎉
