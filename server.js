const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const dotenv = require('dotenv');
const fs = require('fs');
const { json } = require('body-parser');
dotenv.config();

const TELEGRAM_BOT_API = dotenv.parse.TELEGRAM_BOT_API || process.env.TELEGRAM_BOT_API;
const GEMINI_API_KEY = dotenv.parse.GEMINI_API_KEY || process.env.GEMINI_API_KEY;

const bot = new TelegramBot(TELEGRAM_BOT_API, { polling: true });
bot.getMe().then((botInfo) => {
    console.log(`Bot Name: ${botInfo.first_name}`);
    console.log(`Bot Username: @${botInfo.username}`);
});


const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

let connected = false;

bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    await bot.sendMessage(chatId, `Your chatId is: ${chatId}`);
    try {
        let users = JSON.parse(fs.readFileSync('data.json', 'utf8') || '[]');
        if (!users.some(user => user.chatId === chatId)) {
            users.push({
                chatId: chatId,
                language: null,
                friends: [],
                connected: false,
                currentConnection: null
            });
            fs.writeFileSync('data.json', JSON.stringify(users, null, 2));
            await bot.sendMessage(chatId, 'Welcome! New user registered.');
        }
    } catch (error) {
        console.error('Error handling data.json:', error);
        await bot.sendMessage(chatId, 'An error occurred during registration');
    }
});
// Create data.json if it doesn't exist
bot.onText(/\/language/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "Enter your preferred language");
    // Create one-time listener
    bot.once('message', (msg) => {
        try {
            let users = JSON.parse(fs.readFileSync('data.json', 'utf8') || '[]');
            const language = msg.text;
            const userIndex = users.findIndex(user => user.chatId === chatId);

            if (userIndex === -1) {
                users.push({
                    chatId: chatId,
                    language: language,
                    friends: [],
                    connected: false,
                    currentConnection: null
                });
            } else {
                users[userIndex].language = language;
            }

            fs.writeFileSync('data.json', JSON.stringify(users, null, 2));
            bot.sendMessage(chatId, `Language set to: ${language}`);
        } catch (error) {
            console.error('Error handling data.json:', error);
            bot.sendMessage(chatId, 'An error occurred while setting the language');
        }
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

        if (user.currentConnection) {
            bot.sendMessage(chatId, `Already connected to ${user.currentConnection}`);
            return;
        }

        const friendsList = user.friends.map((friendId, index) => {
            return `${index + 1}. ChatID: ${friendId}`;
        }).join('\n');

        bot.sendMessage(chatId, 'Your friends:\n' + friendsList + '\n\nEnter the number of the friend to connect with');
        bot.once('message', (response) => {
            const selection = parseInt(response.text) - 1;
            if (selection >= 0 && selection < user.friends.length) {
                const friendId = user.friends[selection];
                user.currentConnection = friendId;

                const friend = users.find(u => u.chatId === friendId);
                if (friend) {
                    friend.currentConnection = chatId;
                }

                fs.writeFileSync('data.json', JSON.stringify(users, null, 2));
                bot.sendMessage(chatId, `Connected to chat ${friendId}`);
                bot.sendMessage(friendId, `User ${chatId} has connected with you`);
            } else {
                bot.sendMessage(chatId, 'Invalid selection');
            }
        });
    });
});


bot.onText(/\/disconnect/, (msg) => {
    const chatId = msg.chat.id;
    console.log(`User ${chatId} is disconnecting...`);

    fs.readFile('data.json', 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading data.json:', err);
            bot.sendMessage(chatId, '⚠️ An error occurred. Please try again later.');
            return;
        }

        let users = JSON.parse(data);
        const user = users.find(u => u.chatId === chatId);

        if (!user || !user.currentConnection) {
            bot.sendMessage(chatId, "You are not connected to anyone.");
            return;
        }

        const disconnectedUser = user.currentConnection;
        user.currentConnection = null;

        // Also remove connection from the other user
        const friend = users.find(u => u.chatId === disconnectedUser);
        if (friend) {
            friend.currentConnection = null;
        }

        fs.writeFile('data.json', JSON.stringify(users, null, 2), (err) => {
            if (err) {
                console.error('Error writing data.json:', err);
                bot.sendMessage(chatId, 'An error occurred while disconnecting.');
                return;
            }

            bot.sendMessage(chatId, `You have been disconnected.`);
            bot.sendMessage(disconnectedUser, `User ${chatId} has disconnected.`);
        });
    });
});


bot.onText(/\/status/, (msg) => {

    const chatId = msg.chat.id;
    fs.readFile('data.json', 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading data.json:', err);
            bot.sendMessage(chatId, '⚠️ An error occurred. Please try again later.');
            return;
        }

        let users = JSON.parse(data);
        const user = users.find(u => u.chatId === chatId);

        if (!user) {
            bot.sendMessage(chatId, 'You are not registered.');
            return;
        }

        if (user.currentConnection) {
            bot.sendMessage(chatId, `Status: connected to ${user.currentConnection}`);
        } else {
            bot.sendMessage(chatId, 'Status: unconnected');
        }
    });
});

bot.on('message', (msg) => {
    // Skip if message is a command or from the bot
    if (msg.text.startsWith('/') || msg.from.is_bot) {
        return;
    }

    const chatId = msg.chat.id;
    const message = msg.text;

    // Read user connections from data.json
    fs.readFile('data.json', 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading data.json:', err);
            return;
        }

        let users = JSON.parse(data);
        const user = users.find(u => u.chatId === chatId);

        if (user && user.currentConnection) {
            const recipient = user.currentConnection;
            bot.sendMessage(recipient, `Message sent to ${recipient}: ${message}`);
        }
    });
});


console.log('Bot is running...');
