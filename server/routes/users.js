const express = require("express");
const User = require("../models/User");
const { authenticateToken } = require("../utils/auth");

const router = express.Router();

/**
 * GET /api/users
 * Get all users (protected)
 */
router.get("/", authenticateToken, async (req, res) => {
  try {
    const users = await User.find().select("-__v").sort({ createdAt: -1 });

    res.json({
      success: true,
      users,
    });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PATCH /api/users/global-limit
 * Update daily limit for all users (protected)
 * NOTE: Must be before /:id route to avoid route collision
 */
router.patch("/global-limit", authenticateToken, async (req, res) => {
  try {
    const { dailyLimit } = req.body;

    if (dailyLimit === undefined) {
      return res.status(400).json({ error: "dailyLimit is required" });
    }

    if (typeof dailyLimit !== "number" || dailyLimit < 0) {
      return res
        .status(400)
        .json({ error: "dailyLimit must be a positive number" });
    }

    // Update all users
    const result = await User.updateMany({}, { dailyLimit });

    res.json({
      success: true,
      message: `Updated ${result.modifiedCount} users`,
      updatedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Update global limit error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PATCH /api/users/:id
 * Update user (protected)
 */
router.patch("/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { dailyLimit } = req.body;

    if (dailyLimit === undefined) {
      return res.status(400).json({ error: "dailyLimit is required" });
    }

    if (typeof dailyLimit !== "number" || dailyLimit < 0) {
      return res
        .status(400)
        .json({ error: "dailyLimit must be a positive number" });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { dailyLimit },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PATCH /api/users/:id/block
 * Block/unblock user (protected)
 */
router.patch("/:id/block", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { isBlocked } = req.body;

    if (isBlocked === undefined) {
      return res.status(400).json({ error: "isBlocked is required" });
    }

    const user = await User.findByIdAndUpdate(id, { isBlocked }, { new: true });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Block user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
