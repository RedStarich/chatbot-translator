const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const dotenv = require('dotenv');
const fs = require('fs');
const { translate } = require('./llm.js'); // Importing the translation function
dotenv.config();

const TELEGRAM_BOT_API = process.env.TELEGRAM_BOT_API;

const bot = new TelegramBot(TELEGRAM_BOT_API, { polling: true });
bot.getMe().then((botInfo) => {
    console.log(`Bot Name: ${botInfo.first_name}`);
    console.log(`Bot Username: @${botInfo.username}`);
});

// Gender mapping constants - keep these for reference
const GENDER_MAP = {
    0: 'male',
    1: 'female',
    2: 'other'
};

const GENDER_REVERSE_MAP = {
    'male': 0,
    'female': 1,
    'other': 2
};

// Helper function to ensure data file exists
function ensureDataFileExists() {
    if (!fs.existsSync('data.json')) {
        fs.writeFileSync('data.json', JSON.stringify([]));
    }
}


// Helper function to save user data
function saveUserData(users) {
    fs.writeFileSync('data.json', JSON.stringify(users, null, 2));
}

// Improved welcome message with inline keyboard
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    await bot.sendMessage(chatId, `Your chatId is: ${chatId}`);
    
    try {
        ensureDataFileExists();
        let users = JSON.parse(fs.readFileSync('data.json', 'utf8'));
        
        if (!users.some(user => user.chatId === chatId)) {
            users.push({
                chatId: chatId,
                language: null,
                gender: null,
                friends: [],
                connected: false,
                currentConnection: null,
                name: msg.from.first_name || 'User'
            });
            
            saveUserData(users);
            
            // Welcome message with inline buttons
            const welcomeMessage = `👋 Welcome to TranslationBot!\n\nThis bot allows you to chat with friends in different languages. The bot will automatically translate messages between you.\n\nPlease set up your profile:`;
            
            const keyboard = {
                inline_keyboard: [
                    [{ text: '🌐 Set Language', callback_data: 'set_language' }],
                    [{ text: '👤 Set Gender', callback_data: 'set_gender' }]
                ]
            };
            
            await bot.sendMessage(chatId, welcomeMessage, { reply_markup: keyboard });
        } else {
            // User already exists, show main menu
            const mainMenuMessage = `👋 Welcome back to TranslationBot!`;
            
            const keyboard = {
                inline_keyboard: [
                    [{ text: '➕ Add Friend', callback_data: 'add_friend' }],
                    [{ text: '🔗 Connect', callback_data: 'connect' }],
                    [{ text: '📊 My Status', callback_data: 'status' }]
                ]
            };
            
            await bot.sendMessage(chatId, mainMenuMessage, { reply_markup: keyboard });
        }
    } catch (error) {
        console.error('Error handling data.json:', error);
        await bot.sendMessage(chatId, 'An error occurred during registration');
    }
});

// Help command with inline keyboard
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    
    const helpMessage = `*TranslationBot Commands:*\n\n` +
        `🌐 /start - Start the bot and see welcome menu\n` +
        `🌐 /language - Set your preferred language\n` +
        `👤 /gender - Set your gender (for translation grammar)\n` +
        `➕ /addfriend - Add a friend by chat ID\n` +
        `🔗 /connect - Connect with a friend to start chatting\n` +
        `🔌 /disconnect - End current conversation\n` +
        `📊 /status - Check your current status\n` +
        `❓ /help - Show this help message`;
    
    const keyboard = {
        inline_keyboard: [
            [{ text: '🌐 Set Language', callback_data: 'set_language' }],
            [{ text: '👤 Set Gender', callback_data: 'set_gender' }],
            [{ text: '➕ Add Friend', callback_data: 'add_friend' }],
            [{ text: '🔗 Connect', callback_data: 'connect' }]
        ]
    };
    
    bot.sendMessage(chatId, helpMessage, { 
        parse_mode: 'Markdown',
        reply_markup: keyboard 
    });
});

// Handle callback queries from inline buttons
bot.on('callback_query', (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const action = callbackQuery.data;
    
    // Acknowledge the callback query
    bot.answerCallbackQuery(callbackQuery.id);
    
    switch (action) {
        case 'set_language':
            handleSetLanguage(chatId);
            break;
        case 'set_gender':
            handleSetGender(chatId);
            break;
        case 'add_friend':
            handleAddFriend(chatId);
            break;
        case 'connect':
            handleConnect(chatId);
            break;
        case 'status':
            handleStatus(chatId);
            break;
        case 'disconnect':
            handleDisconnect(chatId);
            break;
        // Handle specific gender selections
        case 'gender_male':
            setGender(chatId, 0);
            break;
        case 'gender_female':
            setGender(chatId, 1);
            break;
        case 'gender_other':
            setGender(chatId, 2);
            break;
        // Handle specific friend connection
        default:
            if (action.startsWith('connect_')) {
                const friendId = parseInt(action.split('_')[1]);
                handleConnectToFriend(chatId, friendId);
            }
            break;
    }
});

// Function to set gender
function setGender(chatId, genderValue) {
    try {
        let users = JSON.parse(fs.readFileSync('data.json', 'utf8'));
        const userIndex = users.findIndex(user => user.chatId === chatId);

        if (userIndex !== -1) {
            users[userIndex].gender = genderValue;
            saveUserData(users);
            bot.sendMessage(chatId, `✅ Gender set to: ${GENDER_MAP[genderValue]}`);
            
            // Check if user has both language and gender set
            checkSetupComplete(chatId, users[userIndex]);
        }
    } catch (error) {
        console.error('Error setting gender:', error);
        bot.sendMessage(chatId, 'An error occurred while setting gender');
    }
}

// Check if user has completed the basic setup
function checkSetupComplete(chatId, user) {
    if (user.language && user.gender !== null) {
        const keyboard = {
            inline_keyboard: [
                [{ text: '➕ Add Friend', callback_data: 'add_friend' }],
                [{ text: '🔗 Connect', callback_data: 'connect' }]
            ]
        };
        
        bot.sendMessage(chatId, `✅ Setup complete! You can now add friends and start chatting.`, {
            reply_markup: keyboard
        });
    } else {
        let missingSetup = [];
        if (!user.language) missingSetup.push('language');
        if (user.gender === null) missingSetup.push('gender');
        
        bot.sendMessage(chatId, `Please complete your setup by setting your ${missingSetup.join(' and ')}.`);
    }
}

// Improved language selection with common options
function handleSetLanguage(chatId) {
    bot.sendMessage(chatId, "🌐 Enter your preferred language");
    
    // Create one-time listener
    bot.once('message', (msg) => {
        if (msg.chat.id === chatId) {
            try {
                let users = JSON.parse(fs.readFileSync('data.json', 'utf8'));
                const language = msg.text;
                const userIndex = users.findIndex(user => user.chatId === chatId);

                if (userIndex !== -1) {
                    users[userIndex].language = language;
                    saveUserData(users);
                    bot.sendMessage(chatId, `✅ Language set to: ${language}`);
                    
                    // Check if user has both language and gender set
                    checkSetupComplete(chatId, users[userIndex]);
                }
            } catch (error) {
                console.error('Error setting language:', error);
                bot.sendMessage(chatId, 'An error occurred while setting the language');
            }
        }
    });
}

// Improved gender selection with inline buttons
function handleSetGender(chatId) {
    const keyboard = {
        inline_keyboard: [
            [
                { text: '👨 Male', callback_data: 'gender_male' },
                { text: '👩 Female', callback_data: 'gender_female' },
                { text: '⚪ Other', callback_data: 'gender_other' }
            ]
        ]
    };
    
    bot.sendMessage(chatId, '👤 Select your gender (for grammatical purposes in translations):', {
        reply_markup: keyboard
    });
}

// Improved add friend with validation
function handleAddFriend(chatId) {
    bot.sendMessage(chatId, `➕ *Add a Friend*\n\nPlease enter your friend's chat ID.`, {
        parse_mode: 'Markdown'
    });

    // Create one-time listener
    bot.once('message', (msg) => {
        if (msg.chat.id === chatId) {
            const friendId = parseInt(msg.text);
            if (isNaN(friendId)) {
                bot.sendMessage(chatId, '⚠️ Invalid chat ID. Please enter a valid number.');
                return;
            }
            
            if (chatId === friendId) {
                bot.sendMessage(chatId, '⚠️ You cannot add yourself as a friend.');
                return;
            }
            
            try {
                let users = JSON.parse(fs.readFileSync('data.json', 'utf8'));
                const user = users.find(user => user.chatId === chatId);
                const friend = users.find(user => user.chatId === friendId);

                if (!friend) {
                    bot.sendMessage(chatId, '⚠️ User not found. Please check the chat ID or ask your friend to register with /start');
                    return;
                }

                if (!user.friends) user.friends = [];
                if (!friend.friends) friend.friends = [];

                if (user.friends.includes(friendId)) {
                    bot.sendMessage(chatId, '👥 Already friends!');
                    return;
                }

                // Add each other as friends
                user.friends.push(friendId);
                friend.friends.push(chatId);
                
                saveUserData(users);
                
                bot.sendMessage(chatId, `✅ Friend added successfully! You can now connect with them using /connect.`);
                bot.sendMessage(friendId, `👋 User ${chatId} has added you as a friend. You can connect with them using /connect.`);
            } catch (error) {
                console.error('Error adding friend:', error);
                bot.sendMessage(chatId, 'An error occurred while adding friend');
            }
        }
    });
}

// Improved connect command with friend list
function handleConnect(chatId) {
    try {
        let users = JSON.parse(fs.readFileSync('data.json', 'utf8'));
        const user = users.find(u => u.chatId === chatId);

        if (!user || !user.friends || user.friends.length === 0) {
            bot.sendMessage(chatId, '⚠️ You have no friends added. Add friends first using /addfriend');
            return;
        }

        if (user.currentConnection) {
            bot.sendMessage(chatId, `🔗 You are already connected to User ${user.currentConnection}. Use /disconnect first.`);
            return;
        }

        // Create inline keyboard with friend options
        const keyboard = {
            inline_keyboard: user.friends.map(friendId => {
                const friend = users.find(u => u.chatId === friendId);
                const friendName = friend ? friendId : friendId;
                const friendLang = friend && friend.language ? ` (${friend.language})` : '';
                
                return [{ text: `User ${friendName}${friendLang}`, callback_data: `connect_${friendId}` }];
            })
        };

        bot.sendMessage(chatId, '👥 Select a friend to connect with:', {
            reply_markup: keyboard
        });
    } catch (error) {
        console.error('Error handling connect:', error);
        bot.sendMessage(chatId, 'An error occurred while trying to connect');
    }
}

// Connect to a specific friend
function handleConnectToFriend(chatId, friendId) {
    try {
        let users = JSON.parse(fs.readFileSync('data.json', 'utf8'));
        const user = users.find(u => u.chatId === chatId);
        const friend = users.find(u => u.chatId === friendId);

        if (!user || !friend) {
            bot.sendMessage(chatId, '⚠️ User or friend not found');
            return;
        }
        
        if (friend.currentConnection) {
            bot.sendMessage(chatId, `⚠️ User ${friendId} is currently in another conversation. Please try again later.`);
            return;
        }

        // Set up the connection
        user.currentConnection = friendId;
        friend.currentConnection = chatId;
        
        saveUserData(users);
        
        bot.sendMessage(chatId, `🔗 Connected to User ${friendId}. You can now start chatting!`);
        bot.sendMessage(friendId, `🔗 User ${chatId} has connected with you. You can now start chatting!`);
    } catch (error) {
        console.error('Error connecting to friend:', error);
        bot.sendMessage(chatId, 'An error occurred while connecting');
    }
}

// Handle disconnect with confirmation
function handleDisconnect(chatId) {
    try {
        let users = JSON.parse(fs.readFileSync('data.json', 'utf8'));
        const user = users.find(u => u.chatId === chatId);

        if (!user || !user.currentConnection) {
            bot.sendMessage(chatId, "⚠️ You are not connected to anyone.");
            return;
        }

        const friendId = user.currentConnection;
        
        // Disconnect both users
        user.currentConnection = null;
        
        const friend = users.find(u => u.chatId === friendId);
        if (friend) {
            friend.currentConnection = null;
        }
        
        saveUserData(users);
        
        bot.sendMessage(chatId, `🔌 You have been disconnected.`);
        bot.sendMessage(friendId, `🔌 User ${chatId} has disconnected.`);
    } catch (error) {
        console.error('Error disconnecting:', error);
        bot.sendMessage(chatId, 'An error occurred while disconnecting');
    }
}

// Improved status command with more details
function handleStatus(chatId) {
    try {
        let users = JSON.parse(fs.readFileSync('data.json', 'utf8'));
        const user = users.find(u => u.chatId === chatId);

        if (!user) {
            bot.sendMessage(chatId, 'You are not registered.');
            return;
        }

        const statusMessage = 
            `📊 *Your Status*\n\n` +
            `🆔 Chat ID: ${chatId}\n` +
            `🌐 Language: ${user.language || 'not set'}\n` +
            `👤 Gender: ${user.gender !== null ? GENDER_MAP[user.gender] : 'not set'}\n` +
            `👥 Friends: ${user.friends ? user.friends.length : 0}\n` +
            `🔗 Connection: ${user.currentConnection ? `connected to User ${user.currentConnection}` : 'not connected'}`;
        
        // Create action buttons based on current status
        let keyboard = {
            inline_keyboard: []
        };
        
        if (!user.language || user.gender === null) {
            keyboard.inline_keyboard.push([
                { text: '🌐 Set Language', callback_data: 'set_language' },
                { text: '👤 Set Gender', callback_data: 'set_gender' }
            ]);
        }
        
        if (user.currentConnection) {
            keyboard.inline_keyboard.push([
                { text: '🔌 Disconnect', callback_data: 'disconnect' }
            ]);
        } else if (user.friends && user.friends.length > 0) {
            keyboard.inline_keyboard.push([
                { text: '🔗 Connect', callback_data: 'connect' }
            ]);
        }
        
        keyboard.inline_keyboard.push([
            { text: '➕ Add Friend', callback_data: 'add_friend' }
        ]);
            
        bot.sendMessage(chatId, statusMessage, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    } catch (error) {
        console.error('Error handling status:', error);
        bot.sendMessage(chatId, 'An error occurred while checking status');
    }
}

// Improved message handler with indicators
bot.on('message', async (msg) => {
    // Skip if message is a command or from the bot
    if (msg.text && msg.text.startsWith('/') || msg.from.is_bot) {
        return;
    }

    const chatId = msg.chat.id;
    
    try {
        let users = JSON.parse(fs.readFileSync('data.json', 'utf8'));
        const user = users.find(u => u.chatId === chatId);

        if (user && user.currentConnection) {
            const recipientId = user.currentConnection;
            const recipientUser = users.find(u => u.chatId === recipientId);
            
            if (!recipientUser) {
                console.error(`Recipient ${recipientId} not found`);
                return;
            }

            // Show typing indicator
            bot.sendChatAction(recipientId, 'typing');
            
            let messageContent;
            
            // Handle different message types
            if (msg.text) {
                // Text message
                messageContent = msg.text;
                
                // Include gender information in translation
                let translatedMessage = await translate(
                    messageContent, 
                    user.language, 
                    recipientUser.language, 
                    user.gender, 
                    recipientUser.gender
                );
                
                console.log(`Translating from ${user.language} to ${recipientUser.language}`);
                console.log(`Sender gender: ${user.gender} (${GENDER_MAP[user.gender]})`);
                console.log(`Receiver gender: ${recipientUser.gender} (${GENDER_MAP[recipientUser.gender]})`);
                
                bot.sendMessage(recipientId, translatedMessage);
            } else if (msg.photo) {
                // Photo with optional caption
                const photoId = msg.photo[msg.photo.length - 1].file_id;
                
                if (msg.caption) {
                    // Translate caption
                    const translatedCaption = await translate(
                        msg.caption,
                        user.language,
                        recipientUser.language,
                        user.gender,
                        recipientUser.gender
                    );
                    
                    bot.sendPhoto(recipientId, photoId, { caption: translatedCaption });
                } else {
                    bot.sendPhoto(recipientId, photoId);
                }
            } 
            else if (msg.document) {
                // Document
                bot.sendDocument(recipientId, msg.document.file_id);
            } else {
                // Unsupported message type
                bot.sendMessage(recipientId, "📨 [Received a message type that cannot be translated]");
            }
        }
    } catch (error) {
        console.error('Error handling message:', error);
    }
});

// Backward compatibility with old commands
bot.onText(/\/language/, (msg) => {
    handleSetLanguage(msg.chat.id);
});

bot.onText(/\/gender/, (msg) => {
    handleSetGender(msg.chat.id);
});

bot.onText(/\/addfriend/, (msg) => {
    handleAddFriend(msg.chat.id);
});

bot.onText(/\/status/, (msg) => {
    handleStatus(msg.chat.id);
});

bot.onText(/\/connect/, (msg) => {
    handleConnect(msg.chat.id);
});

bot.onText(/\/disconnect/, (msg) => {
    handleDisconnect(msg.chat.id);
});

console.log('Bot is running with improved UX...');