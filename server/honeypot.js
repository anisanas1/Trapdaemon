#!/usr/bin/env node

import { createServer } from "http"
import { Server } from "socket.io"
import { EventEmitter } from "events"
import fs from "fs"
import path from "path"
import os from "os"
import { exec } from "child_process"
import chalk from "chalk"
import figlet from "figlet"
import gradient from "gradient-string"
import { HoneypotCore } from "./core/honeypot-core.js"
import { AttackDetector } from "./detection/attack-detector.js"
import { NetworkManager } from "./network/network-manager.js"
import { Logger } from "./utils/logger.js"
import { TelegramBot } from "./utils/telegram-bot.js"

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
    }
  } catch (error) {
    console.log(chalk.yellow("⚠ Could not load .env file:", error.message))
  }
}

class TrapDaemon extends EventEmitter {
  constructor() {
    super()
    this.core = new HoneypotCore()
    this.attackDetector = new AttackDetector()
    this.networkManager = new NetworkManager()
    this.logger = new Logger()
    this.httpServer = null
    this.io = null
    this.stats = {
      totalConnections: 0,
      activeTargets: 0,
      attacksDetected: 0,
      dataHarvested: 0,
    }
    this.targets = new Map()
    this.logs = []
    this.attacks = []
    this.isRunning = false
    this.startTime = null
    this.updateInterval = null
    this.clients = new Set()

    // Initialize Telegram Bot with environment variables
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    const chatId = process.env.TELEGRAM_CHAT_ID
    this.telegramBot = new TelegramBot(botToken, chatId)
  }

  async initialize() {
    // Show startup banner
    this.showStartupBanner()

    // Check system requirements
    await this.checkSystemRequirements()

    // Initialize components
    await this.core.initialize()
    await this.attackDetector.initialize()
    await this.networkManager.initialize()

    // Setup event handlers
    this.setupEventHandlers()

    // Start HTTP server and Socket.IO
    this.startWebServer()
    this.setupSocketIO()

    // Start network monitoring
    try {
      await this.networkManager.startNetworkMonitoring()
      await this.networkManager.startPacketCapture()
    } catch (error) {
      this.logger.log("Network monitoring failed - continuing without it", "warn")
    }

    // Start honeypot core
    await this.core.start()
    await this.attackDetector.start()

    // Start periodic updates
    this.startPeriodicUpdates()

    this.logger.log("TrapDaemon fully initialized and running", "success")
  }

  showStartupBanner() {
    try {
      const ascii = figlet.textSync("TrapDaemon", {
        font: "Standard",
        horizontalLayout: "default",
        verticalLayout: "default",
      })

      console.log(gradient.pastel.multiline(ascii))
      console.log(gradient.pastel(" TrapDaemon v1.0 - Advanced Honeypot System\n"))
    } catch (error) {
      console.log(chalk.green("TrapDaemon v1.0 - Advanced Honeypot System\n"))
    }

    console.log(chalk.green(" Educational use"))
    console.log(chalk.green(" Security research"))
    console.log(chalk.green(" Authorized penetration testing\n"))
    console.log(chalk.red(" This tool is for authorized use only!\n"))

    // Show Telegram bot status
    const telegramStatus = this.telegramBot.getStatus()
    if (telegramStatus.enabled) {
      console.log(chalk.green(" Telegram alerts: ENABLED"))
    } else {
      console.log(chalk.yellow(" Telegram alerts: DISABLED"))
      if (!telegramStatus.hasToken || !telegramStatus.hasChatId) {
        console.log(chalk.yellow(" Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID to enable alerts"))
      }
    }
    console.log()
  }

  async checkSystemRequirements() {
    console.log(chalk.cyan("  Checking system requirements..."))

    // Check Node.js version
    const nodeVersion = process.version
    console.log(chalk.green(` Node.js version: ${nodeVersion}`))

    // Check platform
    const platform = os.platform()
    console.log(chalk.green(` Running on: ${platform}`))

    // Check root
    if (process.getuid && process.getuid() !== 0) {
      console.log(chalk.yellow(" Not running as root - some features may be limited"))
    } else {
      console.log(chalk.green(" Running as root"))
    }

    // Check dependencies
    const dependencies = ["tcpdump", "iptables"]
    for (const dep of dependencies) {
      try {
        await this.executeCommand(`which ${dep}`)
        console.log(chalk.green(` Dependency: ${dep}`))
      } catch (error) {
        console.log(chalk.yellow(` Missing: ${dep}`))
      }
    }

    console.log(chalk.green("  System requirements check complete\n"))
  }

  setupEventHandlers() {
    // Handle new connections
    this.core.on("newConnection", (target) => {
      this.handleNewTarget(target)
    })

    // Handle harvested data
    this.core.on("dataHarvested", (data) => {
      this.handleDataHarvest(data)
    })

    // Handle attacks with detailed logging
    this.attackDetector.on("attackDetected", (attack) => {
      this.logger.log(`RECEIVED ATTACK EVENT: ${attack.type} from ${attack.source}`, "warn")
      this.handleAttackDetection(attack)
    })

    // Handle network events
    this.networkManager.on("newConnection", (connectionInfo) => {
      this.logger.log(`Network connection detected: ${connectionInfo.ip}`, "info")
    })
  }

  handleNewTarget(target) {
    const now = new Date()
    const targetId = target.id || this.generateTargetId(target.ip)

    this.stats.totalConnections++

    if (!this.targets.has(targetId)) {
      this.targets.set(targetId, {
        ...target,
        id: targetId,
        firstSeen: now,
        lastSeen: now,
        connections: 1,
        attacks: 0,
      })
      this.logger.log(`New target connected: ${target.ip} (${target.service})`, "info")
    } else {
      const existing = this.targets.get(targetId)
      this.targets.set(targetId, {
        ...existing,
        connections: existing.connections + 1,
        lastSeen: now,
      })
    }

    this.addLog(`New connection: ${target.ip} via ${target.service}`, "connection")
    this.broadcastUpdate()
  }

  handleDataHarvest(data) {
    this.stats.dataHarvested += data.size || 0
    this.logger.log(`Data harvested: ${data.type} (${data.size} bytes)`, "info")
    this.addLog(`Data harvested: ${data.type} (${data.size} bytes)`, "data")

    // Normalize payload
    const payload = this.safeString(data.data || data.payload || "")

    // Pass data to attack detector
    this.attackDetector.processTrafficData({
      src_ip: data.source || data.ip || "unknown",
      dst_ip: "honeypot",
      payload: payload,
      timestamp: Date.now(),
      size: payload.length,
    })

    this.broadcastUpdate()
  }

  handleAttackDetection(attack) {
    this.logger.log(`PROCESSING ATTACK: ${attack.type} from ${attack.source}`, "warn")

    // Add to attacks list
    this.attacks.push(attack)
    this.stats.attacksDetected++

    // Update target information
    const targetId = this.generateTargetId(attack.source)
    if (this.targets.has(targetId)) {
      const target = this.targets.get(targetId)
      this.targets.set(targetId, {
        ...target,
        attacks: target.attacks + 1,
        lastSeen: new Date(),
      })
    }

    // Log the attack
    this.logger.log(`Attack detected: ${attack.type} from ${attack.source}`, "warn")
    this.addLog(`Attack detected: ${attack.type} from ${attack.source}`, "attack")

    // Send Telegram alert for ALL external attacks
    this.sendTelegramAlert(attack)

    this.broadcastUpdate()
  }

  async sendTelegramAlert(attack) {
    try {
      this.logger.log(`SENDING TELEGRAM ALERT for ${attack.type} from ${attack.source}`, "info")
      const success = await this.telegramBot.sendAttackAlert(attack)
      if (success) {
        this.logger.log(`✅ Telegram alert sent for attack: ${attack.type} from ${attack.source}`, "success")
      } else {
        this.logger.log(`❌ Failed to send Telegram alert for attack: ${attack.type}`, "error")
      }
    } catch (error) {
      this.logger.logError(error, "Sending Telegram alert")
    }
  }

  startWebServer() {
    try {
      this.httpServer = createServer((req, res) => {
        res.writeHead(200, {
          "Content-Type": "text/html",
          "Access-Control-Allow-Origin": "*",
        })

        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <title>TrapDaemon Dashboard</title>
  <style>
      body {
          font-family: 'Courier New', monospace;
          background: #000;
          color: #00ff00;
          margin: 0;
          padding: 20px;
      }
      .container { max-width: 1200px; margin: 0 auto; }
      .header { text-align: center; margin-bottom: 30px; }
      .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
      .stat-box {
          border: 1px solid #ff0000;
          padding: 15px;
          background: #111;
      }
      .stat-title { color: #ff0000; font-weight: bold; margin-bottom: 10px; }
  </style>
</head>
<body>
  <div class="container">
      <div class="header">
          <h1>TrapDaemon Dashboard</h1>
          <p>Advanced Honeypot System - Running</p>
      </div>
      <div class="stats">
          <div class="stat-box">
              <div class="stat-title">Status</div>
              <div>System Online</div>
          </div>
          <div class="stat-box">
              <div class="stat-title">Services</div>
              <div>SSH, HTTP, FTP, Telnet</div>
          </div>
          <div class="stat-box">
              <div class="stat-title">Monitoring</div>
              <div>Active</div>
          </div>
      </div>
      <div style="margin-top: 30px; text-align: center;">
          <p>Connect to Socket.IO on port 3001 for real-time data</p>
      </div>
  </div>
</body>
</html>`

        res.end(htmlContent)
      })

      this.httpServer.listen(3001, "0.0.0.0", () => {
        this.logger.log("Dashboard running on http://localhost:3001", "success")
      })
    } catch (error) {
      this.logger.logError(error, "Starting dashboard")
    }
  }

  setupSocketIO() {
    if (!this.httpServer) return

    this.io = new Server(this.httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    })

    this.io.on("connection", (socket) => {
      this.clients.add(socket)
      this.logger.log(`Web client connected: ${socket.id}`, "info")

      // Send initial data
      socket.emit("initialData", {
        stats: this.getSystemStats(),
        targets: Array.from(this.targets.values()),
        attacks: this.attacks.slice(-50),
        logs: this.logs.slice(-100),
      })

      // Handle commands
      socket.on("startHoneypot", () => {
        this.startHoneypot()
      })

      socket.on("stopHoneypot", () => {
        this.stopHoneypot()
      })

      socket.on("clearLogs", () => {
        this.logs = []
        this.broadcastUpdate()
        this.logger.log("Logs cleared", "info")
      })

      socket.on("exportData", () => {
        this.exportData()
      })

      socket.on("getSystemInfo", () => {
        this.sendSystemInfo(socket)
      })

      socket.on("testTelegram", () => {
        this.testTelegramBot(socket)
      })

      socket.on("disconnect", () => {
        this.clients.delete(socket)
        this.logger.log(`Web client disconnected: ${socket.id}`, "info")
      })
    })
  }

  async testTelegramBot(socket) {
    const testAttack = {
      id: "test-" + Date.now(),
      type: "test_alert",
      description: "This is a test alert from TrapDaemon",
      severity: "medium",
      source: "8.8.8.8", // Use external IP for test
      target: "test",
      payload: "Test payload",
      timestamp: new Date(),
    }

    this.logger.log("TESTING TELEGRAM BOT...", "info")
    const success = await this.telegramBot.sendAttackAlert(testAttack)

    if (success) {
      socket.emit("telegramTest", { success: true, message: "Test alert sent successfully!" })
      this.logger.log("✅ Telegram test alert sent", "success")
    } else {
      socket.emit("telegramTest", { success: false, message: "Failed to send test alert" })
      this.logger.log("❌ Telegram test alert failed", "error")
    }
  }

  startHoneypot() {
    if (this.isRunning) return
    this.isRunning = true
    this.startTime = new Date()
    this.logger.log("TrapDaemon honeypot started", "success")
    this.addLog("Honeypot started", "system")
    this.broadcastUpdate()
  }

  stopHoneypot() {
    if (!this.isRunning) return
    this.isRunning = false
    this.logger.log("TrapDaemon honeypot stopped", "success")
    this.addLog("Honeypot stopped", "system")
    this.broadcastUpdate()
  }

  addLog(message, type = "system") {
    const logEntry = {
      timestamp: new Date().toISOString(),
      message,
      type,
    }
    this.logs.push(logEntry)

    // Keep only last 1000 logs
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-500)
    }

    // Emit to connected clients
    if (this.io) {
      this.io.emit("newLog", logEntry)
    }
  }

  startPeriodicUpdates() {
    this.updateInterval = setInterval(() => {
      this.broadcastUpdate()
    }, 500) // Update every 0.5 seconds
  }

  getSystemStats() {
    return {
      totalConnections: this.stats.totalConnections,
      activeTargets: this.targets.size,
      attacksDetected: this.attacks.length,
      dataHarvested: Math.round(this.stats.dataHarvested / 1024),
      uptime: this.getUptime(),
      isRunning: this.isRunning,
      services: {
        core: true,
        detection: true,
      },
      system: {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        memory: Math.round(os.totalmem() / 1024 / 1024),
        cpus: os.cpus().length,
      },
      capabilities: {
        isRoot: process.getuid ? process.getuid() === 0 : false,
      },
      telegram: this.telegramBot.getStatus(),
    }
  }

  getUptime() {
    if (!this.startTime) return "00:00:00"
    const diff = Date.now() - this.startTime.getTime()
    const seconds = Math.floor((diff / 1000) % 60)
    const minutes = Math.floor((diff / 1000 / 60) % 60)
    const hours = Math.floor((diff / 1000 / 60 / 60) % 24)
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }

  sendSystemInfo(socket) {
    const systemInfo = {
      os: os.type(),
      release: os.release(),
      arch: os.arch(),
      node: process.version,
      memory: os.totalmem(),
      freeMemory: os.freemem(),
      uptime: os.uptime(),
      telegram: this.telegramBot.getStatus(),
    }
    socket.emit("systemInfo", systemInfo)
  }

  broadcastUpdate() {
    const updateData = {
      stats: this.getSystemStats(),
      targets: Array.from(this.targets.values()).slice(-20),
      attacks: this.attacks.slice(-10),
      logs: this.logs.slice(-20),
    }

    for (const client of this.clients) {
      try {
        client.emit("dataUpdate", updateData)
      } catch (error) {
        // Client might be disconnected
      }
    }
  }

  exportData() {
    try {
      const exportData = {
        meta: {
          version: "1.0",
          timestamp: new Date().toISOString(),
        },
        targets: Array.from(this.targets.values()),
        attacks: this.attacks,
        logs: this.logs,
      }

      const exportDir = path.join(process.cwd(), "exports")
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true })
      }

      const exportPath = path.join(exportDir, `trapdaemon-export-${Date.now()}.json`)
      fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2))
      this.logger.log(`Data exported to ${exportPath}`, "success")
      this.addLog(`Data exported to ${exportPath}`, "system")
    } catch (error) {
      this.logger.logError(error, "Data export")
    }
  }

  // Utility functions
  safeString(input) {
    if (input === null || input === undefined) return ""
    if (typeof input === "string") return input.trim()
    if (typeof input.toString === "function") return input.toString().trim()
    try {
      return JSON.stringify(input).trim()
    } catch (e) {
      return "[Circular or invalid object]"
    }
  }

  generateTargetId(ip) {
    return Buffer.from(ip).toString("base64").substring(0, 8)
  }

  async executeCommand(command) {
    return new Promise((resolve, reject) => {
      exec(command, { timeout: 10000 }, (error, stdout, stderr) => {
        if (error) {
          return reject(new Error(`Command failed: ${command} - ${error.message}`))
        }
        resolve(stdout.trim())
      })
    })
  }

  async cleanup() {
    try {
      if (this.updateInterval) {
        clearInterval(this.updateInterval)
      }

      await this.core.stop()
      await this.attackDetector.stop()
      await this.networkManager.cleanup()

      if (this.httpServer) {
        this.httpServer.close()
      }

      this.logger.log("TrapDaemon cleanup completed", "success")
    } catch (error) {
      this.logger.logError(error, "Cleanup")
    }
  }
}

// Load environment variables first
loadEnvFile()

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("\nReceived SIGINT. Graceful shutdown...")
  if (global.daemon) {
    await global.daemon.cleanup()
  }
  process.exit(0)
})

process.on("SIGTERM", async () => {
  console.log("\nReceived SIGTERM. Graceful shutdown...")
  if (global.daemon) {
    await global.daemon.cleanup()
  }
  process.exit(0)
})

// Start the daemon
const daemon = new TrapDaemon()
global.daemon = daemon

daemon.initialize().catch((err) => {
  console.error("Failed to start TrapDaemon:", err)
  process.exit(1)
})
