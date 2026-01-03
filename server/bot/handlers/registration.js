const User = require("../../models/User");
const { phoneRequestKeyboard, mainMenuKeyboard } = require("../keyboards");

/**
 * Handle /start command - user registration flow
 */
const handleStart = async (ctx) => {
  try {
    const telegramId = ctx.from.id;
    const existingUser = await User.findOne({ telegramId });

    if (existingUser) {
      // User already registered
      await ctx.reply(
        `👋 Xush kelibsiz, ${existingUser.firstName || "foydalanuvchi"}!\n\n` +
          "Matematik masalalarni yechish uchun menyudan foydalaning:",
        mainMenuKeyboard()
      );
      return;
    }

    // New user - request phone number
    await ctx.reply(
      "👋 MathlyAi botiga xush kelibsiz!\n\n" +
        "Men sizga matematik masalalarni bosqichma-bosqich yechib beraman.\n\n" +
        "📱 Boshlash uchun telefon raqamingizni yuboring:",
      phoneRequestKeyboard()
    );
  } catch (error) {
    console.error("Error in handleStart:", error);
    await ctx.reply("Xatolik yuz berdi. Iltimos keyinroq urinib ko'ring.");
  }
};

/**
 * Handle phone number contact
 */
const handleContact = async (ctx) => {
  try {
    const telegramId = ctx.from.id;
    const contact = ctx.message.contact;

    // Verify it's user's own number
    if (contact.user_id !== telegramId) {
      await ctx.reply("❌ Iltimos o'zingizning telefon raqamingizni yuboring.");
      return;
    }

    // Check if user already exists
    const existingUser = await User.findOne({ telegramId });
    if (existingUser) {
      await ctx.reply(
        "✅ Siz allaqachon ro'yxatdan o'tgansiz!",
        mainMenuKeyboard()
      );
      return;
    }

    // Create new user
    const newUser = new User({
      telegramId,
      phone: contact.phone_number,
      username: ctx.from.username || "",
      firstName: ctx.from.first_name || "",
    });

    await newUser.save();

    await ctx.reply(
      "✅ Ro'yxatdan o'tish muvaffaqiyatli!\n\n" +
        `Kunlik limitingiz: ${newUser.dailyLimit} ta masala\n\n` +
        "Yechishni boshlash uchun menyudan foydalaning:",
      mainMenuKeyboard()
    );
  } catch (error) {
    console.error("Error in handleContact:", error);
    await ctx.reply(
      "Ro'yxatdan o'tishda xatolik. Iltimos /start buyrug'ini qayta yuboring."
    );
  }
};

module.exports = {
  handleStart,
  handleContact,
};
