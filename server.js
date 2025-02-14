const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const TELEGRAM_BOT_API = dotenv.parse.TELEGRAM_BOT_API || process.env.TELEGRAM_BOT_API;
const GEMINI_API_KEY = dotenv.parse.GEMINI_API_KEY || process.env.GEMINI_API_KEY;

const bot = new TelegramBot(TELEGRAM_BOT_API, { polling: true });

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;


bot.onText(/\/gemini (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const requestText = match[1];

    try {
        console.log('Incoming request:', requestText); // Log request text
        const response = await axios.post(GEMINI_URL, {
            contents: [{
                parts: [{
                    text: requestText
                }]
            }]
        });
        console.log('API response:', response.data); // Log API response
        bot.sendMessage(chatId, response.data.candidates[0].content.parts[0].text);
    } catch (error) {
        console.error('Error response:', error.response ? error.response.data : error.message);
        bot.sendMessage(chatId, 'Failed to fetch Gemini response');
    }
});

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Received your message');
    bot.sendMessage(chatId, 'Please use /gemini command to generate content');
});

console.log('Bot is running...');
