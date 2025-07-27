import fs from "fs"
import path from "path"
import chalk from "chalk"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export class Logger {
  constructor(options = {}) {
    // logDir is relative to process.cwd(), which is the project root
    this.logDir = options.logDir || path.join(process.cwd(), "logs")
    this.logFile = options.logFile || "trapdaemon.log"
    this.attackLogFile = options.attackLogFile || "attacks.log"
    this.systemLogFile = options.systemLogFile || "system.log"
    this.maxLogSize = options.maxLogSize || 10 * 1024 * 1024 // 10MB
    this.maxLogFiles = options.maxLogFiles || 5

    this.initializeLogDirectory()
  }

  initializeLogDirectory() {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true })
      }
    } catch (error) {
      console.error(chalk.red(`Failed to create log directory: ${error.message}`))
    }
  }

  log(message, level = "info", category = "system") {
    const timestamp = new Date().toISOString()
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      category,
      message,
      pid: process.pid,
    }

    // Write to console with colors
    this.logToConsole(logEntry)

    // Write to appropriate log file
    this.logToFile(logEntry)
  }

  logToConsole(logEntry) {
    const { timestamp, level, category, message } = logEntry
    const timeStr = new Date(timestamp).toLocaleTimeString()

    let coloredLevel
    switch (level) {
      case "ERROR":
        coloredLevel = chalk.red.bold(level)
        break
      case "WARN":
        coloredLevel = chalk.yellow.bold(level)
        break
      case "INFO":
        coloredLevel = chalk.blue.bold(level)
        break
      case "DEBUG":
        coloredLevel = chalk.gray.bold(level)
        break
      case "SUCCESS":
        coloredLevel = chalk.green.bold(level)
        break
      default:
        coloredLevel = chalk.white.bold(level)
    }

    const categoryStr = chalk.cyan(`[${category}]`)
    const timeColor = chalk.gray(`[${timeStr}]`)

    console.log(`${timeColor} ${coloredLevel} ${categoryStr} ${message}`)
  }

  logToFile(logEntry) {
    const logLine = JSON.stringify(logEntry) + "\n"

    // Determine which file to write to
    let fileName
    if (logEntry.category === "attack" || logEntry.category === "security") {
      fileName = this.attackLogFile
    } else if (logEntry.category === "system" || logEntry.category === "network") {
      fileName = this.systemLogFile
    } else {
      fileName = this.logFile
    }

    const filePath = path.join(this.logDir, fileName)

    try {
      // Check if log rotation is needed
      this.rotateLogIfNeeded(filePath)

      // Append to log file
      fs.appendFileSync(filePath, logLine)
    } catch (error) {
      console.error(chalk.red(`Failed to write to log file: ${error.message}`))
    }
  }

  rotateLogIfNeeded(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        return
      }

      const stats = fs.statSync(filePath)
      if (stats.size >= this.maxLogSize) {
        this.rotateLogFile(filePath)
      }
    } catch (error) {
      console.error(chalk.red(`Log rotation failed: ${error.message}`))
    }
  }

  rotateLogFile(filePath) {
    try {
      const dir = path.dirname(filePath)
      const ext = path.extname(filePath)
      const baseName = path.basename(filePath, ext)

      // Shift existing rotated files
      for (let i = this.maxLogFiles - 1; i > 0; i--) {
        const oldFile = path.join(dir, `${baseName}.${i}${ext}`)
        const newFile = path.join(dir, `${baseName}.${i + 1}${ext}`)

        if (fs.existsSync(oldFile)) {
          if (i === this.maxLogFiles - 1) {
            fs.unlinkSync(oldFile) // Delete oldest file
          } else {
            fs.renameSync(oldFile, newFile)
          }
        }
      }

      // Move current file to .1
      const rotatedFile = path.join(dir, `${baseName}.1${ext}`)
      fs.renameSync(filePath, rotatedFile)

      this.log(`Log file rotated: ${filePath}`, "info", "system")
    } catch (error) {
      console.error(chalk.red(`Log rotation failed: ${error.message}`))
    }
  }

  logAttack(attackInfo) {
    const message = `Attack detected: ${attackInfo.type} from ${attackInfo.source} - ${attackInfo.description}`
    this.log(message, "warn", "attack")

    // Also log detailed attack info
    const detailedLog = {
      timestamp: new Date().toISOString(),
      type: "ATTACK_DETAIL",
      attack: attackInfo,
    }

    const attackLogPath = path.join(this.logDir, "detailed_attacks.jsonl")
    try {
      fs.appendFileSync(attackLogPath, JSON.stringify(detailedLog) + "\n")
    } catch (error) {
      console.error(chalk.red(`Failed to log attack details: ${error.message}`))
    }
  }

  logConnection(connectionInfo) {
    const message = `New connection: ${connectionInfo.ip} (${connectionInfo.location || "Unknown"})`
    this.log(message, "info", "network")

    // Log detailed connection info
    const detailedLog = {
      timestamp: new Date().toISOString(),
      type: "CONNECTION_DETAIL",
      connection: connectionInfo,
    }

    const connectionsLogPath = path.join(this.logDir, "connections.jsonl")
    try {
      fs.appendFileSync(connectionsLogPath, JSON.stringify(detailedLog) + "\n")
    } catch (error) {
      console.error(chalk.red(`Failed to log connection details: ${error.message}`))
    }
  }

  logDataHarvest(harvestInfo) {
    const message = `Data harvested: ${harvestInfo.type} (${harvestInfo.size} bytes)`
    this.log(message, "info", "security")

    // Log detailed harvest info
    const detailedLog = {
      timestamp: new Date().toISOString(),
      type: "DATA_HARVEST",
      harvest: harvestInfo,
    }

    const harvestLogPath = path.join(this.logDir, "data_harvest.jsonl")
    try {
      fs.appendFileSync(harvestLogPath, JSON.stringify(detailedLog) + "\n")
    } catch (error) {
      console.error(chalk.red(`Failed to log harvest details: ${error.message}`))
    }
  }

  logSystemEvent(event, details = {}) {
    const message = `System event: ${event}`
    this.log(message, "info", "system")

    if (Object.keys(details).length > 0) {
      const detailedLog = {
        timestamp: new Date().toISOString(),
        type: "SYSTEM_EVENT",
        event,
        details,
      }

      const eventsLogPath = path.join(this.logDir, "system_events.jsonl")
      try {
        fs.appendFileSync(eventsLogPath, JSON.stringify(detailedLog) + "\n")
      } catch (error) {
        console.error(chalk.red(`Failed to log system event: ${error.message}`))
      }
    }
  }

  logError(error, context = "") {
    const message = `Error${context ? ` in ${context}` : ""}: ${error.message}`
    this.log(message, "error", "system")

    // Log detailed error info
    const errorLog = {
      timestamp: new Date().toISOString(),
      type: "ERROR_DETAIL",
      error: {
        message: error.message,
        stack: error.stack,
        context,
      },
    }

    const errorLogPath = path.join(this.logDir, "errors.jsonl")
    try {
      fs.appendFileSync(errorLogPath, JSON.stringify(errorLog) + "\n")
    } catch (error) {
      console.error(chalk.red(`Failed to log error details: ${error.message}`))
    }
  }

  // Get recent logs for dashboard display
  getRecentLogs(count = 100, category = null) {
    const logs = []
    const logFiles = [this.logFile, this.systemLogFile, this.attackLogFile]

    for (const fileName of logFiles) {
      const filePath = path.join(this.logDir, fileName)

      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath, "utf8")
          const lines = content
            .trim()
            .split("\n")
            .filter((line) => line)

          for (const line of lines) {
            try {
              const logEntry = JSON.parse(line)
              if (!category || logEntry.category === category) {
                logs.push(logEntry)
              }
            } catch (parseError) {
              // Skip invalid JSON lines
            }
          }
        } catch (readError) {
          console.error(`Error reading log file ${fileName}:`, readError.message)
        }
      }
    }

    // Sort by timestamp and return most recent
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    return logs.slice(0, count)
  }

  // Get log statistics
  getLogStats() {
    const stats = {
      totalLogs: 0,
      logsByLevel: {},
      logsByCategory: {},
      logFiles: [],
    }

    const logFiles = [this.logFile, this.systemLogFile, this.attackLogFile]

    for (const fileName of logFiles) {
      const filePath = path.join(this.logDir, fileName)

      if (fs.existsSync(filePath)) {
        try {
          const fileStats = fs.statSync(filePath)
          stats.logFiles.push({
            name: fileName,
            size: fileStats.size,
            modified: fileStats.mtime,
          })

          const content = fs.readFileSync(filePath, "utf8")
          const lines = content
            .trim()
            .split("\n")
            .filter((line) => line)

          for (const line of lines) {
            try {
              const logEntry = JSON.parse(line)
              stats.totalLogs++

              // Count by level
              stats.logsByLevel[logEntry.level] = (stats.logsByLevel[logEntry.level] || 0) + 1

              // Count by category
              stats.logsByCategory[logEntry.category] = (stats.logsByCategory[logEntry.category] || 0) + 1
            } catch (parseError) {
              // Skip invalid JSON lines
            }
          }
        } catch (error) {
          console.error(`Error reading stats for ${fileName}:`, error.message)
        }
      }
    }

    return stats
  }

  // Export logs for analysis
  exportLogs(startDate, endDate, outputFile) {
    try {
      const logs = this.getRecentLogs(10000) // Get a large number of logs

      // Filter by date range if provided
      let filteredLogs = logs
      if (startDate || endDate) {
        filteredLogs = logs.filter((log) => {
          const logDate = new Date(log.timestamp)
          if (startDate && logDate < new Date(startDate)) return false
          if (endDate && logDate > new Date(endDate)) return false
          return true
        })
      }

      const exportData = {
        exportDate: new Date().toISOString(),
        dateRange: { startDate, endDate },
        totalLogs: filteredLogs.length,
        logs: filteredLogs,
      }

      fs.writeFileSync(outputFile, JSON.stringify(exportData, null, 2))
      this.log(`Logs exported to ${outputFile} (${filteredLogs.length} entries)`, "success", "system")
      return true
    } catch (error) {
      this.logError(error, "log export")
      return false
    }
  }

  // Clear old logs
  clearOldLogs(daysToKeep = 30) {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

      const logFiles = fs.readdirSync(this.logDir)
      let clearedCount = 0

      for (const fileName of logFiles) {
        const filePath = path.join(this.logDir, fileName)

        try {
          const stats = fs.statSync(filePath)
          if (stats.mtime < cutoffDate) {
            fs.unlinkSync(filePath)
            clearedCount++
            this.log(`Cleared old log file: ${fileName}`, "info", "system")
          }
        } catch (error) {
          this.logError(error, `clearing old log ${fileName}`)
        }
      }

      this.log(`Cleared ${clearedCount} old log files`, "success", "system")
      return clearedCount
    } catch (error) {
      this.logError(error, "clearing old logs")
      return 0
    }
  }
}
