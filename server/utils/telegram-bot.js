import { Logger } from "./logger.js"

export class TelegramBot {
  constructor(token, chatId) {
    this.token = token
    this.chatId = chatId
    this.logger = new Logger()
    this.apiUrl = `https://api.telegram.org/bot${this.token}/sendMessage`
    this.isEnabled = false

    // Debug logging
    this.logger.log(`Telegram Bot Token: ${this.token ? this.token.substring(0, 10) + "..." : "NOT SET"}`, "debug")
    this.logger.log(`Telegram Chat ID: ${this.chatId || "NOT SET"}`, "debug")

    // Validate credentials
    if (!this.token || !this.chatId || this.token === "YOUR_BOT_TOKEN" || this.chatId === "YOUR_CHAT_ID") {
      this.logger.log(
        "Telegram bot credentials not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID environment variables.",
        "warn",
      )
      this.isEnabled = false
    } else {
      this.isEnabled = true
      this.logger.log("Telegram bot initialized successfully", "success")
      // Test the connection
      this.testConnection()
    }
  }

  async testConnection() {
    try {
      const url = `https://api.telegram.org/bot${this.token}/getMe`
      this.logger.log(`Testing connection to: ${url}`, "debug")
      const response = await fetch(url)
      const data = await response.json()
      this.logger.log(`Telegram API Response: ${JSON.stringify(data)}`, "debug")

      if (data.ok) {
        this.logger.log(`Telegram bot connected: @${data.result.username}`, "success")
      } else {
        this.logger.log(`Telegram bot connection failed: ${data.description}`, "error")
        this.isEnabled = false
      }
    } catch (error) {
      this.logger.log(`Telegram bot test failed: ${error.message}`, "error")
      this.isEnabled = false
    }
  }

  async sendMessage(message) {
    if (!this.isEnabled) {
      this.logger.log("Telegram bot is disabled - message not sent", "debug")
      return false
    }

    try {
      // Clean the message and format it
      const cleanMessage = this.cleanMessage(message)

      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: this.chatId,
          text: cleanMessage,
          parse_mode: "HTML",
        }),
      })

      const responseData = await response.json()
      if (response.ok && responseData.ok) {
        this.logger.log("Telegram alert sent successfully", "success")
        return true
      } else {
        this.logger.log(
          `Telegram API error: ${response.status} - ${responseData.description || "Unknown error"}`,
          "error",
        )
        // Try sending as plain text if HTML parsing fails
        if (responseData.description && responseData.description.includes("parse")) {
          this.logger.log("Retrying without HTML formatting...", "warn")
          return await this.sendPlainMessage(message)
        }
        return false
      }
    } catch (error) {
      this.logger.logError(error, "Sending Telegram message")
      return false
    }
  }

  async sendPlainMessage(message) {
    try {
      const cleanMessage = this.cleanMessage(message)

      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: this.chatId,
          text: cleanMessage,
        }),
      })

      const responseData = await response.json()
      if (response.ok && responseData.ok) {
        this.logger.log("Telegram alert sent as plain text", "success")
        return true
      } else {
        this.logger.log(`Telegram plain text failed: ${responseData.description}`, "error")
        return false
      }
    } catch (error) {
      this.logger.logError(error, "Sending plain Telegram message")
      return false
    }
  }

  cleanMessage(message) {
    // Remove or replace problematic characters
    // Clean and format message for Telegram
    return message
      .replace(/[<>]/g, "") // Remove HTML-like brackets
      .replace(/[_*[\]()~`>#+=|{}.!-]/g, "") // Remove markdown special chars
      .replace(/\n\n+/g, "\n") // Replace multiple newlines with single
      .trim()
      .substring(0, 4000) // Telegram message limit
  }

  formatAttackAlert(attack) {
    const timestamp = new Date(attack.timestamp).toLocaleString()
    const severity = attack.severity.toUpperCase()

    return `TRAPDAEMON ALERT

Attack Type: ${attack.type}
Severity: ${severity}
Source IP: ${attack.source}
Target: ${attack.target}
Description: ${attack.description}
Time: ${timestamp}
${attack.payload ? `Payload: ${attack.payload.substring(0, 200)}${attack.payload.length > 200 ? "..." : ""}` : ""}

#TrapDaemon #SecurityAlert #${severity}`
  }

  async sendAttackAlert(attack) {
    if (!this.isEnabled) {
      return false
    }

    const alertMessage = this.formatAttackAlert(attack)
    return await this.sendMessage(alertMessage)
  }

  // Method to enable/disable bot
  setEnabled(enabled) {
    this.isEnabled = enabled
    this.logger.log(`Telegram bot ${enabled ? "enabled" : "disabled"}`, "info")
  }

  // Get bot status
  getStatus() {
    return {
      enabled: this.isEnabled,
      hasToken: !!this.token && this.token !== "YOUR_BOT_TOKEN",
      hasChatId: !!this.chatId && this.chatId !== "YOUR_CHAT_ID",
    }
  }
}
