#!/usr/bin/env node

import { TelegramBot } from "./server/utils/telegram-bot.js"
import chalk from "chalk"
import fs from "fs"
import path from "path"

// Load environment variables from .env file if it exists
function loadEnvFile() {
  try {
    const envPath = path.join(process.cwd(), ".env")
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, "utf8")
      const lines = envContent.split("\n")

      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed && !trimmed.startsWith("#")) {
          const [key, ...valueParts] = trimmed.split("=")
          if (key && valueParts.length > 0) {
            const value = valueParts.join("=").replace(/^["']|["']$/g, "") // Remove quotes
            process.env[key.trim()] = value.trim()
          }
        }
      }
      console.log(chalk.green("✓ Loaded environment variables from .env file"))
    } else {
      console.log(chalk.yellow("⚠ No .env file found. Please create one with your Telegram credentials."))
      console.log(chalk.cyan("Copy .env.example to .env and update with your actual values."))
      process.exit(1)
    }
  } catch (error) {
    console.log(chalk.red("✗ Could not load .env file:", error.message))
    process.exit(1)
  }
}

async function testTelegramBot() {
  console.log(chalk.blue.bold("🚀 TrapDaemon Telegram Bot Test\n"))

  // Load environment variables
  loadEnvFile()

  // Get Telegram credentials from environment
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  if (!botToken || !chatId) {
    console.log(chalk.red("✗ Missing Telegram credentials in .env file"))
    console.log(chalk.yellow("Please set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in your .env file"))
    process.exit(1)
  }

  // Initialize Telegram bot
  console.log(chalk.cyan("🔧 Initializing Telegram bot..."))
  const telegramBot = new TelegramBot(botToken, chatId)

  // Wait a moment for connection test
  await new Promise(resolve => setTimeout(resolve, 2000))

  // Check bot status
  const status = telegramBot.getStatus()
  console.log(`\n📊 Bot Status:`)
  console.log(`   Enabled: ${status.enabled ? chalk.green('✓') : chalk.red('✗')}`)
  console.log(`   Has Token: ${status.hasToken ? chalk.green('✓') : chalk.red('✗')}`)
  console.log(`   Has Chat ID: ${status.hasChatId ? chalk.green('✓') : chalk.red('✗')}`)

  if (!status.enabled) {
    console.log(chalk.red("\n✗ Telegram bot is not enabled. Check your credentials and connection."))
    process.exit(1)
  }

  // Send test attack alert
  console.log(chalk.cyan("\n📨 Sending test attack alert..."))
  
  const testAttack = {
    type: "SSH Brute Force",
    severity: "high",
    source: "192.168.1.100",
    target: "SSH:2222",
    description: "This is a test alert from TrapDaemon setup",
    timestamp: new Date().toISOString(),
    payload: "admin:testpassword"
  }

  try {
    const success = await telegramBot.sendAttackAlert(testAttack)
    
    if (success) {
      console.log(chalk.green("\n✅ Test alert sent successfully!"))
      console.log(chalk.cyan("Check your Telegram chat to see the message."))
    } else {
      console.log(chalk.red("\n❌ Failed to send test alert"))
      console.log(chalk.yellow("Please check your bot token and chat ID"))
    }
  } catch (error) {
    console.log(chalk.red("\n❌ Error sending test alert:"), error.message)
  }

  // Send simple test message
  console.log(chalk.cyan("\n📨 Sending simple test message..."))
  
  try {
    const success = await telegramBot.sendMessage("🧪 TrapDaemon test message - setup completed successfully!")
    
    if (success) {
      console.log(chalk.green("✅ Simple test message sent successfully!"))
    } else {
      console.log(chalk.red("❌ Failed to send simple test message"))
    }
  } catch (error) {
    console.log(chalk.red("❌ Error sending simple test message:"), error.message)
  }

  console.log(chalk.blue.bold("\n🎉 Telegram bot test completed!"))
}

// Run the test
testTelegramBot().catch(error => {
  console.error(chalk.red("\n💥 Test failed:"), error.message)
  process.exit(1)
})