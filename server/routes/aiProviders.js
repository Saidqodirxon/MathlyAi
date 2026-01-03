const express = require("express");
const AIProvider = require("../models/AIProvider");
const { authenticateToken } = require("../utils/auth");

const router = express.Router();

/**
 * GET /api/ai-providers
 * Get all AI providers with their configs
 */
router.get("/", authenticateToken, async (req, res) => {
  try {
    const providers = await AIProvider.find().sort({ provider: 1 });

    res.json({
      success: true,
      providers,
    });
  } catch (error) {
    console.error("Get AI providers error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PATCH /api/ai-providers/:id/activate
 * Activate a provider (deactivates others)
 */
router.patch("/:id/activate", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Deactivate all providers
    await AIProvider.updateMany({}, { isActive: false });

    // Activate selected provider
    const provider = await AIProvider.findByIdAndUpdate(
      id,
      { isActive: true },
      { new: true }
    );

    if (!provider) {
      return res.status(404).json({ error: "Provider not found" });
    }

    res.json({
      success: true,
      provider,
    });
  } catch (error) {
    console.error("Activate provider error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PATCH /api/ai-providers/:id/model
 * Update selected model for a provider
 */
router.patch("/:id/model", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { selectedModel } = req.body;

    const provider = await AIProvider.findByIdAndUpdate(
      id,
      { selectedModel },
      { new: true }
    );

    if (!provider) {
      return res.status(404).json({ error: "Provider not found" });
    }

    res.json({
      success: true,
      provider,
    });
  } catch (error) {
    console.error("Update model error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/ai-providers/:id/tokens
 * Add a new token to provider
 */
router.post("/:id/tokens", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { key, label, dailyLimit } = req.body;

    if (!key) {
      return res.status(400).json({ error: "Token key is required" });
    }

    const provider = await AIProvider.findById(id);
    if (!provider) {
      return res.status(404).json({ error: "Provider not found" });
    }

    provider.tokens.push({
      key,
      label: label || `Token ${provider.tokens.length + 1}`,
      dailyLimit: dailyLimit || 1000,
      isActive: true,
    });

    await provider.save();

    res.json({
      success: true,
      provider,
    });
  } catch (error) {
    console.error("Add token error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PATCH /api/ai-providers/:providerId/tokens/:tokenId
 * Update a token
 */
router.patch(
  "/:providerId/tokens/:tokenId",
  authenticateToken,
  async (req, res) => {
    try {
      const { providerId, tokenId } = req.params;
      const { key, label, dailyLimit, isActive } = req.body;

      const provider = await AIProvider.findById(providerId);
      if (!provider) {
        return res.status(404).json({ error: "Provider not found" });
      }

      const token = provider.tokens.id(tokenId);
      if (!token) {
        return res.status(404).json({ error: "Token not found" });
      }

      if (key !== undefined) token.key = key;
      if (label !== undefined) token.label = label;
      if (dailyLimit !== undefined) token.dailyLimit = dailyLimit;
      if (isActive !== undefined) token.isActive = isActive;

      await provider.save();

      res.json({
        success: true,
        provider,
      });
    } catch (error) {
      console.error("Update token error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * DELETE /api/ai-providers/:providerId/tokens/:tokenId
 * Delete a token
 */
router.delete(
  "/:providerId/tokens/:tokenId",
  authenticateToken,
  async (req, res) => {
    try {
      const { providerId, tokenId } = req.params;

      const provider = await AIProvider.findById(providerId);
      if (!provider) {
        return res.status(404).json({ error: "Provider not found" });
      }

      provider.tokens.pull(tokenId);
      await provider.save();

      res.json({
        success: true,
        provider,
      });
    } catch (error) {
      console.error("Delete token error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * POST /api/ai-providers/:id/test
 * Test a provider with a simple math query
 */
router.post("/:id/test", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const provider = await AIProvider.findById(id);
    if (!provider) {
      return res.status(404).json({ error: "Provider not found" });
    }

    if (!provider.isActive) {
      return res.status(400).json({ error: "Provider is not active" });
    }

    if (provider.tokens.length === 0) {
      return res
        .status(400)
        .json({ error: "No tokens configured for this provider" });
    }

    const activeTokens = provider.tokens.filter((t) => t.isActive);
    if (activeTokens.length === 0) {
      return res.status(400).json({ error: "No active tokens available" });
    }

    // Import AI service
    const { callAIWithFallback } = require("../services/aiService");

    const testQuery = "What is 15 + 27?";
    const startTime = Date.now();

    try {
      const answer = await callAIWithFallback(testQuery);
      const responseTime = Date.now() - startTime;

      return res.json({
        success: true,
        testQuery,
        answer,
        responseTime,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message || "AI service failed",
      });
    }
  } catch (error) {
    console.error("Test provider error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
