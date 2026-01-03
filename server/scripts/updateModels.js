const mongoose = require("mongoose");
const AIProvider = require("../models/AIProvider");

async function updateModels() {
  try {
    // MongoDB ga ulanish
    const MONGODB_URI = process.env.MONGODB_URI;
    await mongoose.connect(MONGODB_URI);
    console.log("✅ MongoDB ga ulandi");

    // OpenAI providerini topish va yangilash
    const result = await AIProvider.updateOne(
      { provider: "openai" },
      {
        $set: {
          availableModels: ["gpt-4o-mini"],
          selectedModel: "gpt-4o-mini",
        },
      }
    );

    console.log("✅ Modellar yangilandi:", result);

    await mongoose.connection.close();
    console.log("✅ Tayyor!");
  } catch (error) {
    console.error("❌ Xato:", error);
    process.exit(1);
  }
}

updateModels();
