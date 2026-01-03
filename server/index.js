require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const { Telegraf } = require("telegraf");

// Import routes
const authRoutes = require("./routes/auth");
const usersRoutes = require("./routes/users");
const aiProvidersRoutes = require("./routes/aiProviders");

// Import bot handlers
const { handleStart, handleContact } = require("./bot/handlers/registration");
const { handleHelp, handleMyLimit } = require("./bot/handlers/menu");
const {
  handleSolveMathProblem,
  handleTextProblem,
  handleImageProblem,
  handleOCRConfirm,
  handleOCREdit,
  handleOCRCancel,
} = require("./bot/handlers/mathSolver");

// Import middlewares
const {
  checkUser,
  checkDailyLimit,
  checkChannelSubscription,
} = require("./bot/middlewares");

// Import utilities
const { initializeAdmin } = require("./utils/initAdmin");
const { initializeAIProviders } = require("./utils/initAIProviders");

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/ai-providers", aiProvidersRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date() });
});

// Initialize Telegram Bot
const bot = new Telegraf(process.env.BOT_TOKEN);

// Make bot globally accessible for OCR
global.bot = bot;

// Bot command handlers
bot.start(handleStart);
bot.help(handleHelp);

// Contact handler (phone number registration)
bot.on("contact", handleContact);

// Channel subscription check callback
bot.action("check_subscription", async (ctx) => {
  await ctx.answerCbQuery();

  const channelUsername = process.env.CHANNEL_USERNAME;
  const telegramId = ctx.from.id;

  try {
    const chatMember = await ctx.telegram.getChatMember(
      channelUsername,
      telegramId
    );

    if (["creator", "administrator", "member"].includes(chatMember.status)) {
      const { mainMenuKeyboard } = require("./bot/keyboards");
      await ctx.editMessageText(
        "✅ Ajoyib! Siz kanalga a'zo bo'ldingiz.\n\n" +
          "Endi botdan foydalanishingiz mumkin:",
        mainMenuKeyboard()
      );
    } else {
      await ctx.answerCbQuery("❌ Siz hali kanalga a'zo bo'lmadingiz!", {
        show_alert: true,
      });
    }
  } catch (error) {
    // Handle inaccessible channel error
    if (error.response?.description?.includes("inaccessible")) {
      const { mainMenuKeyboard } = require("./bot/keyboards");
      await ctx.editMessageText(
        "✅ Endi botdan foydalanishingiz mumkin:",
        mainMenuKeyboard()
      );
    } else {
      await ctx.answerCbQuery("❌ Iltimos avval kanalga a'zo bo'ling!", {
        show_alert: true,
      });
    }
  }
});

// OCR confirmation callbacks
bot.action("ocr_confirm", checkUser, checkDailyLimit, handleOCRConfirm);
bot.action("ocr_edit", checkUser, handleOCREdit);
bot.action("ocr_cancel", handleOCRCancel);

// Text button handlers (menu)
bot.hears(
  "🧮 Masalani Yechish",
  checkUser,
  checkChannelSubscription,
  checkDailyLimit,
  handleSolveMathProblem
);
bot.hears("📊 Limitim", checkUser, handleMyLimit);
bot.hears("ℹ️ Yordam", handleHelp);

// Handle text messages (math problems)
bot.on(
  "text",
  checkUser,
  checkChannelSubscription,
  checkDailyLimit,
  handleTextProblem
);

// Handle photo messages (image math problems)
bot.on(
  "photo",
  checkUser,
  checkChannelSubscription,
  checkDailyLimit,
  handleImageProblem
);

// Error handler for bot
bot.catch((err, ctx) => {
  console.error("Bot error:", err);
  ctx.reply("Kutilmagan xatolik yuz berdi. Iltimos keyinroq urinib ko'ring.");
});

// Connect to MongoDB and start services
const startServer = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Initialize admin account
    await initializeAdmin();

    // Initialize AI providers
    await initializeAIProviders();

    // Start Express server
    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
    });

    // Start Telegram bot
    await bot.launch();
    console.log("✅ Telegram bot started");

    // Graceful shutdown
    process.once("SIGINT", () => {
      bot.stop("SIGINT");
      process.exit(0);
    });
    process.once("SIGTERM", () => {
      bot.stop("SIGTERM");
      process.exit(0);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

// Start the application
startServer();
