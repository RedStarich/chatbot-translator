const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const dotenv = require('dotenv');
const fs = require('fs');
const { json } = require('body-parser');
dotenv.config();

const TELEGRAM_BOT_API = dotenv.parse.TELEGRAM_BOT_API || process.env.TELEGRAM_BOT_API;
const GEMINI_API_KEY = dotenv.parse.GEMINI_API_KEY || process.env.GEMINI_API_KEY;

const bot = new TelegramBot(TELEGRAM_BOT_API, { polling: true });

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

let connected = false;

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    connectId = chatId;
    bot.sendMessage(chatId, 'Welcome to the IceBreaker bot! \ Your chatId is: ' + chatId);

    //read data from data.json, add new user instance if not exists
    fs.readFile('data.json', 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading data.json:', err);
            return;
        }
        let users = JSON.parse(data);
        if (!users.some(user => user.chatId === chatId)) {
            users.push({ chatId: chatId });
            fs.writeFile('data.json', JSON.stringify(users), (err) => {
                if (err) {
                    console.error('Error writing data.json:', err);
                }
            });
        }
    });
});

bot.onText(/\/language/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "Enter your preferred language");
    bot.on('message', (msg) => {
        fs.readFile('data.json', 'utf8', (err, data) => {
            if (err) {
                console.error('Error reading data.json:', err);
                return;
            }
            const language = msg.text;
            let users = JSON.parse(data);
            const userIndex = users.findIndex(user => user.chatId === chatId);
            if (userIndex === -1) {
                users.push({ chatId: chatId, language: language });
            } else {
                users[userIndex].language = language;
            }
            fs.writeFile('data.json', JSON.stringify(users), (err) => {
                if (err) {
                    console.error('Error writing data.json:', err);
                }
            });
        });
    });
});

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

bot.onText(/\/addfriend/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Enter the chatId of the friend you want to add');
    bot.once('message', (response) => {
        const friendId = parseInt(response.text);
        fs.readFile('data.json', 'utf8', (err, data) => {
            if (err) {
                console.error('Error reading data.json:', err);
                return;
            }
            let users = JSON.parse(data);
            const user = users.find(user => user.chatId === chatId);
            const friend = users.find(user => user.chatId === friendId);

            if (!user || !friend) {
                bot.sendMessage(chatId, 'User or friend not found');
                return;
            }

            if (!user.friends) user.friends = [];
            if (!friend.friends) friend.friends = [];

            if (!user.friends.includes(friendId)) {
                user.friends.push(friendId);
                friend.friends.push(chatId);
                fs.writeFile('data.json', JSON.stringify(users), (err) => {
                    if (err) {
                        console.error('Error writing data.json:', err);
                        return;
                    }
                    bot.sendMessage(chatId, 'Friend added successfully!');
                });
            } else {
                bot.sendMessage(chatId, 'Already friends!');
            }
        });
    });
});

//TODO: establish and manage connection between two chatIds

bot.onText(/\/connect/, (msg) => {
    const chatId = msg.chat.id;
    console.log('connectId:', connectId);
    //show array of friends to choose current connection
    if (connectId === chatId) {
        bot.sendMessage(chatId, 'You are not connected to any chatId');
        //select friend from list of friends

        fs.readFile('data.json', 'utf8', (err, data) => {
            if (err) {
                console.error('Error reading data.json:', err);
                return;
            }
            let users = JSON.parse(data);
            const user = users.find(u => u.chatId === chatId);
            if (!user || !user.friends || user.friends.length === 0) {
                bot.sendMessage(chatId, 'You have no friends added');
                return;
            }

            const friendsList = user.friends.map((friendId, index) => {
                return `${index + 1}. ChatID: ${friendId}`;
            }).join('\n');

            bot.sendMessage(chatId, 'Your friends:\n' + friendsList + '\n\nEnter the number of the friend to connect with');
            bot.once('message', (response) => {
                const selection = parseInt(response.text) - 1;
                if (selection >= 0 && selection < user.friends.length) {
                    connectId = user.friends[selection];
                    bot.sendMessage(chatId, `Connected to chat ${connectId}`);
                } else {
                    bot.sendMessage(chatId, 'Invalid selection');
                }
            });
        });
    } else {

    }

});

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const message = msg.text;
    if (connected === true) {
        bot.sendMessage(connectId, message);
    }
    
    bot.sendMessage(connectId, message);

});

console.log('Bot is running...');
