const bcrypt = require("bcryptjs");
const Admin = require("../models/Admin");

/**
 * Initialize default admin account
 * Creates an admin user if none exists
 */
const initializeAdmin = async () => {
  try {
    const adminCount = await Admin.countDocuments();

    if (adminCount === 0) {
      const username = process.env.ADMIN_USERNAME || "admin";
      const password = process.env.ADMIN_PASSWORD || "admin123";

      const hashedPassword = await bcrypt.hash(password, 10);

      const admin = new Admin({
        username,
        password: hashedPassword,
      });

      await admin.save();
      console.log("✅ Default admin account created");
      console.log(`   Username: ${username}`);
      console.log(`   Password: ${password}`);
      console.log("   ⚠️  Please change the password after first login!");
    }
  } catch (error) {
    console.error("Error initializing admin:", error);
  }
};

module.exports = {
  initializeAdmin,
};
