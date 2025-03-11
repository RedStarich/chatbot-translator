const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const dotenv = require('dotenv');
const { User } = require('./db.js'); // Import User model instead of using fs
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

// Helper function to find or create user
async function findOrCreateUser(chatId, name) {
    try {
        let user = await User.findOne({ chatId });
        
        if (!user) {
            user = new User({
                chatId,
                language: null,
                gender: null,
                friends: [],
                connected: false,
                currentConnection: null,
                name: name || 'User'
            });
            
            await user.save();
        }
        
        return user;
    } catch (error) {
        console.error('Error finding or creating user:', error);
        throw error;
    }
}

// Improved welcome message with inline keyboard
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    await bot.sendMessage(chatId, `Your chatId is: ${chatId}`);
    
    try {
        const user = await findOrCreateUser(chatId, msg.from.first_name);
        
        if (!user.language || user.gender === null) {
            // Welcome message with inline buttons for new users
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
        console.error('Error in start command:', error);
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
bot.on('callback_query', async (callbackQuery) => {
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
async function setGender(chatId, genderValue) {
    try {
        const user = await User.findOneAndUpdate(
            { chatId }, 
            { gender: genderValue },
            { new: true }
        );

        if (user) {
            bot.sendMessage(chatId, `✅ Gender set to: ${GENDER_MAP[genderValue]}`);
            
            // Check if user has both language and gender set
            checkSetupComplete(chatId, user);
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
async function handleSetLanguage(chatId) {
    const message = `🌐 *Select Your Language*\n\nChoose the language you want to use:\n\n*This will be used for translation purposes.*`;
    
    // Common language options with ISO 639-1 codes
    const languageOptions = [
        [{ text: '🇺🇸 English (en)', callback_data: 'lang_en' }],
        [{ text: '🇪🇸 Spanish (es)', callback_data: 'lang_es' }],
        [{ text: '🇫🇷 French (fr)', callback_data: 'lang_fr' }],
        [{ text: '🇩🇪 German (de)', callback_data: 'lang_de' }],
        [{ text: '🇮🇹 Italian (it)', callback_data: 'lang_it' }],
        [{ text: '🇨🇳 Chinese (zh)', callback_data: 'lang_zh' }],
        [{ text: '🇯🇵 Japanese (ja)', callback_data: 'lang_ja' }],
        [{ text: '🇷🇺 Russian (ru)', callback_data: 'lang_ru' }]
    ];
    
    await bot.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: languageOptions
        }
    });

    // Add listener for language selection callback
    bot.on('callback_query', async (callbackQuery) => {
        const data = callbackQuery.data;
        
        if (data.startsWith('lang_')) {
            const langCode = data.split('_')[1];
            await setUserLanguage(callbackQuery.message.chat.id, langCode);
            bot.answerCallbackQuery(callbackQuery.id);
        }
    });
}

// Set user language
async function setUserLanguage(chatId, langCode) {
    try {
        const user = await User.findOneAndUpdate(
            { chatId },
            { language: langCode },
            { new: true }
        );

        if (user) {
            bot.sendMessage(chatId, `✅ Language set to: ${langCode}`);
            
            // Check if user has both language and gender set
            checkSetupComplete(chatId, user);
        }
    } catch (error) {
        console.error('Error setting language:', error);
        bot.sendMessage(chatId, 'An error occurred while setting language');
    }
}

// Improved gender selection with inline buttons
async function handleSetGender(chatId) {
    const keyboard = {
        inline_keyboard: [
            [
                { text: '👨 Male', callback_data: 'gender_male' },
                { text: '👩 Female', callback_data: 'gender_female' },
                { text: '⚪ Other', callback_data: 'gender_other' }
            ]
        ]
    };
    
    await bot.sendMessage(chatId, '👤 Select your gender (for grammatical purposes in translations):', {
        reply_markup: keyboard
    });
}

// Improved add friend with validation
async function handleAddFriend(chatId) {
    await bot.sendMessage(chatId, `➕ *Add a Friend*\n\nEnter your friend's Chat ID to add them to your contact list.\n\nYou can ask your friend to use the /start command to get their Chat ID.`, {
        parse_mode: 'Markdown'
    });
    
    // Set up a one-time listener for the next message
    bot.once('message', async (msg) => {
        if (msg.chat.id !== chatId || !msg.text) return;
        
        // Try to parse the friend's chat ID
        const friendId = parseInt(msg.text.trim());
        
        if (isNaN(friendId)) {
            await bot.sendMessage(chatId, `❌ Invalid Chat ID. Please enter a valid numeric ID.`);
            return;
        }
        
        if (friendId === chatId) {
            await bot.sendMessage(chatId, `❌ You cannot add yourself as a friend.`);
            return;
        }
        
        try {
            // Check if friend exists in the database
            const friendUser = await User.findOne({ chatId: friendId });
            
            if (!friendUser) {
                await bot.sendMessage(chatId, `⚠️ This user hasn't used the bot yet. Ask them to start the bot first.`);
                return;
            }
            
            // Check if already friends
            const currentUser = await User.findOne({ chatId });
            
            if (currentUser.friends.includes(friendId)) {
                await bot.sendMessage(chatId, `ℹ️ ${friendUser.name} is already in your friends list.`);
                return;
            }
            
            // Add friend to user's list
            await User.findOneAndUpdate(
                { chatId },
                { $push: { friends: friendId } }
            );
            
            await bot.sendMessage(chatId, `✅ Added ${friendUser.name} to your friends list!`);
            
            // Optionally notify the friend
            await bot.sendMessage(friendId, `👋 ${currentUser.name} has added you as a friend on TranslationBot.`);
            
        } catch (error) {
            console.error('Error adding friend:', error);
            await bot.sendMessage(chatId, `❌ An error occurred while adding the friend.`);
        }
    });
}

// Improved connect command with friend list
async function handleConnect(chatId) {
    try {
        const user = await User.findOne({ chatId });
        
        if (!user) {
            await bot.sendMessage(chatId, `❌ User profile not found. Please use /start to set up your profile.`);
            return;
        }
        
        if (user.connected) {
            await bot.sendMessage(chatId, `ℹ️ You are already connected with someone. Use /disconnect first.`);
            return;
        }
        
        if (user.friends.length === 0) {
            await bot.sendMessage(chatId, `ℹ️ You don't have any friends yet. Use /addfriend to add friends.`);
            return;
        }
        
        // Build a keyboard with friend options
        const keyboard = {
            inline_keyboard: []
        };
        
        // Get all friends and add them to the keyboard
        for (const friendId of user.friends) {
            const friend = await User.findOne({ chatId: friendId });
            if (friend) {
                keyboard.inline_keyboard.push([
                    { text: `${friend.name} (${friend.language || 'Unknown language'})`, callback_data: `connect_${friendId}` }
                ]);
            }
        }
        
        await bot.sendMessage(chatId, `🔗 *Connect with a Friend*\n\nSelect a friend to start chatting:`, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    } catch (error) {
        console.error('Error in connect handler:', error);
        await bot.sendMessage(chatId, `❌ An error occurred while connecting.`);
    }
}

// Connect to a specific friend
async function handleConnectToFriend(chatId, friendId) {
    try {
        // Verify friend exists
        const friend = await User.findOne({ chatId: friendId });
        if (!friend) {
            await bot.sendMessage(chatId, `❌ Friend not found.`);
            return;
        }
        
        // Check if friend is already connected
        if (friend.connected) {
            await bot.sendMessage(chatId, `⚠️ ${friend.name} is currently connected with someone else. Try again later.`);
            return;
        }
        
        // Update both users' connection status
        await User.findOneAndUpdate(
            { chatId },
            { connected: true, currentConnection: friendId }
        );
        
        await User.findOneAndUpdate(
            { chatId: friendId },
            { connected: true, currentConnection: chatId }
        );
        
        // Notify both users
        await bot.sendMessage(chatId, `🔗 Connected with ${friend.name}! You can now chat with translation.`);
        await bot.sendMessage(friendId, `🔗 ${(await User.findOne({ chatId })).name} has connected with you! You can now chat with translation.`);
    } catch (error) {
        console.error('Error connecting to friend:', error);
        await bot.sendMessage(chatId, `❌ An error occurred while connecting to your friend.`);
    }
}

// Handle disconnect with confirmation
async function handleDisconnect(chatId) {
    try {
        const user = await User.findOne({ chatId });
        
        if (!user || !user.connected || !user.currentConnection) {
            await bot.sendMessage(chatId, `ℹ️ You are not currently connected with anyone.`);
            return;
        }
        
        const friendId = user.currentConnection;
        const friend = await User.findOne({ chatId: friendId });
        
        // Update both users' connection status
        await User.findOneAndUpdate(
            { chatId },
            { connected: false, currentConnection: null }
        );
        
        await User.findOneAndUpdate(
            { chatId: friendId },
            { connected: false, currentConnection: null }
        );
        
        // Notify both users
        await bot.sendMessage(chatId, `🔌 Disconnected from ${friend ? friend.name : 'your friend'}.`);
        
        if (friend) {
            await bot.sendMessage(friendId, `🔌 ${user.name} has disconnected. Conversation ended.`);
        }
        
        // Show reconnect option
        const keyboard = {
            inline_keyboard: [
                [{ text: '🔄 Reconnect', callback_data: `connect_${friendId}` }],
                [{ text: '🔗 Connect with someone else', callback_data: 'connect' }]
            ]
        };
        
        await bot.sendMessage(chatId, `What would you like to do next?`, {
            reply_markup: keyboard
        });
    } catch (error) {
        console.error('Error disconnecting:', error);
        await bot.sendMessage(chatId, `❌ An error occurred while disconnecting.`);
    }
}

// Improved status command with more details
async function handleStatus(chatId) {
    try {
        const user = await User.findOne({ chatId });
        
        if (!user) {
            await bot.sendMessage(chatId, `❌ User profile not found. Please use /start to set up your profile.`);
            return;
        }
        
        let statusMessage = `📊 *Your Status*\n\n`;
        
        // Profile section
        statusMessage += `*Profile:*\n`;
        statusMessage += `- Name: ${user.name}\n`;
        statusMessage += `- Language: ${user.language || 'Not set'}\n`;
        statusMessage += `- Gender: ${user.gender !== null ? GENDER_MAP[user.gender] : 'Not set'}\n\n`;
        
        // Connection status
        statusMessage += `*Connection:*\n`;
        
        if (user.connected && user.currentConnection) {
            const friend = await User.findOne({ chatId: user.currentConnection });
            statusMessage += `- Status: Connected\n`;
            statusMessage += `- Connected with: ${friend ? friend.name : 'Unknown'}\n`;
            statusMessage += `- Their language: ${friend ? (friend.language || 'Unknown') : 'Unknown'}\n`;
        } else {
            statusMessage += `- Status: Not connected\n`;
        }
        
        // Friends list
        statusMessage += `\n*Friends (${user.friends.length}):*\n`;
        
        if (user.friends.length === 0) {
            statusMessage += `- No friends added yet. Use /addfriend to add friends.`;
        } else {
            for (const friendId of user.friends) {
                const friend = await User.findOne({ chatId: friendId });
                if (friend) {
                    const isOnline = !friend.connected || friend.currentConnection === chatId;
                    statusMessage += `- ${friend.name} (${friend.language || 'Unknown'}) ${isOnline ? '🟢' : '🔴'}\n`;
                }
            }
        }
        
        // Action buttons
        const keyboard = {
            inline_keyboard: [
                [{ text: '🌐 Change Language', callback_data: 'set_language' }],
                [{ text: '👤 Change Gender', callback_data: 'set_gender' }],
                [{ text: '➕ Add Friend', callback_data: 'add_friend' }],
                [{ text: '🔗 Connect', callback_data: 'connect' }]
            ]
        };
        
        // Add disconnect button if connected
        if (user.connected) {
            keyboard.inline_keyboard.push([{ text: '🔌 Disconnect', callback_data: 'disconnect' }]);
        }
        
        await bot.sendMessage(chatId, statusMessage, {
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    } catch (error) {
        console.error('Error getting status:', error);
        await bot.sendMessage(chatId, `❌ An error occurred while getting your status.`);
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
        const user = await User.findOne({ chatId });
        
        if (!user || !user.connected || !user.currentConnection) {
            // User is not connected, no translation needed
            return;
        }
        
        const friendId = user.currentConnection;
        const friend = await User.findOne({ chatId: friendId });
        
        if (!friend) {
            await bot.sendMessage(chatId, `❌ Your connection is no longer valid. The friend has been removed.`);
            await User.findOneAndUpdate(
                { chatId },
                { connected: false, currentConnection: null }
            );
            return;
        }
        
        // We need both user's language settings for translation
        if (!user.language || !friend.language) {
            await bot.sendMessage(chatId, `⚠️ Both you and your friend need to set your languages for translation to work.`);
            return;
        }
        
        // Get the original message
        const originalText = msg.text || '';
        
        // Don't try to translate empty messages
        if (!originalText.trim()) {
            await bot.sendMessage(friendId, originalText);
            return;
        }
        
        // Show typing indicator to the receiver
        await bot.sendChatAction(friendId, 'typing');
        
        // Get gender context for better translation
        const genderContext = user.gender !== null ? GENDER_MAP[user.gender] : 'unknown';
        
        try {
            // Call the translate function from llm.js
            const translatedText = await translate(originalText, user.language, friend.language, genderContext);
            
            // Send both original and translated text to receiver
            const message = `${user.name}:\n\n${translatedText}\n\n🔤 *Original (${user.language}):*\n${originalText}`;
            
            await bot.sendMessage(friendId, message, {
                parse_mode: 'Markdown'
            });
            
        } catch (translationError) {
            console.error('Translation error:', translationError);
            
            // If translation fails, send original message
            await bot.sendMessage(friendId, `${user.name} (translation failed):\n\n${originalText}`);
            
            // Notify the sender about translation failure
            await bot.sendMessage(chatId, `⚠️ Your message was sent, but translation failed.`);
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