const axios = require("axios");
const AIProvider = require("../models/AIProvider");

/**
 * Get active AI provider and working token
 */
const getActiveProvider = async () => {
  const provider = await AIProvider.findOne({ isActive: true });

  if (!provider) {
    console.warn("No active AI provider configured");
    return null;
  }

  // Reset daily usage if new day
  const today = new Date().toDateString();
  for (const token of provider.tokens) {
    const lastUsed = new Date(token.lastUsedDate).toDateString();
    if (today !== lastUsed) {
      token.usedToday = 0;
      token.lastUsedDate = new Date();
    }
  }

  // Find available token (active and under limit)
  const availableToken = provider.tokens.find(
    (t) => t.isActive && t.usedToday < t.dailyLimit
  );

  if (!availableToken) {
    console.warn("No available tokens with remaining quota");
    return null;
  }

  return { provider, token: availableToken };
};

/**
 * Track token usage
 */
const trackUsage = async (providerId, tokenId) => {
  try {
    const provider = await AIProvider.findById(providerId);
    if (!provider) return;

    const token = provider.tokens.id(tokenId);
    if (token) {
      token.usageCount += 1;
      token.usedToday += 1;
      token.lastUsedDate = new Date();
    }

    provider.totalUsage += 1;
    await provider.save();
  } catch (error) {
    console.error("Error tracking usage:", error);
  }
};

/**
 * Call OpenAI API
 */
const callOpenAI = async (prompt, model, apiKey) => {
  const response = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: model || "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "Siz professional matematika o'qituvchisisiz. Faqat matematika masalalarini yechasiz.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    }
  );

  return response.data.choices?.[0]?.message?.content;
};

/**
 * Call Google Gemini API
 */
const callGemini = async (prompt, model, apiKey) => {
  const modelName = model || "gemini-pro";

  // Gemini API endpoint
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const response = await axios.post(
    url,
    {
      contents: [
        {
          parts: [
            {
              text: `Siz professional matematika o'qituvchisisiz. Faqat matematika masalalarini yechasiz.\n\n${prompt}`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1500,
      },
    },
    {
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 30000,
    }
  );

  return response.data.candidates?.[0]?.content?.parts?.[0]?.text;
};

/**
 * Call Anthropic Claude API
 */
const callClaude = async (prompt, model, apiKey) => {
  const response = await axios.post(
    "https://api.anthropic.com/v1/messages",
    {
      model: model || "claude-3-sonnet-20240229",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      system:
        "Siz professional matematika o'qituvchisisiz. Faqat matematika masalalarini yechasiz.",
    },
    {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      timeout: 30000,
    }
  );

  return response.data.content?.[0]?.text;
};

/**
 * Call AI with automatic fallback to second token if first fails
 */
const callAIWithFallback = async (prompt) => {
  const providerData = await getActiveProvider();

  if (!providerData) {
    console.warn("AI not configured, using mock response");
    return generateMockResponse(prompt);
  }

  const { provider, token } = providerData;

  // Get all active tokens sorted by usage
  const activeTokens = provider.tokens
    .filter((t) => t.isActive && t.usedToday < t.dailyLimit)
    .sort((a, b) => a.usedToday - b.usedToday);

  if (activeTokens.length === 0) {
    console.warn("No tokens available, using mock response");
    return generateMockResponse(prompt);
  }

  // Try each token until one succeeds
  for (const currentToken of activeTokens) {
    try {
      let response;

      switch (provider.provider) {
        case "openai":
          response = await callOpenAI(
            prompt,
            provider.selectedModel,
            currentToken.key
          );
          break;
        case "gemini":
          response = await callGemini(
            prompt,
            provider.selectedModel,
            currentToken.key
          );
          break;
        case "claude":
          response = await callClaude(
            prompt,
            provider.selectedModel,
            currentToken.key
          );
          break;
        default:
          throw new Error(`Unknown provider: ${provider.provider}`);
      }

      if (response) {
        // Track successful usage
        await trackUsage(provider._id, currentToken._id);
        return response;
      }
    } catch (error) {
      const errorDetails = error.response?.data || error.message;
      const errorCode = error.response?.status;

      console.error(
        `Error with ${provider.provider} token ${currentToken.label}:`,
        JSON.stringify(errorDetails, null, 2)
      );

      // Model mavjud emas yoki ruxsat yo'q
      if (
        errorCode === 404 ||
        errorDetails?.error?.code === "model_not_found" ||
        errorDetails?.error?.message?.includes("does not exist") ||
        errorDetails?.error?.message?.includes("not available")
      ) {
        throw new Error(
          `Model "${provider.selectedModel}" mavjud emas yoki sizning API key'ingiz uchun ruxsat berilmagan. Iltimos, gpt-4o-mini modelini ishlating yoki boshqa API key qo'shing.`
        );
      }

      // Budjet/Limit muammosi
      if (
        errorCode === 429 ||
        errorDetails?.error?.code === "insufficient_quota" ||
        errorDetails?.error?.message?.includes("quota") ||
        errorDetails?.error?.message?.includes("rate_limit")
      ) {
        throw new Error(
          `API limit yoki budjet tugadi. Iltimos, tokenni tekshiring yoki yangi token qo'shing.`
        );
      }

      // Continue to next token for other errors
    }
  }

  // All tokens failed, use mock
  console.warn("All tokens failed, using mock response");
  return generateMockResponse(prompt);
};

/**
 * Check if text contains mathematical content (simple filter before AI)
 */
const isMathematicalContent = (text) => {
  const mathKeywords = [
    // O'zbek tilidagi matematik so'zlar
    "masala",
    "misol",
    "hisoblang",
    "toping",
    "yeching",
    "hisobla",
    "qiymat",
    "javob",
    "yech",
    "tenglama",
    "ifoda",
    "formula",
    "ildiz",
    "kvadrat",
    "kub",
    "daraja",
    "foiz",
    "kasr",
    "ko'paytiring",
    "bo'ling",
    "ayiring",
    "qo'shing",
    "yig'indi",
    "ayirma",
    "ko'paytma",
    "bo'linma",
    "perimetr",
    "yuz",
    "hajm",
    "balandlik",
    "tomon",
    "burchak",
    "radius",
    "diametr",
    "aylana",
    "doira",
    "uchburchak",
    "to'rtburchak",
    "kvadrat",
    "romb",

    // Qatorlar va ketma-ketliklar (Series and Sequences)
    "qator",
    "seriya",
    "ketma-ketlik",
    "yig'indi",
    "yigindi",
    "limit",
    "integral",
    "hosila",
    "differensial",
    "yaqinlashish",
    "uzoqlashish",
    "yaqinlashuv",

    // Ruscha matematika so'zlari
    "решите",
    "вычислите",
    "найдите",
    "задача",
    "пример",
    "уравнение",
    "формула",
    "корень",
    "квадрат",
    "ряд",
    "сумма",
    "последовательность",

    // Inglizcha
    "solve",
    "calculate",
    "find",
    "equation",
    "formula",
    "problem",
    "math",
    "algebra",
    "geometry",
    "series",
    "sequence",
    "sum",
    "limit",
    "integral",
    "derivative",
  ];

  const mathSymbols = /[+\-*/=÷×√∛∜∫∑∏πθαβγΣ∞]/;
  const mathPatterns =
    /\d+\s*[+\-*/÷×=]\s*\d+|x\^?\d+|\d+\/\d+|sin|cos|tan|log|lim|\∫|Σ|n=|1\/n/i;

  const lowerText = text.toLowerCase();

  // Check for math keywords
  const hasKeyword = mathKeywords.some((keyword) =>
    lowerText.includes(keyword)
  );

  // Check for math symbols or patterns
  const hasMathSymbol = mathSymbols.test(text);
  const hasMathPattern = mathPatterns.test(text);

  return hasKeyword || hasMathSymbol || hasMathPattern;
};

/**
 * Classify problem type heuristically
 * Returns one of: 'algebra', 'geometry', 'calculus', 'series', 'text_logic', 'general_math', 'clarify'
 */
const classifyProblem = (text) => {
  if (!text || !text.trim()) return "clarify";
  const t = text.toLowerCase();

  // Calculus/Analysis: limit, integral, hosila, differensial
  if (
    /(\blim\b|limit|\bint\b|integral|∫|hosila|differensial|derivative|dx|dy|dt)/.test(
      t
    )
  ) {
    return "calculus";
  }

  // Series/Sequences: qator, Σ, yig'indi, n=1, seriya, ketma-ketlik, rekursiv
  if (
    /(qator|seriya|ketma-ketlik|yig'indi|yigindi|Σ|∑|sum|series|sequence|n=|1\/n|yaqinlash|convergence|rekursiv|aₙ|a_n|a\d+|umumiy\s+formula|yopiq\s+ko'rinish)/.test(
      t
    )
  ) {
    return "series";
  }

  // Algebra heuristics: variables, =, x, coefficients, equation words
  if (
    /[=<>]|\b(x|y|z|a|b|c)\b/.test(t) ||
    /tenglama|tengsizlik|x\^|\bsolve\b/.test(t)
  ) {
    return "algebra";
  }

  // Geometry heuristics: shapes, perimetr, maydon, radius, burchak
  if (
    /(uchburchak|kvadrat|to'rtburchak|romb|perimetr|maydon|radius|diametr|burchak|aylana|doira)/.test(
      t
    )
  ) {
    return "geometry";
  }

  // Text-only logical math: words like agar, faraz, nechta, mantiq, nechta usul
  if (
    /\b(agar|faraz|nechta|necha|mantiq|qanday|taqqosla|nechta\s+usul)\b/.test(
      t
    ) &&
    !/[=<>+\-*/\d]/.test(t)
  ) {
    return "text_logic";
  }

  // If it contains clear math keywords or symbols, treat as general_math
  if (isMathematicalContent(text)) return "general_math";

  return "clarify";
};

/**
 * Solve math problem using AI
 * @param {string} problemText - The math problem to solve
 * @returns {Promise<string>} - The solution with step-by-step explanation
 */
const solveMathProblem = async (problemText) => {
  try {
    const type = classifyProblem(problemText);

    if (type === "clarify") {
      return {
        status: "clarify",
        text: "Iltimos, masalani biroz aniqroq yozing: raqamlar, o'zgaruvchilar yoki rasm bormi? Agar matnli mantiqiy savol bo'lsa, iltimos so'zni to'liq yozing.",
      };
    }

    // Build type-specific prompt with 1-2 few-shot examples (plain text output expected)
    let promptHeader = `Siz professional matematika o'qituvchisisiz va foydalanuvchining savollarini bosqichma-bosqich, oddiy o'zbek tilida tushuntirib yechasiz.

MUHIM FORMATLAR (QATIY QOIDALAR):
- Javobni FAQAT oddiy matn formatida bering
- LaTeX ISHLATMANG: \\(, \\), \\frac, \\left, \\right, \\sqrt kabi belgilarni MUTLAQO ISHLATMANG
- Kasr sonlar: 4/3, 5/2, 1/2 (yoki "to'rtdan uch", "ikkidan bir")
- Koordinatalar: (1, 4/3) yoki G(1, 4/3) - oddiy qavs
- Daraja: x², x³, x⁴ (yoki x^2, x^3, x^4)
- Ildiz: √2, √5, √32, √100 (HECH QACHON sqrt() ISHLATMANG!)
- Pi: π yoki 3.14
- Cheksizlik: ∞
- Oxirida "Yakuniy Javob:" deb yozing

TO'G'RI MISOL:
- √32 (to'g'ri) emas sqrt(32) (noto'g'ri)
- 4/3 (to'g'ri) emas \\frac{4}{3} (noto'g'ri)  
- (1, 4/3) (to'g'ri) emas \\left(1, \\frac{4}{3}\\right) (noto'g'ri)
- AB = √((5-1)² + (-2-2)²) = √(16 + 16) = √32 = 4√2

ESLATMA: x' yoki x" kabi belgilar daraja bo'lishi mumkin (OCR xatosi).`;

    let fewShot = "";

    if (type === "algebra") {
      fewShot =
        "Misol 1: Masala: 2x + 3 = 11\nQadam 1: 2x = 11 - 3 = 8\nQadam 2: x = 8/2 = 4\nYakuniy Javob: x = 4\n---\nMisol 2: Masala: x² - 5x + 6 = 0\nQadam 1: Faktorizatsiya (x - 2)(x - 3) = 0\nQadam 2: x = 2 yoki x = 3\nYakuniy Javob: x = 2, x = 3\n---\n";
    } else if (type === "geometry") {
      fewShot =
        "Misol: Masala: Uchburchakning asosiga 6 va balandligi 4 bo'lsa, maydonini toping.\nQadam 1: Maydon = 1/2 * asos * balandlik = 1/2 * 6 * 4 = 12\nYakuniy Javob: 12\n---\nMisol 2: Tomon uzunligi = √(4² + 3²) = √(16 + 9) = √25 = 5\n---\n";
    } else if (type === "calculus") {
      fewShot =
        "Misol 1: Masala: lim (x→0) (e^x - 1 - x) / x²\nQadam 1: L'Hospital qoidasini qo'llaymiz\nQadam 2: Surat hosilasi: e^x - 1; Maxraj hosilasi: 2x\nQadam 3: lim (x→0) (e^x - 1) / 2x = 0/0 (yana L'Hospital)\nQadam 4: lim (x→0) e^x / 2 = 1/2\nYakuniy Javob: 1/2\n---\nMisol 2: Masala: ∫₀¹ x ln(x) dx\nQadam 1: Bo'laklab integrallash: u = ln(x), dv = x dx\nQadam 2: du = 1/x dx, v = x²/2\nQadam 3: ∫ x ln(x) dx = (x²/2)ln(x) - ∫ x/2 dx\nQadam 4: = (x²/2)ln(x) - x²/4\nQadam 5: [0 dan 1 gacha]: (1/2)ln(1) - 1/4 - 0 = -1/4\nYakuniy Javob: -1/4\n---\n";
    } else if (type === "series") {
      fewShot =
        "Misol 1: Masala: Σ(n=1 to ∞) 1/n² ni toping va asoslab tushuntiring.\nQadam 1: Bu Basel masalasi deb ataladi\nQadam 2: Bu qator yaqinlashadi (p-test: p=2 > 1)\nQadam 3: Yig'indisi: π²/6 ≈ 1.6449\nQadam 4: Euler tomonidan 1735 yilda isbotlangan\nTushuntirish: Har bir had 1/n² shaklida, n ortishi bilan tez kichrayadi. Geometrik jihatdan, bu funksiya integrali chekli.\nYakuniy Javob: π²/6\n---\nMisol 2: Masala: Σ(n=1 to ∞) 1/2^n\nQadam 1: Bu geometrik qator, r = 1/2\nQadam 2: Geometrik qator yig'indisi: a/(1-r) = (1/2)/(1-1/2) = 1\nYakuniy Javob: 1\n---\nMisol 3: Masala: Agar ketma-ketlik a₁ = 2, aₙ₊₁ = 3aₙ - 1. Umumiy formulani toping.\nQadam 1: Rekursiv formula: aₙ₊₁ = 3aₙ - 1\nQadam 2: Bir necha hadni hisoblaymiz: a₁=2, a₂=3(2)-1=5, a₃=3(5)-1=14\nQadam 3: Yopiq ko'rinishni topish: aₙ₊₁ - c = 3(aₙ - c), c = 1/2\nQadam 4: aₙ - 1/2 = 3ⁿ⁻¹(a₁ - 1/2) = 3ⁿ⁻¹(3/2)\nQadam 5: aₙ = (3/2)·3ⁿ⁻¹ + 1/2 = (3ⁿ + 1)/2\nYakuniy Javob: aₙ = (3ⁿ + 1)/2\n---\n";
    } else if (type === "text_logic") {
      fewShot =
        "Misol: Masala: Agar barcha A lar B bo'lsa va ba'zi B lar C bo'lsa, A lar C lar degani to'g'rimi?\nQadam 1: A subset B; some B subset C. Barcha A lar C bo'lishini ta'minlamaydi.\nYakuniy Javob: Yo'q, kafolatlanmaydi.\n---\n";
    } else {
      fewShot =
        "Misol: Masala: 5 + 3 * 2 ni hisoblang.\nQadam 1: 3*2 = 6\nQadam 2: 5 + 6 = 11\nYakuniy Javob: 11\n---\n";
    }

    const prompt = `${promptHeader}\n\n${fewShot}Savol turi: ${type}\nMasala: ${problemText}\n\nIltimos: bosqichlarni numeratsiya qiling yoki 'Qadam 1', 'Qadam 2' kabi yozing.`;

    const response = await callAIWithFallback(prompt);

    if (!response) return { status: "error", text: null };

    // If AI thinks the question is non-math, return reject
    const lower = response.toLowerCase();
    if (
      lower.includes("kechirasiz") &&
      lower.includes("faqat matematik masal")
    ) {
      return { status: "reject", text: response };
    }

    return { status: "solution", text: response };
  } catch (error) {
    console.error("Error in solveMathProblem:", error);
    return { status: "error", text: null };
  }
};

/**
 * Generate mock response for testing (when AI is not configured)
 */
const generateMockResponse = (prompt, errorMsg = null) => {
  // Extract problem from prompt
  const problemMatch = prompt.match(/Masala:\s*(.+)/s);
  const problem = problemMatch ? problemMatch[1].trim() : "Noma'lum masala";

  if (errorMsg) {
    return `❌ *Xato*

*Masala:* ${problem}

*Xato:* ${errorMsg}

_Iltimos admin panelda sozlamalarni tekshiring._`;
  }

  return `🧮 *Yechim* (Test rejimi)

*Masala:* ${problem}

*Qadam 1:*
Test rejimida ishlamoqdamiz. AI API konfiguratsiya qilinmagan.

*Yakuniy Javob:* 
Admin panelda AI providerini sozlang.

_Bu test javobi. Haqiqiy AI javoblari uchun admin panelda tokenlarni kiriting._`;
};

module.exports = {
  solveMathProblem,
  getActiveProvider,
  callAIWithFallback,
};

// Export classifier and add structured solver
module.exports.classifyProblem = classifyProblem;

/**
 * Solve and request structured JSON output from the AI.
 * Returns parsed JSON or { status: 'error', text: null }
 */
const solveMathProblemStructured = async (problemText) => {
  try {
    const type = classifyProblem(problemText);

    if (type === "clarify") {
      return { status: "clarify", text: "Iltimos masalani aniqroq yozing." };
    }

    const schemaExample = `{
  "type": "algebra|geometry|text_logic|general_math",
  "formalization": "(optional) formalized statement",
  "steps": ["Qadam 1: ...", "Qadam 2: ..."],
  "final_answer": "..."
}`;

    const prompt = `Siz professional matematika o'qituvchisisiz. Foydalanuvchining masalasini bosqichma-bosqich yeching va faqat JSON formatida bering. JSON sxemasining misoli:\n${schemaExample}\n\nMasala turi: ${type}\nMasala: ${problemText}\n\nEslatma: Javob faqat valid JSON bo'lsin, hech qanday qo'shimcha matn bo'lmasin.`;

    const responseText = await callAIWithFallback(prompt);
    if (!responseText) return { status: "error", text: null };

    // Try parse JSON tolerant
    try {
      const jsonStart = responseText.indexOf("{");
      const jsonString =
        jsonStart >= 0 ? responseText.slice(jsonStart) : responseText;
      const parsed = JSON.parse(jsonString);
      return { status: "solution", json: parsed };
    } catch (e) {
      console.warn("Failed to parse structured AI response:", e.message);
      return { status: "error", text: responseText };
    }
  } catch (error) {
    console.error("Error in solveMathProblemStructured:", error);
    return { status: "error", text: null };
  }
};

module.exports.solveMathProblemStructured = solveMathProblemStructured;
