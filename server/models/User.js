const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  telegramId: {
    type: Number,
    required: true,
    unique: true,
    index: true,
  },
  phone: {
    type: String,
    required: true,
  },
  username: {
    type: String,
    default: "",
  },
  firstName: {
    type: String,
    default: "",
  },
  dailyLimit: {
    type: Number,
    default: 5,
  },
  usedToday: {
    type: Number,
    default: 0,
  },
  lastUsedDate: {
    type: Date,
    default: Date.now,
  },
  isBlocked: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("User", userSchema);
