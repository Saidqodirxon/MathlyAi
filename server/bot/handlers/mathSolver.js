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
    const solution = await aiService.solveMathProblem(problemText);

    if (!solution) {
      await ctx.reply(
        "❌ Kechirasiz, men bu masalani yecha olmadim.\n" +
          "Iltimos to'g'ri matematik masala ekanligiga ishonch hosil qiling va qayta urinib ko'ring.\n\n" +
          "✏️ Boshqa matematik masala yuboring:"
      );
      return; // Keep state, don't delete
    }

    // Check if it's a rejection message (non-math question)
    const isRejection = solution.includes(
      "faqat matematik masalalarni yechaman"
    );

    if (isRejection) {
      // Don't count non-math questions against user's limit
      // Keep state as "waiting_for_problem" so user can continue
      await ctx.reply(solution + "\n\n✏️ Iltimos matematik masala yuboring:");
      // Don't delete state - keep it at "waiting_for_problem"
      return;
    }

    // Send solution
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

    // In a real implementation, you would:
    // 1. Download the photo
    // 2. Use OCR service to extract text
    // 3. Send extracted text to AI

    // For MVP, we'll simulate OCR extraction
    await ctx.reply("📸 Rasm qabul qilindi! Matnni ajratib olmoqdamiz...");

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
 * Simulate OCR extraction (placeholder for real OCR service)
 * In production, integrate with services like:
 * - Google Cloud Vision API
 * - AWS Textract
 * - Tesseract.js
 */
const simulateOCR = async (fileId) => {
  try {
    console.log("📸 Starting OCR for file:", fileId);

    // Download the image from Telegram
    const fileLink = await global.bot.telegram.getFileLink(fileId);
    console.log("🔗 File link:", fileLink.href);

    const axios = require("axios");
    const FormData = require("form-data");

    // Try Method 1: Download image and send as base64
    try {
      console.log("📥 Downloading image...");
      const imageResponse = await axios.get(fileLink.href, {
        responseType: "arraybuffer",
      });

      const base64Image = Buffer.from(imageResponse.data, "binary").toString(
        "base64"
      );

      console.log(
        "🔑 Using API key:",
        process.env.OCR_API_KEY ? "Custom key" : "Default key"
      );

      const form = new FormData();
      form.append("base64Image", `data:image/jpeg;base64,${base64Image}`);
      form.append("language", "eng");
      form.append("isOverlayRequired", "false");
      form.append("detectOrientation", "true");
      form.append("scale", "true");
      form.append("OCREngine", "2"); // Engine 2 is better for math

      const ocrResponse = await axios.post(
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

      console.log("📊 OCR Response status:", ocrResponse.status);
      console.log(
        "📊 OCR Response data:",
        JSON.stringify(ocrResponse.data, null, 2)
      );

      if (ocrResponse.data?.ParsedResults?.[0]?.ParsedText) {
        const text = ocrResponse.data.ParsedResults[0].ParsedText.trim();

        console.log("✅ Extracted text:", text);

        // If empty or too short, return null
        if (!text || text.length < 3) {
          console.log("❌ Text too short");
          return null;
        }

        return text;
      }

      console.log("❌ No ParsedResults found");
      if (ocrResponse.data?.ErrorMessage) {
        console.log("❌ OCR Error:", ocrResponse.data.ErrorMessage);
      }

      return null;
    } catch (error) {
      console.error("❌ OCR Error:", error.response?.data || error.message);
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
    await ctx.sendChatAction("typing");

    const extractedText = userState.extractedText;

    // Send to AI for solving
    const solution = await aiService.solveMathProblem(extractedText);

    if (!solution) {
      await ctx.reply(
        "❌ Kechirasiz, men bu masalani yecha olmadim.\n" +
          "Iltimos masalani matn ko'rinishida yozing.\n\n" +
          "✏️ Boshqa matematik masala yuboring:"
      );
      // Reset to waiting state instead of deleting
      userStates.set(telegramId, "waiting_for_problem");
      return;
    }

    // Check if it's a rejection message (non-math question)
    const isRejection = solution.includes(
      "faqat matematik masalalarni yechaman"
    );

    if (isRejection) {
      // Don't count non-math questions against user's limit
      await ctx.reply(solution + "\n\n✏️ Iltimos matematik masala yuboring:");
      // Reset to waiting state
      userStates.set(telegramId, "waiting_for_problem");
      return;
    }

    // Send solution
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

    await ctx.answerCbQuery("Bekor qilindi");
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });

    userStates.delete(telegramId);

    await ctx.reply("❌ Bekor qilindi. /menu dan qayta boshlashingiz mumkin.");
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
