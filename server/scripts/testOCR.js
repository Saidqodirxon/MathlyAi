const axios = require("axios");
const FormData = require("form-data");

async function testOCR() {
  try {
    // Test image URL (your attached image)
    const imageUrl = "https://i.imgur.com/test.png"; // Replace with actual URL

    const form = new FormData();
    form.append("url", imageUrl);
    form.append("language", "eng");
    form.append("isOverlayRequired", "false");
    form.append("detectOrientation", "true");
    form.append("scale", "true");
    form.append("OCREngine", "2");

    console.log("🔍 Testing OCR with API key:", process.env.OCR_API_KEY);
    console.log("📸 Image URL:", imageUrl);

    const ocrResponse = await axios.post(
      "https://api.ocr.space/parse/image",
      form,
      {
        headers: {
          ...form.getHeaders(),
          apikey: process.env.OCR_API_KEY,
        },
        timeout: 30000,
      }
    );

    console.log("\n✅ OCR Response:");
    console.log(JSON.stringify(ocrResponse.data, null, 2));

    if (ocrResponse.data?.ParsedResults?.[0]?.ParsedText) {
      const text = ocrResponse.data.ParsedResults[0].ParsedText.trim();
      console.log("\n📝 Extracted Text:");
      console.log(text);
    } else {
      console.log("\n❌ No text extracted");
      console.log("Error:", ocrResponse.data?.ErrorMessage);
    }
  } catch (error) {
    console.error("\n❌ OCR Error:");
    console.error("Status:", error.response?.status);
    console.error("Data:", error.response?.data);
    console.error("Message:", error.message);
  }
}

testOCR();
