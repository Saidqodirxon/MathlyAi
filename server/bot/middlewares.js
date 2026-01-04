const User = require("../models/User");
const { classifyProblem } = require("../services/aiService");

/**
 * Middleware to check if user exists and is not blocked
 */
const checkUser = async (ctx, next) => {
  try {
    const telegramId = ctx.from.id;
    const user = await User.findOne({ telegramId });

    if (!user) {
      // User not registered, redirect to start
      await ctx.reply("Iltimos avval /start buyrug'ini yuboring");
      return;
    }

    if (user.isBlocked) {
      await ctx.reply(
        "❌ Sizning hisobingiz bloklangan. Iltimos qo'llab-quvvatlash xizmatiga murojaat qiling."
      );
      return;
    }

    // Attach user to context for easy access
    ctx.state.user = user;
    return next();
  } catch (error) {
    console.error("Error in checkUser middleware:", error);
    await ctx.reply("Xatolik yuz berdi. Iltimos keyinroq urinib ko'ring.");
  }
};

/**
 * Middleware to check daily limit
 */
const checkDailyLimit = async (ctx, next) => {
  try {
    const user = ctx.state.user;

    // Reset daily usage if it's a new day
    const today = new Date().toDateString();
    const lastUsed = new Date(user.lastUsedDate).toDateString();

    if (today !== lastUsed) {
      user.usedToday = 0;
      user.lastUsedDate = new Date();
      await user.save();
    }

    if (user.usedToday >= user.dailyLimit) {
      await ctx.reply(
        "❌ Sizning kunlik limitingiz tugadi.\n\n" +
          `Siz bugun ${user.usedToday}/${user.dailyLimit} ta masala yechildingiz.\n` +
          "Ertaga qayta urinib ko'ring! 📅"
      );
      return;
    }

    return next();
  } catch (error) {
    console.error("Error in checkDailyLimit middleware:", error);
    await ctx.reply("Xatolik yuz berdi. Iltimos keyinroq urinib ko'ring.");
  }
};

/**
 * Middleware to check channel subscription
 */
const checkChannelSubscription = async (ctx, next) => {
  try {
    const channelUsername = process.env.CHANNEL_USERNAME;

    if (!channelUsername) {
      // If no channel is configured, skip check
      return next();
    }

    const telegramId = ctx.from.id;

    try {
      // Check if user is a member of the channel
      const chatMember = await ctx.telegram.getChatMember(
        channelUsername,
        telegramId
      );

      // Member status can be: creator, administrator, member, restricted, left, kicked
      if (["creator", "administrator", "member"].includes(chatMember.status)) {
        return next();
      }
    } catch (error) {
      // Error means user is not in channel or channel doesn't exist or is inaccessible
      console.log(
        "Channel check error:",
        error.response?.description || error.message
      );
      // If channel is inaccessible (private/closed), skip check and allow user
      if (error.response?.description?.includes("inaccessible")) {
        return next();
      }
    }

    // User is not in channel
    const { channelCheckKeyboard } = require("./keyboards");
    await ctx.reply(
      "📢 Botdan foydalanish uchun avval kanalimizga a'zo bo'lishingiz kerak!\n\n" +
        "Qo'shilish uchun quyidagi tugmani bosing:",
      channelCheckKeyboard(channelUsername)
    );
    return;
  } catch (error) {
    console.error("Error in checkChannelSubscription middleware:", error);
    // In case of error, allow user to proceed (fail-open)
    return next();
  }
};

module.exports = {
  checkUser,
  checkDailyLimit,
  checkChannelSubscription,
};

/**
 * Middleware: classify incoming message/problem and set ctx.state.problemType
 */
const classifyProblemMiddleware = async (ctx, next) => {
  try {
    // Prefer text content
    if (ctx.message && ctx.message.text) {
      ctx.state.problemType = classifyProblem(ctx.message.text);
    } else if (ctx.message && ctx.message.photo) {
      ctx.state.problemType = "image";
    } else {
      ctx.state.problemType = "unknown";
    }
    return next();
  } catch (error) {
    console.error("Error in classifyProblemMiddleware:", error);
    return next();
  }
};

module.exports.classifyProblemMiddleware = classifyProblemMiddleware;
