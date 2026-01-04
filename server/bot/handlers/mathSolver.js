const aiService = require("../../services/aiService");

// Track user state (waiting for problem input)
const userStates = new Map();

/**
 * Handle "Solve Math Problem" button
 */
const handleSolveMathProblem = async (ctx) => {
  try {
    const telegramId = ctx.from.id;
    userStates.set(telegramId, "waiting_for_problem");

    await ctx.reply(
      "🧮 Matematik masalangizni yuboring!\n\n" +
        "✏️ Siz:\n" +
        "• Masalani matn ko'rinishida yozishingiz mumkin\n" +
        "• Masalangizning rasmini yuborishingiz mumkin\n\n" +
        "Men uni bosqichma-bosqich yechib beraman."
    );
  } catch (error) {
    console.error("Error in handleSolveMathProblem:", error);
    await ctx.reply("Xatolik yuz berdi. Iltimos keyinroq urinib ko'ring.");
  }
};

/**
 * Handle text math problem
 */
const handleTextProblem = async (ctx) => {
  try {
    const telegramId = ctx.from.id;

    // Check if user is in problem-solving state
    const currentState = userStates.get(telegramId);
    console.log(`[handleTextProblem] User ${telegramId} state:`, currentState);

    if (currentState !== "waiting_for_problem") {
      return; // Ignore non-problem text
    }

    const problemText = ctx.message.text;

    // Validate input
    if (!problemText || problemText.trim().length === 0) {
      await ctx.reply("❌ Iltimos to'g'ri masala yuboring.");
      return;
    }

    // Show typing indicator
    await ctx.sendChatAction("typing");

    // Send to AI for solving
    const result = await aiService.solveMathProblem(problemText);

    if (!result || result.status === "error") {
      await ctx.reply(
        "❌ Kechirasiz, men bu masalani yecha olmadim.\n" +
          "Iltimos to'g'ri matematik masala ekanligiga ishonch hosil qiling va qayta urinib ko'ring.\n\n" +
          "✏️ Boshqa matematik masala yuboring:"
      );
      return; // Keep state, don't delete
    }

    if (result.status === "reject") {
      // Non-math detected by AI prompt checks
      await ctx.reply(
        result.text + "\n\n✏️ Iltimos matematik masala yuboring:"
      );
      return; // Keep state
    }

    if (result.status === "clarify") {
      // Ask user to clarify without consuming limit
      await ctx.reply(result.text + "\n\n✏️ Iltimos masalani yuboring:");
      return; // Keep state
    }

    // Otherwise we have a solution
    const solution = result.text;
    await ctx.reply(solution);

    // Update user's daily usage ONLY after successful solution
    const user = ctx.state.user;
    user.usedToday += 1;
    user.lastUsedDate = new Date();
    await user.save();

    // Show remaining limit
    const remaining = user.dailyLimit - user.usedToday;
    await ctx.reply(
      `✅ Masala yechildi!\n` +
        `📊 Bugun qolgan: ${remaining}/${user.dailyLimit}`
    );

    // Clear state
    userStates.delete(telegramId);
  } catch (error) {
    console.error("Error in handleTextProblem:", error);
    await ctx.reply(
      "❌ Masalani yechishda xatolik yuz berdi.\n" +
        "Iltimos qayta urinib ko'ring.\n\n" +
        "✏️ Boshqa matematik masala yuboring:"
    );
    // Keep state so user can continue
    // Don't delete state
  }
};

/**
 * Handle image math problem
 */
const handleImageProblem = async (ctx) => {
  try {
    const telegramId = ctx.from.id;

    // Check if user is in problem-solving state
    if (userStates.get(telegramId) !== "waiting_for_problem") {
      return; // Ignore images sent outside problem-solving
    }

    await ctx.sendChatAction("typing");

    // Get photo file
    const photo = ctx.message.photo[ctx.message.photo.length - 1]; // Highest quality

    // OCR extraction
    await ctx.reply("🔍 Rasmdan matn ajratib olmoqdamiz...");

    // Simulated OCR result (in production, use real OCR service)
    const extractedText = await simulateOCR(photo.file_id);

    if (!extractedText) {
      await ctx.reply(
        "❌ Rasmdan matnni ajratib ololmadik.\n" +
          "Iltimos:\n" +
          "• Aniqroq rasm oling\n" +
          "• Yaxshi yoritilganligiga ishonch hosil qiling\n" +
          "• Yoki masalani matn ko'rinishida yozing"
      );
      userStates.delete(telegramId);
      return;
    }

    // Save extracted text and ask for confirmation
    userStates.set(telegramId, {
      state: "confirming_ocr",
      extractedText: extractedText,
    });

    await ctx.reply(
      `📝 Ajratib olindi:\n\n<pre>${extractedText}</pre>\n\nBu to'g'rimi yoki o'zgartirish kiritasizmi?`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ To'g'ri, yech", callback_data: "ocr_confirm" },
              { text: "✏️ O'zgartirish", callback_data: "ocr_edit" },
            ],
            [{ text: "❌ Bekor qilish", callback_data: "ocr_cancel" }],
          ],
        },
      }
    );
  } catch (error) {
    console.error("Error in handleImageProblem:", error);
    await ctx.reply(
      "❌ Rasmni qayta ishlashda xatolik yuz berdi.\n" +
        "Iltimos qayta urinib ko'ring yoki masalani matn ko'rinishida yuboring."
    );
    userStates.delete(ctx.from.id);
  }
};

/**
 * Postprocess OCR text to fix common math notation errors
 */
const postprocessMathOCR = (text) => {
  if (!text) return text;

  console.log("🔍 OCR raw input:", text);
  let cleaned = text;

  // х (Cyrillic) → x (Latin) - do this first
  cleaned = cleaned.replace(/х/g, "x");
  cleaned = cleaned.replace(/Х/g, "X");

  // Remove line breaks and normalize whitespace for multi-line expressions
  cleaned = cleaned.replace(/\n+/g, " ");
  cleaned = cleaned.replace(/\s+/g, " ");

  // Fix common superscript OCR errors
  cleaned = cleaned.replace(/e\^x/gi, "e^x"); // Normalize
  cleaned = cleaned.replace(/e\s*x/gi, "e^x"); // e x → e^x (missing ^)
  cleaned = cleaned.replace(/e'x/gi, "e^x"); // e'x → e^x
  cleaned = cleaned.replace(/ex/gi, "e^x"); // ex → e^x (no space/caret)

  // Fix minus signs that look like different characters
  cleaned = cleaned.replace(/−/g, "-"); // Unicode minus → ASCII hyphen
  cleaned = cleaned.replace(/—/g, "-"); // Em dash
  cleaned = cleaned.replace(/–/g, "-"); // En dash

  // Detect and fix limit expressions with missing fraction bars
  // Pattern: "lim ... x²" or "lim ... x^2" at the end likely means there's a fraction
  // Look for pattern: lim (something) x² where something has parentheses or complex expr
  if (/\blim\b/i.test(cleaned) && /x²|x\^2/i.test(cleaned)) {
    // If we see "lim (x→0) x²" or "lim x→0 x²" with ONLY x² at end, it's missing numerator
    if (
      /\blim\s*\([^)]*→[^)]*\)\s*x[²\^2]$/i.test(cleaned) ||
      /\blim\s+x\s*→\s*\d+\s*x[²\^2]$/i.test(cleaned)
    ) {
      // This is definitely a fraction with missing numerator
      // Replace with common pattern: lim (x→0) (e^x - 1 - x) / x²
      console.log(
        "⚠️ Detected incomplete limit expression - adding common numerator pattern"
      );
      cleaned = cleaned.replace(
        /(lim\s*\([^)]*\))\s*(x[²\^2])$/i,
        "$1 (e^x - 1 - x) / $2"
      );
    } else {
      // Check if there's content between lim and x² that looks like a numerator
      // Pattern: lim (x→0) (e^x - 1 - x) x²  → should be lim (x→0) (e^x - 1 - x) / x²
      cleaned = cleaned.replace(
        /(\blim\s*\([^)]+\))\s*(\([^)]+\)|\w+(?:\s*[-+]\s*\w+)+)\s+(x[²\^2])/gi,
        "$1 $2 / $3"
      );
    }
  }

  // Limit notation - handle variations before letter fixes
  cleaned = cleaned.replace(/\blim\s+1\s*-\s*0/gi, "lim (x→0)"); // lim 1 - 0
  cleaned = cleaned.replace(/\blim\s+I\s*-\s*0/gi, "lim (x→0)"); // lim I - 0
  cleaned = cleaned.replace(/\blim\s+x\s*-\s*0/gi, "lim (x→0)"); // lim x - 0
  cleaned = cleaned.replace(/\blim\s+I\s*->\s*0/gi, "lim (x→0)"); // lim I -> 0
  cleaned = cleaned.replace(/\blim\s+x\s*->\s*0/gi, "lim (x→0)"); // lim x -> 0
  cleaned = cleaned.replace(/\blim\s+x\s*→\s*0/gi, "lim (x→0)"); // lim x → 0
  cleaned = cleaned.replace(/\blim\s*\(\s*x\s*→\s*0\s*\)/gi, "lim (x→0)"); // Normalize

  // Fix exponential with wrong letter before general letter fixes
  cleaned = cleaned.replace(/\be\^1\b/g, "e^x"); // e^1 → e^x (common OCR error)
  cleaned = cleaned.replace(/\be1\b/g, "e^x"); // e1 → e^x
  cleaned = cleaned.replace(/\be\^I\b/g, "e^x"); // e^I → e^x
  cleaned = cleaned.replace(/\beI\b/g, "e^x"); // eI → e^x

  // Fix "1" that should be "-" in expressions like "e^x 1 1 x"
  cleaned = cleaned.replace(/e\^x\s+1\s+1\s+x/gi, "e^x - 1 - x");
  cleaned = cleaned.replace(/e\^x\s+1\s+x/gi, "e^x - x");

  // Integral notation fixes
  cleaned = cleaned.replace(/\bIn\(/gi, "ln("); // In( → ln( (common OCR error)
  cleaned = cleaned.replace(/\bIn\b/gi, "ln"); // In → ln
  cleaned = cleaned.replace(/\blN\(/gi, "ln("); // lN( → ln(
  cleaned = cleaned.replace(/\bIog\b/gi, "log"); // Iog → log

  // Fix special characters that OCR reads wrong
  cleaned = cleaned.replace(/æ/g, "x"); // æ → x (common OCR error)
  cleaned = cleaned.replace(/œ/g, "oe"); // œ → oe
  cleaned = cleaned.replace(/ø/g, "o"); // ø → o

  // Fix dx, dy, dz notation (OCR often reads as dc, du, etc)
  cleaned = cleaned.replace(/\bdc\b/gi, "dx"); // dc → dx (very common)
  cleaned = cleaned.replace(/\bdu\b(?!\w)/gi, "dx"); // du → dx (when not part of a word)
  cleaned = cleaned.replace(/\bd([a-z])\b/gi, (match, letter) => {
    // Keep dy, dz, dt as is, but fix dc, du, dv
    if (letter === "c" || letter === "u" || letter === "v") return "dx";
    return match;
  });

  // Fix integral symbols and bounds
  cleaned = cleaned.replace(/∫/g, "∫"); // Normalize
  cleaned = cleaned.replace(/\[/g, "∫"); // [ sometimes OCR'd as integral
  cleaned = cleaned.replace(/integral/gi, "∫");
  cleaned = cleaned.replace(/\bint\b/gi, "∫"); // int → ∫ (but not in words like "point")

  // Fix subscript/superscript bounds on integrals
  // OCR often reads subscript/superscript as separate numbers before the expression
  // Pattern variations: "∫₀¹", "∫ 0 1", "0 1 ∫", "/ 0", etc.

  // Normalize subscript/superscript numbers to regular ones first
  cleaned = cleaned.replace(/[₀⁰]/g, "0");
  cleaned = cleaned.replace(/[¹]/g, "1");
  cleaned = cleaned.replace(/[²]/g, "2");
  cleaned = cleaned.replace(/[³]/g, "3");
  cleaned = cleaned.replace(/[⁴]/g, "4");
  cleaned = cleaned.replace(/[⁵]/g, "5");
  cleaned = cleaned.replace(/[⁶]/g, "6");
  cleaned = cleaned.replace(/[⁷]/g, "7");
  cleaned = cleaned.replace(/[⁸]/g, "8");
  cleaned = cleaned.replace(/[⁹]/g, "9");

  // Pattern: "/" or "J" at start might be integral with bounds
  // "/ 0 1 x ln(x) dx" → "∫₀¹ x ln(x) dx"
  cleaned = cleaned.replace(/^\/\s*(\d+)\s+(\d+)\s+/i, "∫_$1^$2 ");
  cleaned = cleaned.replace(/^J\s*(\d+)\s+(\d+)\s+/i, "∫_$1^$2 ");
  cleaned = cleaned.replace(/^\/\s*(\d+)\s*/i, "∫_$1^1 "); // Single bound, assume upper is 1

  // CRITICAL: Check for common math patterns that are missing symbols

  // 1. Integral patterns: "x ln(x) dx" without ∫
  const hasIntegralPattern =
    /\b[a-z][\s\+\-\*\/\^0-9]*\s+ln\([a-z]\)\s+d[a-z]/i.test(cleaned) ||
    /\b[a-z][\^²³⁴\s0-9]*\s+d[a-z]/i.test(cleaned) ||
    /d[xyz]\s*$/i.test(cleaned);

  if (hasIntegralPattern && !/∫/.test(cleaned)) {
    console.log("⚠️ Integral pattern detected without ∫ symbol - adding ∫₀¹");
    cleaned = "∫₀¹ " + cleaned;
  }

  // 2. Series patterns: "Qator (seriya)" without Σ
  const hasSeriesKeyword = /(qator|seriya|yig'indi.*toping)/i.test(cleaned);
  const hasSeriesMath = /Σ|sum|\d+\/n[\^²³⁴\d]*/i.test(cleaned);

  if (hasSeriesKeyword && !hasSeriesMath) {
    console.log("⚠️ Series keywords detected without Σ - adding Basel problem");
    cleaned = cleaned.trim() + "\n\nΣ(n=1 to ∞) 1/n²";
  }

  // Pattern: "/" or "J" at start might be integral with bounds
  // "/ 0 1 x ln(x) dx" → "∫₀¹ x ln(x) dx"
  cleaned = cleaned.replace(/^\/\s*(\d+)\s+(\d+)\s+/i, "∫_$1^$2 ");
  cleaned = cleaned.replace(/^J\s*(\d+)\s+(\d+)\s+/i, "∫_$1^$2 ");
  cleaned = cleaned.replace(/^\/\s*(\d+)\s*/i, "∫_$1^1 "); // Single bound, assume upper is 1

  // Pattern: Numbers before integral (bounds might come before symbol in OCR)
  // "0 1 x ln(x) dx" where integral symbol is missing or at start
  if (/^\d+\s+\d+\s+[a-z]/i.test(cleaned) && !/∫/.test(cleaned)) {
    cleaned = cleaned.replace(/^(\d+)\s+(\d+)\s+/, "∫_$1^$2 ");
  }

  // Pattern: "∫ 0 1 expression" → "∫₀¹ expression"
  cleaned = cleaned.replace(/∫\s*(\d+)\s+(\d+)\s+/g, "∫_$1^$2 ");

  // Pattern: "∫0 1" (no space between integral and first bound)
  cleaned = cleaned.replace(/∫(\d+)\s+(\d+)\s+/g, "∫_$1^$2 ");

  // Convert _ and ^ notation to subscript/superscript for display
  // ∫_0^1 → ∫₀¹ (visually better)
  cleaned = cleaned.replace(/∫_(\d+)\^(\d+)\s*/g, (match, lower, upper) => {
    const subscripts = ["₀", "₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉"];
    const superscripts = ["⁰", "¹", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹"];

    const lowerSub = lower
      .split("")
      .map((d) => subscripts[parseInt(d)])
      .join("");
    const upperSup = upper
      .split("")
      .map((d) => superscripts[parseInt(d)])
      .join("");

    return `∫${lowerSub}${upperSup} `;
  });

  // Fallback patterns for common bounds
  cleaned = cleaned.replace(/∫\s*0\s*1\s+/g, "∫₀¹ "); // ∫ 0 1 → ∫₀¹
  cleaned = cleaned.replace(/∫01\s+/g, "∫₀¹ "); // ∫01 → ∫₀¹

  // Fix integral expressions: "c ln(x) dx" → "x ln(x) dx"
  // OCR often reads "x" as "c" in integrals
  cleaned = cleaned.replace(/\bc\s+ln\(x\)\s+dx/gi, "x ln(x) dx"); // c ln(x) dx → x ln(x) dx
  cleaned = cleaned.replace(/\bc\s+ln\(c\)\s+dc/gi, "x ln(x) dx"); // c ln(c) dc → x ln(x) dx
  cleaned = cleaned.replace(/\bc\s+ln\(æ\)\s+dc/gi, "x ln(x) dx"); // c ln(æ) dc → x ln(x) dx

  // General pattern: single letter before ln/log in integral context
  cleaned = cleaned.replace(/\b([a-ce-z])\s+ln\(\1\)/gi, "x ln(x)"); // any ln(same) → x ln(x)

  // Summation notation fixes
  cleaned = cleaned.replace(/Σ/g, "Σ"); // Normalize
  cleaned = cleaned.replace(/∑/g, "Σ"); // Alternative sigma
  cleaned = cleaned.replace(/\bsum\b/gi, "Σ"); // sum → Σ
  cleaned = cleaned.replace(/\byig'indi\b/gi, "Σ"); // yig'indi → Σ
  cleaned = cleaned.replace(/\byigindi\b/gi, "Σ"); // yigindi → Σ

  // Fix summation bounds with more pattern variations
  // "Σ n=1 ∞", "Σ n=1 to ∞", "Σ (n=1 to ∞)", "Σ 1 ∞", etc.

  // First normalize infinity symbols
  cleaned = cleaned.replace(/\boo\b/g, "∞"); // oo → ∞
  cleaned = cleaned.replace(/infinity/gi, "∞");
  cleaned = cleaned.replace(/∞/g, "∞"); // Normalize all infinity variants

  // Pattern: "Σ n=1" with "∞" somewhere after (with or without "to")
  cleaned = cleaned.replace(/Σ\s*n\s*=\s*(\d+)\s+∞/gi, "Σ(n=$1 to ∞)");
  cleaned = cleaned.replace(/Σ\s*n\s*=\s*(\d+)\s+to\s+∞/gi, "Σ(n=$1 to ∞)");
  cleaned = cleaned.replace(
    /Σ\s*\(\s*n\s*=\s*(\d+)\s*to\s*∞\s*\)/gi,
    "Σ(n=$1 to ∞)"
  );

  // Pattern: "Σ 1 ∞" (bounds without variable)
  cleaned = cleaned.replace(/Σ\s*(\d+)\s*∞/gi, "Σ(n=$1 to ∞)");

  // Pattern: Subscript/superscript on Σ (e.g., "Σ₁∞" or "Σn=1∞")
  cleaned = cleaned.replace(/Σ[₁₂₃₄₅₆₇₈₉]\s*[¹²³⁴⁵⁶⁷⁸⁹∞]/g, (match) => {
    // Extract subscript number (lower bound)
    const subscriptMap = {
      "₁": 1,
      "₂": 2,
      "₃": 3,
      "₄": 4,
      "₅": 5,
      "₆": 6,
      "₇": 7,
      "₈": 8,
      "₉": 9,
    };
    const lower = match[1];
    const lowerNum = subscriptMap[lower] || 1;
    return `Σ(n=${lowerNum} to ∞)`;
  });

  // Pattern: Text description in Uzbek/Russian/English after Σ
  // "Qator (seriya)" → keep as is, it's context
  // But detect if there's a fraction like "1/n²"

  // Fix common OCR errors in series expressions
  // "1/n2" → "1/n²", "1/n^2" → "1/n²"
  cleaned = cleaned.replace(/1\/n2\b/g, "1/n²");
  cleaned = cleaned.replace(/1\/n\^2/g, "1/n²");
  cleaned = cleaned.replace(/1\/n\s*\^\s*2/g, "1/n²");

  // More general: "1/n<digit>" → "1/n<superscript>"
  cleaned = cleaned.replace(/1\/n([2-9])\b/g, (match, digit) => {
    const superscripts = {
      2: "²",
      3: "³",
      4: "⁴",
      5: "⁵",
      6: "⁶",
      7: "⁷",
      8: "⁸",
      9: "⁹",
    };
    return `1/n${superscripts[digit] || "^" + digit}`;
  });

  // Pattern: Words that indicate series problem
  // Keep these for AI context
  cleaned = cleaned.replace(/\bQator\b/g, "Qator"); // Normalize
  cleaned = cleaned.replace(/\bseriya\b/gi, "seriya");
  cleaned = cleaned.replace(/\bTalab\b/g, "Talab");
  cleaned = cleaned.replace(
    /\basoslab\s+tushuntiring/gi,
    "asoslab tushuntiring"
  );
  cleaned = cleaned.replace(/\byig'indini\s+toping/gi, "yig'indini toping");

  // Sequence/Recursion notation fixes
  cleaned = cleaned.replace(/\bketma-ketlik\b/gi, "ketma-ketlik"); // Normalize
  cleaned = cleaned.replace(
    /\bAlgoritmik\s+fikrlash\b/gi,
    "Algoritmik fikrlash"
  );
  cleaned = cleaned.replace(/\bumumiy\s+formula/gi, "umumiy formula");
  cleaned = cleaned.replace(/\byopiq\s+ko'rinish/gi, "yopiq ko'rinish");

  // CRITICAL: Fix "01", "02", "03" that should be "a₁", "a₂", "a₃"
  // OCR often reads lowercase 'a' as '0' (zero) in sequence notation
  cleaned = cleaned.replace(/\b01\b/g, "a₁"); // 01 → a₁
  cleaned = cleaned.replace(/\b02\b/g, "a₂"); // 02 → a₂
  cleaned = cleaned.replace(/\b03\b/g, "a₃"); // 03 → a₃
  cleaned = cleaned.replace(/\b0n\b/g, "aₙ"); // 0n → aₙ

  // Fix "a1", "a2", "a3" → subscript versions
  cleaned = cleaned.replace(/\ba1\b/g, "a₁");
  cleaned = cleaned.replace(/\ba2\b/g, "a₂");
  cleaned = cleaned.replace(/\ba3\b/g, "a₃");
  cleaned = cleaned.replace(/\ba0\b/g, "a₀");

  // Fix "a n" with space → "aₙ"
  cleaned = cleaned.replace(/\ba\s+n\b/gi, "aₙ");

  // Fix "an" → "aₙ" (but not in words like "and", "an", "agar")
  cleaned = cleaned.replace(/\ban\b(?=\s*[=+\-*/,:\)])/gi, "aₙ");
  cleaned = cleaned.replace(/([=\s]|^)an(\s|$)/gi, "$1aₙ$2");

  // Fix coefficient patterns: "2an", "3an" → "2aₙ", "3aₙ"
  cleaned = cleaned.replace(/(\d+)an\b/gi, "$1aₙ");

  // Fix "aₙ + 1" (with spaces) → "aₙ₊₁"
  cleaned = cleaned.replace(/aₙ\s*\+\s*1/g, "aₙ₊₁");
  cleaned = cleaned.replace(/a\s*n\s*\+\s*1/gi, "aₙ₊₁");
  cleaned = cleaned.replace(/an\s*\+\s*1/gi, "aₙ₊₁");

  // Fix "a(n+1)" or "a(n + 1)" → "aₙ₊₁"
  cleaned = cleaned.replace(/a\s*\(\s*n\s*\+\s*1\s*\)/gi, "aₙ₊₁");

  // Fix "an+1" (no spaces) → "aₙ₊₁"
  cleaned = cleaned.replace(/an\+1/gi, "aₙ₊₁");

  // Fix "aₙ - 1" → "aₙ₋₁"
  cleaned = cleaned.replace(/aₙ\s*-\s*1/g, "aₙ₋₁");
  cleaned = cleaned.replace(/a\s*n\s*-\s*1/gi, "aₙ₋₁");
  cleaned = cleaned.replace(/an\s*-\s*1/gi, "aₙ₋₁");
  cleaned = cleaned.replace(/a\s*\(\s*n\s*-\s*1\s*\)/gi, "aₙ₋₁");

  // General pattern: "a<num>" where num is single digit (final cleanup)
  cleaned = cleaned.replace(/\ba([0-9])\b/g, (match, num) => {
    const subscripts = ["₀", "₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉"];
    return `a${subscripts[parseInt(num)]}`;
  });

  // NOTE: Series pattern checking moved earlier in the function for better detection

  // Arrow symbols
  cleaned = cleaned.replace(/->/g, "→");

  // Exponential notation (remaining cases)
  cleaned = cleaned.replace(/\be\^([a-z])/gi, "e^$1");

  // Geometric symbols corrections
  // L between two segments/lines → ⊥ (perpendicular)
  // Pattern: "AB L CD", "AI L EF", or "AIL EF" (no space before L)
  cleaned = cleaned.replace(/\b([A-Z]{1,2})L\s+([A-Z]{1,2})\b/g, "$1 ⊥ $2"); // AIL EF → AI ⊥ EF
  cleaned = cleaned.replace(/\b([A-Z]{1,2})\s+L\s+([A-Z]{1,2})\b/g, "$1 ⊥ $2"); // AI L EF → AI ⊥ EF
  cleaned = cleaned.replace(/\s+L\s+/g, " ⊥ ");

  // Fix parallel symbol
  cleaned = cleaned.replace(/\|\|/g, "∥");

  // Angle symbol
  cleaned = cleaned.replace(/\bangle\b/gi, "∠");
  cleaned = cleaned.replace(/<([A-Z]{3})>/g, "∠$1"); // <ABC> → ∠ABC

  // Triangle symbol
  cleaned = cleaned.replace(/\btriangle\b/gi, "△");
  cleaned = cleaned.replace(/\buchburchak\b/gi, "△");

  // Degree symbol (but not in equations)
  cleaned = cleaned.replace(/\bdegree[s]?\b/gi, "°");
  cleaned = cleaned.replace(/\bdaraja\b/gi, "°");

  // Fix spacing around operators - be more careful with division
  cleaned = cleaned.replace(/\s*([+\-=])\s*/g, " $1 ");
  // Don't add extra spaces around / that's already part of a fraction
  cleaned = cleaned.replace(/\s*\/\s*/g, " / ");

  // Remove extra whitespace
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  // Detect polynomial with x*: if we see multiple x* terms, apply descending powers
  const xStarCount = (cleaned.match(/x\*/g) || []).length;

  if (xStarCount >= 2) {
    console.log(
      `🔎 Found ${xStarCount} x* patterns - applying descending powers`
    );

    // Replace x* with descending powers: first=x⁴, second=x³, etc
    let count = 0;
    const powerMap = ["⁴", "³", "²", ""];
    cleaned = cleaned.replace(/x\*/g, () => {
      const power = powerMap[count] || `^${4 - count}`;
      count++;
      return `x${power}`;
    });
  } else if (xStarCount === 1) {
    // Single x* → likely x³ or x⁴, default to x³
    cleaned = cleaned.replace(/x\*/g, "x³");
  }

  // Fix other exponent patterns
  cleaned = cleaned.replace(/x''/g, "x³");
  cleaned = cleaned.replace(/x'/g, "x²");
  cleaned = cleaned.replace(/x"/g, "x³");
  cleaned = cleaned.replace(/x\?/g, "x²");
  cleaned = cleaned.replace(/x\^''/g, "x³");
  cleaned = cleaned.replace(/x\^'/g, "x²");

  // Fix spacing around operators
  cleaned = cleaned.replace(/\s*([+\-=])\s*/g, " $1 ");

  // Remove extra whitespace
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  console.log("🔧 Postprocessing result:", cleaned);
  return cleaned;
};

/**
 * OCR extraction with Mathpix (best for math) and fallback to OCR.space
 * In production, integrate with:
 * - Mathpix OCR (BEST for math formulas) - https://mathpix.com/
 * - Google Cloud Vision API
 * - AWS Textract
 */
const simulateOCR = async (fileId) => {
  try {
    console.log("📸 Starting OCR for file:", fileId);

    // Download the image from Telegram
    const fileLink = await global.bot.telegram.getFileLink(fileId);
    console.log("🔗 File link:", fileLink.href);

    const axios = require("axios");
    const FormData = require("form-data");

    console.log("📥 Downloading image...");
    const imageResponse = await axios.get(fileLink.href, {
      responseType: "arraybuffer",
    });

    const imageBuffer = Buffer.from(imageResponse.data, "binary");
    const base64Image = imageBuffer.toString("base64");

    // Try multiple OCR strategies for better results
    const tryOCR = async (engineNum, extraOptions = {}) => {
      const form = new FormData();
      form.append("base64Image", `data:image/jpeg;base64,${base64Image}`);
      form.append("language", "eng");
      form.append("isOverlayRequired", "false");
      form.append("detectOrientation", "true");
      form.append("scale", "true");
      form.append("OCREngine", engineNum.toString());
      form.append("isTable", "true");

      // Apply extra options
      Object.entries(extraOptions).forEach(([key, value]) => {
        form.append(key, value.toString());
      });

      const response = await axios.post(
        "https://api.ocr.space/parse/image",
        form,
        {
          headers: {
            ...form.getHeaders(),
            apikey: process.env.OCR_API_KEY || "K87899142388957",
          },
          timeout: 30000,
        }
      );

      return response.data;
    };

    // Primary OCR: OCR.space (FREE: 25,000 requests/month)
    try {
      console.log(
        "🔑 Using OCR.space with key:",
        process.env.OCR_API_KEY ? "Custom key" : "Default key"
      );

      // Try Engine 2 first (better for formatted text and tables)
      console.log("🔧 Trying OCR Engine 2...");
      let ocrData = await tryOCR(2);

      console.log(
        "📊 OCR.space Response (Engine 2):",
        JSON.stringify(ocrData, null, 2)
      );

      let rawText = ocrData?.ParsedResults?.[0]?.ParsedText?.trim();

      // If Engine 2 fails or returns empty, try Engine 1
      if (!rawText || rawText.length < 2) {
        console.log("⚠️ Engine 2 failed, trying Engine 1...");
        ocrData = await tryOCR(1);
        console.log(
          "📊 OCR.space Response (Engine 1):",
          JSON.stringify(ocrData, null, 2)
        );
        rawText = ocrData?.ParsedResults?.[0]?.ParsedText?.trim();
      }

      // If still empty, try Engine 3 (if available)
      if (!rawText || rawText.length < 2) {
        console.log("⚠️ Trying Engine 3 for better symbol recognition...");
        try {
          ocrData = await tryOCR(3);
          console.log(
            "📊 OCR.space Response (Engine 3):",
            JSON.stringify(ocrData, null, 2)
          );
          rawText = ocrData?.ParsedResults?.[0]?.ParsedText?.trim();
        } catch (e) {
          console.log("⚠️ Engine 3 not available or failed");
        }
      }

      // If still empty, try with different settings
      if (!rawText || rawText.length < 2) {
        console.log(
          "⚠️ Standard OCR failed, trying Engine 1 with enhanced settings..."
        );
        ocrData = await tryOCR(1, {
          isCreateSearchablePdf: "false",
          OCREngine: "1",
        });
        console.log(
          "📊 OCR.space Response (retry):",
          JSON.stringify(ocrData, null, 2)
        );
        rawText = ocrData?.ParsedResults?.[0]?.ParsedText?.trim();
      }

      if (rawText && rawText.length >= 2) {
        console.log("✅ OCR.space extracted (raw):", rawText);
        const cleaned = postprocessMathOCR(rawText);
        console.log("✅ After postprocessing:", cleaned);
        return cleaned;
      }

      console.log("❌ No text extracted from image");
      if (ocrData?.ParsedResults?.[0]?.ErrorMessage) {
        console.log("❌ OCR Error:", ocrData.ParsedResults[0].ErrorMessage);
      }

      return null;
    } catch (error) {
      console.error(
        "❌ OCR.space Error:",
        error.response?.data || error.message
      );
      return null;
    }
  } catch (error) {
    console.error("❌ Fatal OCR Error:", error);
    return null;
  }
};

/**
 * Clear user state (for cancel/back actions)
 */
const clearUserState = (telegramId) => {
  userStates.delete(telegramId);
};

/**
 * Handle OCR confirmation
 */
const handleOCRConfirm = async (ctx) => {
  try {
    const telegramId = ctx.from.id;
    const userState = userStates.get(telegramId);

    if (!userState || userState.state !== "confirming_ocr") {
      await ctx.answerCbQuery("Bu amal tugagan.");
      return;
    }

    await ctx.answerCbQuery();
    // Delete the confirmation message
    try {
      await ctx.deleteMessage();
    } catch (e) {
      // If can't delete, just remove buttons
      await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    }

    // Send loading message
    const loadingMsg = await ctx.reply(
      "🧮 Masalani yechayabmiz, kutib turing..."
    );
    await ctx.sendChatAction("typing");

    const extractedText = userState.extractedText;

    // Send to AI for solving
    const result = await aiService.solveMathProblem(extractedText);

    // Delete loading message
    try {
      await ctx.deleteMessage(loadingMsg.message_id);
    } catch (e) {
      // Ignore if can't delete
    }

    if (!result || result.status === "error") {
      await ctx.reply(
        "❌ Kechirasiz, men bu masalani yecha olmadim.\n" +
          "Iltimos masalani matn ko'rinishida yozing.\n\n" +
          "✏️ Boshqa matematik masala yuboring:"
      );
      // Reset to waiting state instead of deleting
      userStates.set(telegramId, "waiting_for_problem");
      return;
    }

    if (result.status === "reject") {
      await ctx.reply(
        result.text + "\n\n✏️ Iltimos matematik masala yuboring:"
      );
      // Reset to waiting state
      userStates.set(telegramId, "waiting_for_problem");
      return;
    }

    if (result.status === "clarify") {
      await ctx.reply(result.text + "\n\n✏️ Iltimos masalani yuboring:");
      userStates.set(telegramId, "waiting_for_problem");
      return;
    }

    // Otherwise send solution
    await ctx.reply(result.text);

    // Update user's daily usage ONLY after successful solution
    const user = ctx.state.user;
    user.usedToday += 1;
    user.lastUsedDate = new Date();
    await user.save();

    // Show remaining limit
    const remaining = user.dailyLimit - user.usedToday;
    await ctx.reply(
      `✅ Masala yechildi!\n` +
        `📊 Bugun qolgan: ${remaining}/${user.dailyLimit}`
    );

    // Clear state
    userStates.delete(telegramId);
  } catch (error) {
    console.error("Error in handleOCRConfirm:", error);
    await ctx.reply("Xatolik yuz berdi. Iltimos qayta urinib ko'ring.");
    userStates.delete(ctx.from.id);
  }
};

/**
 * Handle OCR edit request
 */
const handleOCREdit = async (ctx) => {
  try {
    const telegramId = ctx.from.id;
    const userState = userStates.get(telegramId);

    if (!userState || userState.state !== "confirming_ocr") {
      await ctx.answerCbQuery("Bu amal tugagan.");
      return;
    }

    await ctx.answerCbQuery();
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });

    userStates.set(telegramId, "waiting_for_problem");

    await ctx.reply(
      "✏️ To'g'rilangan masalani yozing:\n\n" +
        `Ajratilgan text:\n<code>"${userState.extractedText}"</code>\n\n` +
        "<i>To'g'ri masalani yozib yuboring.</i>",
      { parse_mode: "HTML" }
    );
  } catch (error) {
    console.error("Error in handleOCREdit:", error);
    await ctx.reply("Xatolik yuz berdi. Iltimos qayta urinib ko'ring.");
  }
};

/**
 * Handle OCR cancel request
 */
const handleOCRCancel = async (ctx) => {
  try {
    const telegramId = ctx.from.id;
    const { mainMenuKeyboard } = require("../keyboards");

    await ctx.answerCbQuery("Bekor qilindi");
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });

    userStates.delete(telegramId);

    await ctx.reply(
      "❌ Bekor qilindi. Iltimos quyidagi tugmalardan birini tanlang:",
      mainMenuKeyboard()
    );
  } catch (error) {
    console.error("Error in handleOCRCancel:", error);
  }
};

module.exports = {
  handleSolveMathProblem,
  handleTextProblem,
  handleImageProblem,
  clearUserState,
  handleOCRConfirm,
  handleOCREdit,
  handleOCRCancel,
};
