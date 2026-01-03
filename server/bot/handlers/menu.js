const { mainMenuKeyboard } = require("../keyboards");

/**
 * Handle help command/button
 */
const handleHelp = async (ctx) => {
  const helpText = `
ℹ️ *MathlyAi dan Qanday Foydalanish*

1️⃣ *Matn Ko'rinishida Masala Yuborish*
Matematik masalangizni yozing va yuboring.
Misol: "Yech: 2x + 5 = 15"

2️⃣ *Rasm Ko'rinishida Yuborish*
Matematik masalangizni suratga olib yuboring.

3️⃣ *Yechim Olish*
Men sizga bosqichma-bosqich tushuntirish bilan javob beraman.

📊 *Kunlik Limit*
Sizda kunlik masala yechish limiti bor.
Qolgan limitni "Limitim" tugmasi orqali tekshiring.

❓ *Yordam Kerakmi?*
Muammo bo'lsa qo'llab-quvvatlash xizmatiga murojaat qiling.
  `;

  await ctx.reply(helpText, { parse_mode: "Markdown", ...mainMenuKeyboard() });
};

/**
 * Handle "My Limit" button
 */
const handleMyLimit = async (ctx) => {
  try {
    const user = ctx.state.user;

    // Reset if new day
    const today = new Date().toDateString();
    const lastUsed = new Date(user.lastUsedDate).toDateString();

    if (today !== lastUsed) {
      user.usedToday = 0;
      user.lastUsedDate = new Date();
      await user.save();
    }

    const remaining = user.dailyLimit - user.usedToday;

    await ctx.reply(
      `📊 *Sizning Foydalanishingiz*\n\n` +
        `✅ Bugun foydalanildi: ${user.usedToday}\n` +
        `📝 Kunlik limit: ${user.dailyLimit}\n` +
        `🔄 Qolgan: ${remaining}\n\n` +
        `${
          remaining === 0
            ? "❌ Limitingiz tugadi. Ertaga qayta urinib ko'ring!"
            : "✨ Davom eting!"
        }`,
      { parse_mode: "Markdown" }
    );
  } catch (error) {
    console.error("Error in handleMyLimit:", error);
    await ctx.reply("Xatolik yuz berdi. Iltimos keyinroq urinib ko'ring.");
  }
};

module.exports = {
  handleHelp,
  handleMyLimit,
};
