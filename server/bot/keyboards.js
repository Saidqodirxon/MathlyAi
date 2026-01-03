const { Markup } = require("telegraf");

/**
 * Main menu keyboard with primary actions
 */
const mainMenuKeyboard = () => {
  return Markup.keyboard([
    ["🧮 Masalani Yechish"],
    ["📊 Limitim", "ℹ️ Yordam"],
  ]).resize();
};

/**
 * Request phone number keyboard
 */
const phoneRequestKeyboard = () => {
  return Markup.keyboard([
    Markup.button.contactRequest("📱 Telefon Raqamni Yuborish"),
  ]).resize();
};

/**
 * Retry channel subscription button
 */
const channelCheckKeyboard = (channelUsername) => {
  return Markup.inlineKeyboard([
    [
      Markup.button.url(
        "Kanalga A'zo Bo'lish",
        `https://t.me/${channelUsername.replace("@", "")}`
      ),
    ],
    [Markup.button.callback("✅ A'zo Bo'ldim", "check_subscription")],
  ]);
};

/**
 * Remove keyboard
 */
const removeKeyboard = () => {
  return Markup.removeKeyboard();
};

module.exports = {
  mainMenuKeyboard,
  phoneRequestKeyboard,
  channelCheckKeyboard,
  removeKeyboard,
};
