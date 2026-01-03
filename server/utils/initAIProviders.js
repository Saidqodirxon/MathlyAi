const AIProvider = require("../models/AIProvider");

/**
 * Initialize default AI providers if they don't exist
 */
const initializeAIProviders = async () => {
  try {
    const providersCount = await AIProvider.countDocuments();

    if (providersCount === 0) {
      console.log("Initializing default AI providers...");

      // OpenAI / ChatGPT
      await AIProvider.create({
        provider: "openai",
        displayName: "OpenAI ChatGPT",
        isActive: false,
        selectedModel: "gpt-4o-mini",
        availableModels: ["gpt-4o-mini"],
        tokens: [],
        apiEndpoint: "https://api.openai.com/v1/chat/completions",
      });

      // // Google Gemini
      // await AIProvider.create({
      //   provider: "gemini",
      //   displayName: "Google Gemini",
      //   isActive: false,
      //   selectedModel: "gemini-2.0-flash-exp",
      //   availableModels: [
      //     "gemini-2.0-flash-exp",
      //     "gemini-1.5-flash",
      //     "gemini-1.5-pro",
      //     "gemini-1.5-flash-8b",
      //   ],
      //   tokens: [],
      //   apiEndpoint: "https://generativelanguage.googleapis.com/v1beta/models",
      // });

      // // Anthropic Claude
      // await AIProvider.create({
      //   provider: "claude",
      //   displayName: "Anthropic Claude",
      //   isActive: false,
      //   selectedModel: "claude-3-sonnet-20240229",
      //   availableModels: [
      //     "claude-3-opus-20240229",
      //     "claude-3-sonnet-20240229",
      //     "claude-3-haiku-20240307",
      //     "claude-3-5-sonnet-20240620",
      //   ],
      //   tokens: [],
      //   apiEndpoint: "https://api.anthropic.com/v1/messages",
      // });

      console.log("✅ AI providers initialized");
    }
  } catch (error) {
    console.error("Error initializing AI providers:", error);
  }
};

module.exports = { initializeAIProviders };
