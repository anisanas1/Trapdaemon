import { EventEmitter } from "events"
import crypto from "crypto"
import fs from "fs"
import { exec, spawn } from "child_process"
import { Logger } from "../utils/logger.js"

export class AttackDetector extends EventEmitter {
  constructor() {
    super()
    this.logger = new Logger()
    this.isActive = false
    this.detectionRules = new Map()
    this.threatSignatures = new Map()
    this.suspiciousActivities = []
    this.attackPatterns = []
    this.monitoringInterval = null
    this.trafficBuffer = []
    this.connectionAttempts = new Map()
    this.ipActivity = new Map()
  }

  async initialize() {
    this.logger.log("Initializing Attack Detection Engine...", "info")
    try {
      await this.loadDetectionRules()
      await this.loadThreatSignatures()
      await this.setupTrafficAnalysis()
      this.logger.log("Attack Detection Engine initialized successfully", "success")
    } catch (error) {
      this.logger.logError(error, "AttackDetector initialization")
    }
  }

  async loadDetectionRules() {
    this.detectionRules.set("bruteforce", {
      pattern: /failed.*(login|password|authentication|auth)/i,
      threshold: 5,
      timeWindow: 300000,
      severity: "high",
      description: "Brute force attack detected",
    })

    this.detectionRules.set("portscan", {
      pattern: /connection.*(refused|reset|timeout)/i,
      threshold: 10,
      timeWindow: 60000,
      severity: "medium",
      description: "Port scanning activity detected",
    })

    this.detectionRules.set("sqlinjection", {
      pattern: /(union.*select|drop.*table|insert.*into|update.*set|delete.*from|'.*or.*'|".*or.*"|select.*from)/i,
      threshold: 1,
      timeWindow: 0,
      severity: "high",
      description: "SQL injection attempt detected",
    })

    this.detectionRules.set("xss", {
      pattern: /<script|javascript:|onload=|onerror=|onclick=|onmouseover=/i,
      threshold: 1,
      timeWindow: 0,
      severity: "medium",
      description: "Cross-site scripting attempt detected",
    })

    this.detectionRules.set("directory_traversal", {
      pattern: /(\.\.\/|\.\.\\)/i,
      threshold: 1,
      timeWindow: 0,
      severity: "high",
      description: "Directory traversal attempt detected",
    })

    this.detectionRules.set("command_injection", {
      pattern: /(;|\||&|\$\(|`).*(cat|ls|pwd|whoami|id|uname|nc|netcat|wget|curl|bash|sh|cmd|powershell)/i,
      threshold: 1,
      timeWindow: 0,
      severity: "critical",
      description: "Command injection attempt detected",
    })

    this.detectionRules.set("malware_download", {
      pattern: /(wget|curl|powershell|certutil).*(\.exe|\.bat|\.scr|\.dll|\.ps1)/i,
      threshold: 1,
      timeWindow: 0,
      severity: "high",
      description: "Malware download attempt detected",
    })

    this.logger.log(`Loaded ${this.detectionRules.size} detection rules`, "success")
  }

  async loadThreatSignatures() {
    this.threatSignatures.set("malicious_ips", new Set(["192.168.1.666", "10.0.0.666"]))

    this.threatSignatures.set(
      "malicious_domains",
      new Set(["malware.com", "phishing.net", "botnet.org", "evil.com", "badsite.net"]),
    )

    this.threatSignatures.set(
      "attack_patterns",
      new Set([
        "union+select",
        "../../../etc/passwd",
        "cmd.exe",
        "powershell.exe",
        "/bin/bash",
        "nc -l",
        "rm -rf",
        "format c:",
      ]),
    )

    this.threatSignatures.set(
      "suspicious_extensions",
      new Set([".exe", ".bat", ".scr", ".pif", ".com", ".cmd", ".ps1", ".vbs"]),
    )

    this.logger.log(`Loaded ${this.threatSignatures.size} threat signature categories`, "success")
  }

  async setupTrafficAnalysis() {
    this.logger.log("Setting up traffic analysis...", "info")
    this.monitoringInterval = setInterval(() => {
      this.analyzeTrafficBuffer()
    }, 5000)
  }

  async start() {
    this.isActive = true
    this.startBehavioralAnalysis()
    // DISABLE THREAT HUNTING - This is what's causing localhost alerts
    // this.startThreatHunting()
    this.startLogMonitoring()
    this.logger.log("Attack detection engine started", "success")
  }

  startBehavioralAnalysis() {
    this.behaviorInterval = setInterval(() => {
      this.analyzeBehaviorPatterns()
    }, 30000)
    this.logger.log("Behavioral analysis started", "info")
  }

  startThreatHunting() {
    // DISABLED - This was causing localhost alerts
    this.logger.log("Threat hunting disabled to prevent localhost alerts", "info")
  }

  startLogMonitoring() {
    this.logger.log("Log monitoring started", "info")
    try {
      if (fs.existsSync("/var/log/auth.log")) {
        this.monitorLogFile("/var/log/auth.log", "auth")
      }
      if (fs.existsSync("/var/log/syslog")) {
        this.monitorLogFile("/var/log/syslog", "system")
      }
    } catch (error) {
      this.logger.logError(error, "Log monitoring could not be started - insufficient permissions")
    }
  }

  monitorLogFile(filePath, logType) {
    try {
      const tail = spawn("tail", ["-f", filePath], { stdio: "pipe" })
      tail.stdout.on("data", (data) => {
        const lines = data
          .toString()
          .split("\n")
          .filter((line) => line.trim())
        lines.forEach((line) => {
          this.analyzeLogLine(line, logType)
        })
      })
      tail.on("error", (error) => {
        this.logger.logError(error, `Log monitoring error for ${filePath}`)
      })
    } catch (error) {
      this.logger.logError(error, `Could not monitor ${filePath}`)
    }
  }

  analyzeLogLine(line, logType) {
    const ip = this.extractIPFromLog(line) || "unknown"

    // STRICT LOCALHOST FILTERING
    if (this.isLocalhostStrict(ip)) {
      return // Completely ignore localhost
    }

    for (const [ruleName, rule] of this.detectionRules.entries()) {
      if (rule.pattern.test(line)) {
        const attack = {
          id: this.generateAttackId(),
          type: `log_${ruleName}`,
          description: `${rule.description} in ${logType} logs`,
          severity: rule.severity,
          source: ip,
          target: "system",
          payload: line,
          timestamp: new Date(),
          targetId: "system",
        }

        this.attackPatterns.push(attack)
        this.emit("attackDetected", attack)
        this.logger.logAttack(attack)
      }
    }
  }

  extractIPFromLog(logLine) {
    const ipPattern = /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/
    const match = logLine.match(ipPattern)
    return match ? match[0] : null
  }

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

  // SUPER STRICT LOCALHOST DETECTION
  isLocalhostStrict(ip) {
    if (!ip || ip === "" || ip === null || ip === undefined) return true

    const ipStr = String(ip).toLowerCase().trim()

    // All possible localhost variants
    const localhostVariants = ["127.0.0.1", "::1", "localhost", "unknown", "system", "filesystem", "0.0.0.0", "local"]

    // Check exact matches
    if (localhostVariants.includes(ipStr)) return true

    // Check prefixes
    if (ipStr.startsWith("127.")) return true
    if (ipStr.startsWith("::")) return true

    // Check for internal/private IPs that should be ignored
    if (ipStr.startsWith("192.168.")) return true
    if (ipStr.startsWith("10.")) return true
    if (ipStr.startsWith("172.16.")) return true
    if (ipStr.startsWith("172.17.")) return true
    if (ipStr.startsWith("172.18.")) return true
    if (ipStr.startsWith("172.19.")) return true
    if (ipStr.startsWith("172.20.")) return true
    if (ipStr.startsWith("172.21.")) return true
    if (ipStr.startsWith("172.22.")) return true
    if (ipStr.startsWith("172.23.")) return true
    if (ipStr.startsWith("172.24.")) return true
    if (ipStr.startsWith("172.25.")) return true
    if (ipStr.startsWith("172.26.")) return true
    if (ipStr.startsWith("172.27.")) return true
    if (ipStr.startsWith("172.28.")) return true
    if (ipStr.startsWith("172.29.")) return true
    if (ipStr.startsWith("172.30.")) return true
    if (ipStr.startsWith("172.31.")) return true

    return false
  }

  processTrafficData(data) {
    if (!data || !data.payload) return

    const sourceIP = data.src_ip || data.source || "unknown"

    // STRICT LOCALHOST FILTERING
    if (this.isLocalhostStrict(sourceIP)) {
      return // Completely ignore localhost
    }

    this.trafficBuffer.push({
      ...data,
      timestamp: Date.now(),
      id: this.generateActivityId(),
    })

    if (this.trafficBuffer.length > 1000) {
      this.trafficBuffer = this.trafficBuffer.slice(-500)
    }

    this.analyzeImmediateThreats(data)
  }

  analyzeImmediateThreats(data) {
    try {
      const payload = this.safeString(data.payload)
      const sourceIP = data.src_ip || data.source || "unknown"

      // STRICT LOCALHOST FILTERING
      if (this.isLocalhostStrict(sourceIP)) {
        return // Completely ignore localhost
      }

      // Log that we're processing external traffic
      this.logger.log(`Processing external traffic from ${sourceIP}`, "debug")

      for (const [ruleName, rule] of this.detectionRules.entries()) {
        if (payload && payload.length > 0 && rule.pattern.test(payload)) {
          const attack = {
            id: this.generateAttackId(),
            type: ruleName,
            description: rule.description,
            severity: rule.severity,
            source: sourceIP,
            target: data.dst_ip || data.target || "honeypot",
            payload: payload,
            timestamp: new Date(),
            targetId: this.generateTargetId(sourceIP),
          }

          this.attackPatterns.push(attack)
          this.logger.log(`EMITTING ATTACK: ${attack.type} from ${attack.source}`, "warn")
          this.emit("attackDetected", attack)
          this.logger.logAttack(attack)
        }
      }

      this.checkThreatSignatures(data)
    } catch (error) {
      this.logger.logError(error, "analyzeImmediateThreats")
    }
  }

  checkThreatSignatures(data) {
    let threatFound = false
    const sourceIP = data.src_ip || data.source

    // STRICT LOCALHOST FILTERING
    if (this.isLocalhostStrict(sourceIP)) {
      return false
    }

    if (sourceIP && this.threatSignatures.get("malicious_ips").has(sourceIP)) {
      this.reportThreat("malicious_ip", data, "Connection from known malicious IP")
      threatFound = true
    }

    const payload = this.safeString(data.payload)
    if (payload) {
      const payloadLower = payload.toLowerCase()

      for (const pattern of this.threatSignatures.get("attack_patterns")) {
        if (payloadLower.includes(pattern.toLowerCase())) {
          this.reportThreat("attack_pattern", data, `Known attack pattern detected: ${pattern}`)
          threatFound = true
          break
        }
      }

      for (const ext of this.threatSignatures.get("suspicious_extensions")) {
        if (payloadLower.includes(ext.toLowerCase())) {
          this.reportThreat("suspicious_file", data, `Suspicious file extension detected: ${ext}`)
          threatFound = true
          break
        }
      }
    }

    return threatFound
  }

  reportThreat(threatType, data, description) {
    const source = data.src_ip || data.source || "unknown"

    // STRICT LOCALHOST FILTERING
    if (this.isLocalhostStrict(source)) {
      return
    }

    const threat = {
      id: this.generateAttackId(),
      type: `threat_${threatType}`,
      description: description,
      severity: "high",
      source: source,
      target: data.dst_ip || data.target || "honeypot",
      payload: this.safeString(data.payload),
      timestamp: new Date(),
      targetId: this.generateTargetId(source),
    }

    this.attackPatterns.push(threat)
    this.logger.log(`EMITTING THREAT: ${threat.type} from ${threat.source}`, "warn")
    this.emit("attackDetected", threat)
    this.logger.logAttack(threat)
  }

  analyzeTrafficBuffer() {
    const now = Date.now()
    // Filter out localhost traffic completely
    const recentTraffic = this.trafficBuffer.filter((item) => {
      const ip = item.src_ip || item.source
      return now - item.timestamp < 300000 && !this.isLocalhostStrict(ip)
    })
    this.trafficBuffer = recentTraffic

    this.detectPortScanning(recentTraffic)
    this.detectBruteForcePatterns(recentTraffic)
    this.detectDataExfiltration(recentTraffic)
    this.detectSuspiciousVolume(recentTraffic)
  }

  analyzeBehaviorPatterns() {
    const now = Date.now()

    for (const [ip, activities] of this.ipActivity.entries()) {
      // STRICT LOCALHOST FILTERING
      if (this.isLocalhostStrict(ip)) {
        continue
      }

      const recent = activities.filter((activity) => now - activity.timestamp < 300000)
      this.ipActivity.set(ip, recent)
      this.analyzeIPBehavior(ip, recent)
    }
  }

  analyzeIPBehavior(ip, activities) {
    // STRICT LOCALHOST FILTERING
    if (this.isLocalhostStrict(ip)) {
      return
    }

    if (activities.length > 50) {
      this.reportBehavioralAnomaly(ip, "high_volume", `High volume activity: ${activities.length} actions in 5 minutes`)
    }

    const uniquePorts = new Set(activities.map((a) => a.port).filter(Boolean))
    if (uniquePorts.size > 10) {
      this.reportBehavioralAnomaly(
        ip,
        "port_scanning",
        `Port scanning detected: ${uniquePorts.size} different ports accessed`,
      )
    }
  }

  reportBehavioralAnomaly(ip, type, description) {
    // STRICT LOCALHOST FILTERING
    if (this.isLocalhostStrict(ip)) {
      return
    }

    const attack = {
      id: this.generateAttackId(),
      type: `behavioral_${type}`,
      description: description,
      severity: "medium",
      source: ip,
      target: "honeypot",
      timestamp: new Date(),
      targetId: this.generateTargetId(ip),
      meta: { timestamp: Date.now() },
    }

    this.attackPatterns.push(attack)
    this.logger.log(`EMITTING BEHAVIORAL: ${attack.type} from ${attack.source}`, "warn")
    this.emit("attackDetected", attack)
    this.logger.logAttack(attack)
  }

  detectPortScanning(traffic) {
    const portAccessByIP = new Map()
    traffic.forEach((item) => {
      const ip = item.src_ip || item.source
      if (!ip || this.isLocalhostStrict(ip)) return

      if (!portAccessByIP.has(ip)) {
        portAccessByIP.set(ip, new Set())
      }
      if (item.dst_port || item.port) {
        portAccessByIP.get(ip).add(item.dst_port || item.port)
      }
    })

    portAccessByIP.forEach((ports, ip) => {
      if (this.isLocalhostStrict(ip)) return

      if (ports.size > 15) {
        const attack = {
          id: this.generateAttackId(),
          type: "port_scanning",
          description: `Port scanning detected - ${ports.size} ports accessed`,
          severity: "medium",
          source: ip,
          target: "multiple",
          timestamp: new Date(),
          targetId: this.generateTargetId(ip),
          meta: { portsAccessed: Array.from(ports) },
        }

        this.logger.log(`EMITTING PORT SCAN: from ${attack.source}`, "warn")
        this.emit("attackDetected", attack)
        this.logger.logAttack(attack)
      }
    })
  }

  detectBruteForcePatterns(traffic) {
    const attemptsByIP = new Map()
    traffic.forEach((item) => {
      const ip = item.src_ip || item.source
      const payload = this.safeString(item.payload)
      if (!ip || !payload || this.isLocalhostStrict(ip)) return

      if (/login|password|auth|ssh|ftp|telnet/i.test(payload)) {
        attemptsByIP.set(ip, (attemptsByIP.get(ip) || 0) + 1)
      }
    })

    attemptsByIP.forEach((count, ip) => {
      if (this.isLocalhostStrict(ip)) return

      if (count > 10) {
        const attack = {
          id: this.generateAttackId(),
          type: "brute_force",
          description: `Brute force attack detected - ${count} authentication attempts`,
          severity: "high",
          source: ip,
          target: "authentication_system",
          timestamp: new Date(),
          targetId: this.generateTargetId(ip),
          meta: { attemptCount: count },
        }

        this.logger.log(`EMITTING BRUTE FORCE: from ${attack.source}`, "warn")
        this.emit("attackDetected", attack)
        this.logger.logAttack(attack)
      }
    })
  }

  detectDataExfiltration(traffic) {
    const dataTransferByIP = new Map()
    traffic.forEach((item) => {
      const ip = item.src_ip || item.source
      const payload = this.safeString(item.payload)
      if (!ip || !payload || this.isLocalhostStrict(ip)) return

      if (payload.length > 500) {
        dataTransferByIP.set(ip, (dataTransferByIP.get(ip) || 0) + payload.length)
      }
    })

    dataTransferByIP.forEach((totalBytes, ip) => {
      if (this.isLocalhostStrict(ip)) return

      if (totalBytes > 50000) {
        const attack = {
          id: this.generateAttackId(),
          type: "data_exfiltration",
          description: `Potential data exfiltration - ${Math.round(totalBytes / 1024)}KB transferred`,
          severity: "high",
          source: ip,
          target: "data_store",
          timestamp: new Date(),
          targetId: this.generateTargetId(ip),
          meta: { bytesTransferred: totalBytes },
        }

        this.logger.log(`EMITTING DATA EXFIL: from ${attack.source}`, "warn")
        this.emit("attackDetected", attack)
        this.logger.logAttack(attack)
      }
    })
  }

  detectSuspiciousVolume(traffic) {
    const requestsByIP = new Map()
    traffic.forEach((item) => {
      const ip = item.src_ip || item.source
      if (!ip || this.isLocalhostStrict(ip)) return

      requestsByIP.set(ip, (requestsByIP.get(ip) || 0) + 1)
    })

    requestsByIP.forEach((count, ip) => {
      if (this.isLocalhostStrict(ip)) return

      if (count > 100) {
        const attack = {
          id: this.generateAttackId(),
          type: "suspicious_volume",
          description: `Suspicious traffic volume - ${count} requests in 5 minutes`,
          severity: "medium",
          source: ip,
          target: "honeypot",
          timestamp: new Date(),
          targetId: this.generateTargetId(ip),
          meta: { requestCount: count },
        }

        this.logger.log(`EMITTING SUSPICIOUS VOLUME: from ${attack.source}`, "warn")
        this.emit("attackDetected", attack)
        this.logger.logAttack(attack)
      }
    })
  }

  // COMPLETELY REMOVED THREAT HUNTING FUNCTIONS
  async huntForThreats() {
    // DISABLED - No more localhost alerts
    return
  }

  async checkSuspiciousProcesses() {
    // DISABLED - No more localhost alerts
    return
  }

  async checkSuspiciousConnections() {
    // DISABLED - No more localhost alerts
    return
  }

  async checkFileSystemChanges() {
    // DISABLED - No more localhost alerts
    return
  }

  async executeCommand(command) {
    return new Promise((resolve, reject) => {
      exec(command, { timeout: 5000 }, (error, stdout, stderr) => {
        if (error) return reject(error)
        resolve(stdout.trim())
      })
    })
  }

  recordIPActivity(ip, activity) {
    if (!ip || !activity || this.isLocalhostStrict(ip)) return

    if (!this.ipActivity.has(ip)) {
      this.ipActivity.set(ip, [])
    }

    this.ipActivity.get(ip).push({ ...activity, timestamp: Date.now() })

    const activities = this.ipActivity.get(ip)
    if (activities.length > 100) {
      this.ipActivity.set(ip, activities.slice(-50))
    }
  }

  generateAttackId() {
    return crypto.randomBytes(8).toString("hex")
  }

  generateActivityId() {
    return crypto.randomBytes(6).toString("hex")
  }

  generateTargetId(ip) {
    return crypto.createHash("md5").update(ip).digest("hex").substring(0, 8)
  }

  async stop() {
    this.isActive = false
    if (this.behaviorInterval) {
      clearInterval(this.behaviorInterval)
      this.behaviorInterval = null
    }
    if (this.threatHuntingInterval) {
      clearInterval(this.threatHuntingInterval)
      this.threatHuntingInterval = null
    }
    this.logger.log("Attack detection engine stopped", "info")
  }

  getDetectionStats() {
    return {
      isActive: this.isActive,
      totalAttacks: this.attackPatterns.length,
      detectionRules: this.detectionRules.size,
      threatSignatures: this.threatSignatures.size,
      ipActivity: this.ipActivity.size,
      trafficBuffer: this.trafficBuffer.length,
    }
  }

  getRecentAttacks(count = 10) {
    return this.attackPatterns.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, count)
  }

  getAttacksByType() {
    const attacksByType = {}
    this.attackPatterns.forEach((attack) => {
      attacksByType[attack.type] = (attacksByType[attack.type] || 0) + 1
    })
    return attacksByType
  }

  getTopAttackSources(count = 10) {
    const sourceCount = {}
    this.attackPatterns.forEach((attack) => {
      sourceCount[attack.source] = (sourceCount[attack.source] || 0) + 1
    })

    return Object.entries(sourceCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, count)
      .map(([source, count]) => ({ source, count }))
  }
}
