const mongoose = require("mongoose");

const tokenSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
  },
  label: {
    type: String,
    default: "Token 1",
  },
  usageCount: {
    type: Number,
    default: 0,
  },
  dailyLimit: {
    type: Number,
    default: 1000, // Daily request limit
  },
  usedToday: {
    type: Number,
    default: 0,
  },
  lastUsedDate: {
    type: Date,
    default: Date.now,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
});

const aiProviderSchema = new mongoose.Schema({
  provider: {
    type: String,
    enum: ["openai", "gemini", "claude"],
    required: true,
    unique: true,
  },
  displayName: {
    type: String,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: false,
  },
  selectedModel: {
    type: String,
    default: "",
  },
  availableModels: {
    type: [String],
    default: [],
  },
  tokens: [tokenSchema],
  totalUsage: {
    type: Number,
    default: 0,
  },
  apiEndpoint: {
    type: String,
    default: "",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update timestamp on save
aiProviderSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("AIProvider", aiProviderSchema);
