#!/usr/bin/env node

import chalk from "chalk"
import { execSync } from "child_process"
import fs from "fs"
import path from "path"
import os from "os"
import readline from "readline" // Import readline for user input

class HoneypotSetup {
  constructor() {
    this.platform = os.platform()
    this.isRoot = process.getuid && process.getuid() === 0
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })
  }

  async run() {
    console.clear()
    this.showBanner()

    console.log(chalk.cyan("Advanced Honeypot Setup\n"))

    // Check system requirements
    await this.checkRequirements()

    // Install Node.js dependencies
    await this.installNodeDependencies()

    // Check system tools
    await this.checkSystemTools()

    // Create necessary directories
    await this.createDirectories()

    // Setup permissions
    await this.setupPermissions()

    // Configure Telegram notifications
    await this.configureTelegram()

    // Show completion message
    this.showCompletion()

    this.rl.close()
  }

  showBanner() {
    const banner = `
 _____                 _                 _
|_   _| __ __ __ _ _ __  | |    ___   __ _ | |_  ___  _ __ ___
  | || '__/ _\` | '_ \\ | |   / _ \\ / _\` || __ | / _ \\| '__/
  | || | | (_| | |_) || |__| (_) | (_| || |_|  __/| |  \\
  |_| \\__,_| .__/ |_____\___/ \__,_| \\__|\\___||_|  |___/
           |_|
    `

    console.log(chalk.cyan(banner))
  }

  async checkRequirements() {
    console.log(chalk.yellow("Checking system requirements...\n"))

    // Check Node.js version
    try {
      const nodeVersion = process.version
      const majorVersion = Number.parseInt(nodeVersion.substring(1))

      if (majorVersion >= 18) {
        console.log(chalk.green("Node.js " + nodeVersion + " (compatible)"))
      } else {
        console.log(chalk.red("Node.js " + nodeVersion + " (requires >= 18.0.0)"))
        process.exit(1)
      }
    } catch (error) {
      console.log(chalk.red("Node.js not found"))
      process.exit(1)
    }

    // Check platform
    console.log(chalk.green("Platform: " + this.platform))

    // Check permissions
    if (this.isRoot) {
      console.log(chalk.green("Running with root privileges (all features available)"))
    } else {
      console.log(chalk.yellow("Not running as root (some features will be limited)"))
      console.log(chalk.cyan("   Run with sudo for full WiFi honeypot capabilities"))
    }

    // Check available memory
    const totalMem = Math.round(os.totalmem() / 1024 / 1024)
    const freeMem = Math.round(os.freemem() / 1024 / 1024)

    console.log(chalk.green("Memory: " + freeMem + "MB free / " + totalMem + "MB total"))

    if (freeMem < 512) {
      console.log(chalk.yellow("Low memory available, monitor system performance"))
    }

    console.log()
  }

  async installNodeDependencies() {
    console.log(chalk.yellow("Installing Node.js dependencies...\n"))

    try {
      // Check if package.json exists
      if (!fs.existsSync("package.json")) {
        console.log(chalk.red("package.json not found"))
        process.exit(1)
      }

      console.log(chalk.cyan("Installing dependencies with npm..."))
      execSync("npm install", { stdio: "inherit" })
      console.log(chalk.green("Node.js dependencies installed\n"))
    } catch (error) {
      console.log(chalk.red("Failed to install Node.js dependencies"))
      console.log(chalk.red("Please run: npm install"))
      process.exit(1)
    }
  }

  async checkSystemTools() {
    console.log(chalk.yellow("Checking system tools...\n"))

    const tools = {
      essential: [
        { name: "ss", description: "Socket statistics" },
        { name: "ps", description: "Process status" },
        { name: "grep", description: "Text search" },
        { name: "awk", description: "Text processing" },
      ],
      wifi: [
        { name: "hostapd", description: "WiFi access point daemon" },
        { name: "dnsmasq", description: "DNS/DHCP server" },
        { name: "tcpdump", description: "Packet capture" },
        { name: "iptables", description: "Firewall configuration" },
      ],
      optional: [
        { name: "nmap", description: "Network mapping" },
        { name: "nc", description: "Network connections" },
        { name: "curl", description: "HTTP client" },
      ],
    }

    // Check essential tools
    console.log(chalk.cyan("Essential tools:"))
    for (const tool of tools.essential) {
      if (await this.checkTool(tool.name)) {
        console.log(chalk.green(tool.name + " - " + tool.description))
      } else {
        console.log(chalk.red(tool.name + " - " + tool.description + " (missing)"))
      }
    }

    // Check WiFi tools (only if running as root)
    if (this.isRoot) {
      console.log(chalk.cyan("\nWiFi honeypot tools:"))
      for (const tool of tools.wifi) {
        if (await this.checkTool(tool.name)) {
          console.log(chalk.green(tool.name + " - " + tool.description))
        } else {
          console.log(chalk.yellow(tool.name + " - " + tool.description + " (missing)"))
          this.suggestInstallation(tool.name)
        }
      }
    } else {
      console.log(chalk.yellow("\nWiFi honeypot tools: (requires root privileges)"))
      console.log(chalk.cyan("Run with sudo to check WiFi capabilities"))
    }

    // Check optional tools
    console.log(chalk.cyan("\nOptional tools:"))
    for (const tool of tools.optional) {
      if (await this.checkTool(tool.name)) {
        console.log(chalk.green(tool.name + " - " + tool.description))
      } else {
        console.log(chalk.gray(tool.name + " - " + tool.description + " (optional)"))
      }
    }

    console.log()
  }

  async checkTool(toolName) {
    try {
      execSync(`which ${toolName}`, { stdio: "ignore" })
      return true
    } catch (error) {
      return false
    }
  }

  suggestInstallation(toolName) {
    const suggestions = {
      hostapd: {
        linux: "sudo apt-get install hostapd",
        darwin: "brew install hostapd",
      },
      dnsmasq: {
        linux: "sudo apt-get install dnsmasq",
        darwin: "brew install dnsmasq",
      },
      tcpdump: {
        linux: "sudo apt-get install tcpdump",
        darwin: "brew install tcpdump",
      },
      iptables: {
        linux: "sudo apt-get install iptables",
        darwin: "Not available on macOS",
      },
      nmap: {
        linux: "sudo apt-get install nmap",
        darwin: "brew install nmap",
      },
    }

    const suggestion = suggestions[toolName]
    if (suggestion) {
      const command = suggestion[this.platform] || suggestion["linux"]
      console.log(chalk.cyan(`    Install with: ${command}`))
    }
  }

  async createDirectories() {
    console.log(chalk.yellow("Creating necessary directories...\n"))

    const directories = [
      "logs",
      "harvested-data",
      "config",
      "exports",
      "server",
      "server/core",
      "server/detection",
      "server/network",
      "server/utils",
    ]

    for (const dir of directories) {
      try {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true })
          console.log(chalk.green("Created directory: " + dir))
        } else {
          console.log(chalk.blue("Directory exists: " + dir))
        }
      } catch (error) {
        console.log(chalk.red("Failed to create directory: " + dir))
      }
    }

    console.log()
  }

  async setupPermissions() {
    console.log(chalk.yellow("Setting up permissions...\n"))

    try {
      // Make main script executable
      if (fs.existsSync("server/honeypot.js")) {
        execSync("chmod +x server/honeypot.js")
        console.log(chalk.green("Made server/honeypot.js executable"))
      }

      // Set directory permissions
      const directories = ["logs", "harvested-data", "exports", "server"]

      for (const dir of directories) {
        if (fs.existsSync(dir)) {
          execSync(`chmod 755 ${dir}`)
          console.log(chalk.green("Set permissions for " + dir))
        }
      }

      console.log()
    } catch (error) {
      console.log(chalk.yellow("Could not set all permissions (this is usually okay)"))
      console.log()
    }
  }

  async askQuestion(query) {
    return new Promise((resolve) => this.rl.question(query, resolve))
  }

  async configureTelegram() {
    console.log(chalk.yellow("Configuring Telegram Notifications...\n"))
    const answer = await this.askQuestion(chalk.cyan("Do you want to configure Telegram notifications? (y/n): "))

    if (answer.toLowerCase() === "y") {
      const botToken = await this.askQuestion(chalk.cyan("Enter your Telegram Bot Token: "))
      const chatId = await this.askQuestion(chalk.cyan("Enter your Telegram Chat ID: "))
      await this.updateHoneypotJsWithTelegramSettings(botToken.trim(), chatId.trim())
    } else {
      console.log(chalk.yellow("Telegram notifications skipped."))
    }
    console.log()
  }

  async updateHoneypotJsWithTelegramSettings(token, chatId) {
    const honeypotJsPath = path.join(process.cwd(), "server", "honeypot.js") // Updated path
    try {
      let content = fs.readFileSync(honeypotJsPath, "utf8")
      const oldLine =
        "this.telegramBot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, process.env.TELEGRAM_CHAT_ID);"
      const newLine = `this.telegramBot = new TelegramBot("${token}", "${chatId}");`

      if (content.includes(oldLine)) {
        content = content.replace(oldLine, newLine)
        fs.writeFileSync(honeypotJsPath, content)
        console.log(chalk.green("server/honeypot.js updated with Telegram settings."))
        console.log(
          chalk.red.bold(
            "WARNING: Telegram credentials are now hardcoded in server/honeypot.js. Consider using environment variables for production!",
          ),
        )
      } else {
        console.log(
          chalk.yellow(
            "Could not find the TelegramBot initialization line in server/honeypot.js. Please update it manually.",
          ),
        )
      }
    } catch (error) {
      console.log(chalk.red(`Error updating server/honeypot.js: ${error.message}`))
    }
  }

  showCompletion() {
    console.log(chalk.green.bold("Setup completed successfully!\n"))

    console.log(chalk.cyan("Quick Start:"))
    console.log(chalk.white("1. Start the honeypot:"))
    console.log(chalk.gray("   npm run honeypot"))
    console.log(chalk.white("   or"))
    console.log(chalk.gray("   node server/honeypot.js"))
    console.log()

    console.log(chalk.white("2. For WiFi honeypot features (requires root):"))
    console.log(chalk.gray("   sudo npm run honeypot"))
    console.log(chalk.gray("   or"))
    console.log(chalk.gray("   sudo node server/honeypot.js"))
    console.log()

    console.log(chalk.cyan("Available Commands:"))
    console.log(chalk.gray("   npm run setup        - Run this setup again"))
    console.log(chalk.gray("   npm run check-system - Check system capabilities"))
    console.log(chalk.gray("   npm run honeypot     - Start honeypot"))
    console.log(chalk.gray("   npm run dev          - Start Next.js dashboard in dev mode"))
    console.log(chalk.gray("   npm start            - Start Next.js dashboard in production mode"))
    console.log()

    console.log(chalk.cyan("Dashboard Controls:"))
    console.log(chalk.gray("   Access via browser: http://localhost:3001"))
    console.log(chalk.gray("   (The dashboard itself has buttons for Start/Stop, Clear Logs, Export Data, Sys Info)"))
    console.log()

    if (!this.isRoot) {
      console.log(chalk.yellow.bold("Important Notes:"))
      console.log(chalk.yellow("• For WiFi honeypot features, run with sudo"))
      console.log(chalk.yellow("• Core honeypot services work without root"))
      console.log(chalk.yellow("• Check logs/ directory for detailed output"))
      console.log()
    }

    console.log(chalk.red.bold("Legal Reminder:"))
    console.log(chalk.red("Only use this tool on networks you own or have"))
    console.log(chalk.red("explicit permission to monitor. Unauthorized network"))
    console.log(chalk.red("monitoring is illegal in many jurisdictions."))
    console.log()

    console.log(chalk.green("Setup complete! You can now start the honeypot."))
  }
}

// Run setup if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const setup = new HoneypotSetup()
  setup.run().catch((error) => {
    console.error(chalk.red(`Setup failed: ${error.message}`))
    process.exit(1)
  })
}
