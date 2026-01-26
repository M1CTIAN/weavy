// list-models.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

// PASTE YOUR NEW KEY HERE
const apiKey = "AIzaSyDSp9wjzCX6bqPhIjCUhX-Y7XcR6XtUE_c"; 

const genAI = new GoogleGenerativeAI(apiKey);

async function list() {
  try {
    console.log("🔍 Querying Google API for available models...");
    // 1. Get the raw model list
    // Note: We use the underlying 'makeRequest' implicitly via getGenerativeModel for list if supported,
    // but the SDK exposes a cleaner way only in newer versions. 
    // Let's use a raw fetch to be 100% sure what the API sees.
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const data = await response.json();

    if (data.error) {
        console.error("❌ API Error:", data.error.message);
        return;
    }

    console.log("\n✅ AVAILABLE MODELS FOR THIS KEY:");
    const models = data.models || [];
    
    // Filter for "generateContent" supported models
    const generateModels = models.filter(m => m.supportedGenerationMethods.includes("generateContent"));
    
    if (generateModels.length === 0) {
        console.log("⚠️ No generation models found! (This implies a region/account lock)");
    } else {
        generateModels.forEach(m => console.log(`   - ${m.name} (${m.displayName})`));
    }

  } catch (error) {
    console.error("❌ Network Error:", error.message);
  }
}

list();