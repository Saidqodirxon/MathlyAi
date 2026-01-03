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
  ];

  const mathSymbols = /[+\-*/=÷×√∛∜∫∑∏πθαβγ]/;
  const mathPatterns =
    /\d+\s*[+\-*/÷×=]\s*\d+|x\^?\d+|\d+\/\d+|sin|cos|tan|log/i;

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
 * Solve math problem using AI
 * @param {string} problemText - The math problem to solve
 * @returns {Promise<string>} - The solution with step-by-step explanation
 */
const solveMathProblem = async (problemText) => {
  try {
    // Pre-check: Filter non-mathematical questions BEFORE calling AI
    if (!isMathematicalContent(problemText)) {
      return "Kechirasiz, men faqat matematik masalalarni yechaman. Iltimos qaytadan urinib ko'ring.";
    }

    // Construct the prompt according to requirements
    const prompt = `Siz professional matematika o'qituvchisisiz.
Faqat matematik masalalar va matematik savollarni yechasiz.

Matematik masalalar quyidagilarni o'z ichiga oladi:
- Arifmetik hisoblashlar (qo'shish, ayirish, ko'paytirish, bo'lish)
- Algebra (tenglama, tengsizlik, x, y, z o'zgaruvchilar)
- Geometriya (yuz, hajm, perimetr, burchaklar)
- Trigonometriya (sin, cos, tan)
- Funksiyalar va grafiklar
- Mantiqiy matematik masalalar

Agar savol matematik bo'lmasa:
- "Kechirasiz, men faqat matematik masalalarni yechaman. Iltimos matematik masala yuboring." deb javob bering.

Agar matematik masala bo'lsa:
- Masalani bosqichma-bosqich yeching
- Har bir bosqichni aniq va oddiy tushuntiring
- O'zbek tilida to'g'ri so'zlarni ishlating: "qavs" (parantez emas), "ko'paytirish", "bo'lish"
- Oddiy matn formatda yozing - emoji, maxsus belgilar, markdown ishlatmang
- Kasr sonlar uchun oddiy format: "1/3" yoki "bir uchdan bir"
- Oxirida "Yakuniy Javob: ..." deb yozing

Masala:
${problemText}`;

    const response = await callAIWithFallback(prompt);
    return response;
  } catch (error) {
    console.error("Error in solveMathProblem:", error);
    return null;
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
