const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const GEMINI_API_KEY = dotenv.parse.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// Gender mapping constants
const GENDER_MAP = {
  0: 'male',
  1: 'female',
  2: 'other'
};

async function translate(msg, languageFrom, languageTo, senderGenderInt, receiverGenderInt) {
  try {
    // Convert gender integers to text representation for the API
    const senderGender = senderGenderInt !== null && senderGenderInt !== undefined 
      ? GENDER_MAP[senderGenderInt] 
      : 'unknown';
      
    const receiverGender = receiverGenderInt !== null && receiverGenderInt !== undefined 
      ? GENDER_MAP[receiverGenderInt] 
      : 'unknown';
    
    console.log(`Translation request with sender gender: ${senderGender}, receiver gender: ${receiverGender}`);
    
    const promptMessages = [
      {
        role: 'user',
        parts: [
          {
            text: `
Translate the following text from ${languageFrom} to ${languageTo}, preserving the original meaning, tone, context, and cultural nuances.
The sender's gender is ${senderGender} and the receiver's gender is ${receiverGender}.
Please consider this gender information when creating a grammatically correct translation, especially for languages where words and phrases change based on gender.
Ensure the translation sounds natural and retains the style and emotion of the original text. Just give one translation, no explanation needed.

Text:
            `
          },
          { text: msg },
        ],
      },
    ];

    const response = await axios.post(
      GEMINI_URL,
      {
        contents: promptMessages,
        generationConfig: {
          temperature: 0.9,
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
    
    const content = response.data.candidates[0]?.content.parts[0].text;
    return content;
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    throw error;
  }
}

// Run this block only if llm.js is run directly
if (require.main === module) {
  async function runTranslation(message) {
    // When running as a standalone script, test with sample gender values
    const response = await translate(message, "Russian", "Kazakh", 0, 1); // 0=male, 1=female
    console.log("Translation: " + response);
  }
  
  const prompt = require('prompt-sync')();
  const message = prompt('Enter message: ');
  runTranslation(message);
} else {
  module.exports = { translate };
}