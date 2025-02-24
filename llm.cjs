const axios = require('axios');
const dotenv = require('dotenv');
const fs = require('fs');
const { json } = require('body-parser');
dotenv.config();

const TELEGRAM_BOT_API = dotenv.parse.TELEGRAM_BOT_API || process.env.TELEGRAM_BOT_API;
const GEMINI_API_KEY = dotenv.parse.GEMINI_API_KEY || process.env.GEMINI_API_KEY;

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

async function translate(msg, languageFrom, languageTo) {
    try {

        const promptMessages = [
            {
              role: 'user',
              parts: [
                { text: `              
Translate the following text from ${languageFrom} to ${languageTo}, preserving the original meaning, tone, context, and cultural nuances. 
Ensure the translation sounds natural and retains the style and emotion of the original text. Just give one translation, no explanation needed.

Text:
                    ` },
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
    
        const content = response.data.candidates[0]?.content.parts[0].text
        
        return content;
      } catch (error) {
        console.error('Error:', error.response?.data || error.message);
        throw error;
      }
    
}




// Run this block only if llm.js is run directly
if (require.main === module) {

    async function runTranslation(message) {
        const response = await translate(message, "English", "Filipino");
        console.log("Translation: " + response);
      }

    const prompt = require('prompt-sync')();
    const message = prompt('Enter message: ');
    
    runTranslation(message)

    

} else {
    module.exports = {translate}
}