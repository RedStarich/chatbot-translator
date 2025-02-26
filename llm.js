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
          {
            text: `              
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
    const response = await translate(message, "Russian", "Kazakh");
    console.log("Translation: " + response);
  }

  const prompt = require('prompt-sync')();
  const message = prompt('Enter message: ');
  //     message = `
  //     Once upon a time, in a tiny village nestled between two towering mountains, lived a curious boy named Leo. Unlike the other villagers, Leo wasn’t interested in farming or fishing—he was fascinated by the stars. Every night, he’d climb the tallest hill, lie on his back, and gaze at the shimmering sky.

  // One evening, as Leo traced constellations with his finger, a shooting star streaked across the sky, brighter and longer than any he’d ever seen. But instead of fading, it grew larger until it crashed into the forest nearby. Heart pounding with excitement, Leo rushed toward the glow.

  // In a clearing, he found not a burning rock, but a tiny, silver creature with eyes like the night sky. “I’m Mira,” the creature said, “I got lost. Can you help me find my way back to the stars?”

  // Without hesitation, Leo nodded. Together, they journeyed to the peak of the tallest mountain. Along the way, they crossed rivers, faced mischievous winds, and even outsmarted a grumpy owl who demanded riddles be solved before passing. At the summit, Mira’s body began to glow. “Thank you, Leo,” she said. “Look up tonight. I’ll send you a sign.”

  // With a flash, she soared upward, leaving a sparkling trail. That night, lying on his hill, Leo spotted a new constellation—a tiny, silver star winking just for him.

  // From then on, whenever someone asked Leo why he smiled at the night sky, he’d simply say, “It’s a secret between me and the stars.” 🌟
  //     `

  runTranslation(message)



} else {
  module.exports = { translate }
}