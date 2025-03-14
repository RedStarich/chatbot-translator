# 🌐 Chatbot Translator

A real-time language translation Telegram bot built during a hackathon. This bot leverages the Gemini API to break down language barriers through the Telegram platform.

## ✨ Features

* **Multi-language Support**: Translate messages across numerous languages including English, Spanish, French, German, Chinese, Japanese, and more
* **Real-time Translation**: Receive instant translations during conversations
* **User-friendly Interface**: Simple commands through Telegram's familiar interface

## 🛠️ Technologies Used

* **Node.js**: Powers the backend
* **Telegram Bot API**: Handles user interactions
* **Gemini API**: Provides advanced translation capabilities

## 📚 Libraries

* `node-telegram-bot-api`: Telegram integration
* `axios`: HTTP request handling
* `dotenv`: Environment variable management
* `fs`: File system operations
* `body-parser`: Request body parsing

## 👥 Team Members

| Name | Role | Contact |
|------|------|---------|
| Nisa Shahid | UI/UX Designer | https://www.linkedin.com/in/nisa-shahid-563362275/ |
| Hasibur Rashid | Backend Developer | https://www.linkedin.com/in/hasibur-rashid-7b55a0346/ |
| Altair Zhambyl | DevOps Engineer | https://linkedin.com/in/azhambyl |
| Rajiv Rago |AI Prompt Engineer | https://www.linkedin.com/in/rajiv-rago/ |
| Joshua Ajieh| Product Manager | https://www.linkedin.com/in/j-ajieh/ |

## 🚀 Getting Started

### Prerequisites

* Node.js
* npm (Node Package Manager)

### Installation

1. Clone this repository:

   ```bash
   git clone https://github.com/your-repo/chatbot-translator
   ```

2. Navigate to the project directory:

   ```bash
   cd chatbot-translator
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Configure environment variables:
   * Create a `.env` file in the project root
   * Add your API credentials:

     ``` .env
     TELEGRAM_TOKEN=your_telegram_bot_token
     GEMINI_API_KEY=your_gemini_api_key
     ```

### Usage

1. Start the bot:

   ```bash
   node index.js
   ```

2. Open Telegram and search for your bot's username
3. Start a conversation with `/start` command

## 💡 Example Commands

* `/start` - Initializes user to the system
* `/language` - Changes the incoming language
* `/addfriend` - Adds another user to talk to
* `/help` - Displays all commands

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues or pull requests to improve the bot's functionality or usability.

## 📄 License

This project is currently unlicensed. All rights reserved by the project team.

## 🙏 Acknowledgements

* Thanks to the Telegram and Gemini API teams for their excellent documentation
* Special thanks to all hackathon participants who provided feedback
