#!/usr/bin/env node

import chalk from "chalk"
import { execSync } from "child_process"
import fs from "fs"
import os from "os"
import path from "path"

class SystemChecker {
  constructor() {
    this.platform = os.platform()
    this.isRoot = process.getuid && process.getuid() === 0
    this.capabilities = {
      node: false,
      wifi: false,
      networking: false,
      monitoring: false,
    }
  }

  async run() {
    console.clear()
    this.showHeader()

    await this.checkNodeEnvironment()
    await this.checkNetworkCapabilities()
    await this.checkWiFiCapabilities()
    await this.checkMonitoringTools()
    await this.checkFilePermissions()

    this.showSummary()
    this.showRecommendations()
  }

  showHeader() {
    console.log(chalk.cyan.bold("ADVANCED HONEYPOT SYSTEM CHECK\n"))
    console.log(chalk.gray("Verifying system capabilities and requirements...\n"))
  }

  async checkNodeEnvironment() {
    console.log(chalk.yellow.bold("Node.js Environment"))
    console.log(chalk.gray("━".repeat(50)))

    // Node.js version
    try {
      const nodeVersion = process.version
      const majorVersion = Number.parseInt(nodeVersion.substring(1))

      if (majorVersion >= 18) {
        console.log(chalk.green("Node.js " + nodeVersion + " (compatible)"))
        this.capabilities.node = true
      } else {
        console.log(chalk.red("Node.js " + nodeVersion + " (requires >= 18.0.0)"))
      }
    } catch (error) {
      console.log(chalk.red("Node.js not found"))
    }

    // NPM version
    try {
      const npmVersion = execSync("npm --version", { encoding: "utf-8" }).trim()
      console.log(chalk.green("npm " + npmVersion))
    } catch (error) {
      console.log(chalk.red("npm not found"))
    }

    // Memory information
    const totalMem = Math.round(os.totalmem() / 1024 / 1024)
    const freeMem = Math.round(os.freemem() / 1024 / 1024)
    const usedMem = totalMem - freeMem

    console.log(chalk.green("Total Memory: " + totalMem + "MB"))
    console.log(chalk.blue("Used Memory: " + usedMem + "MB (" + Math.round((usedMem / totalMem) * 100) + "%)"))
    console.log(chalk.blue("Free Memory: " + freeMem + "MB"))

    if (freeMem < 256) {
      console.log(chalk.red("Low memory warning: Less than 256MB free"))
    }

    // CPU information
    const cpus = os.cpus()
    console.log(chalk.green("CPU Cores: " + cpus.length + " (" + cpus[0].model.split(" ")[0] + ")"))

    // Load average (Unix-like systems only)
    if (this.platform !== "win32") {
      const loadAvg = os.loadavg()
      const load1min = loadAvg[0].toFixed(2)
      console.log(chalk.blue("Load Average: " + load1min + " (1 min)"))

      if (loadAvg[0] > cpus.length) {
        console.log(chalk.yellow("High system load detected"))
      }
    }

    console.log()
  }

  async checkNetworkCapabilities() {
    console.log(chalk.yellow.bold("Network Capabilities"))
    console.log(chalk.gray("━".repeat(50)))

    // Basic networking tools
    const basicTools = [
      { name: "ss", description: "Socket statistics" },
      { name: "ps", description: "Process status" },
      { name: "grep", description: "Pattern matching" },
      { name: "awk", description: "Text processing" },
    ]

    let basicScore = 0
    for (const tool of basicTools) {
      if (await this.checkCommand(tool.name)) {
        console.log(chalk.green(tool.name + " - " + tool.description))
        basicScore++
      } else {
        console.log(chalk.red(tool.name + " - " + tool.description))
      }
    }

    this.capabilities.networking = basicScore >= 3

    // Network interfaces
    try {
      const interfaces = os.networkInterfaces()
      const interfaceNames = Object.keys(interfaces)
      console.log(chalk.green("Network interfaces: " + interfaceNames.join(", ")))

      // Check for wireless interfaces
      const wifiInterfaces = interfaceNames.filter(
        (name) => name.startsWith("wlan") || name.startsWith("wlp") || name.startsWith("wifi"),
      )

      if (wifiInterfaces.length > 0) {
        console.log(chalk.green("WiFi interfaces found: " + wifiInterfaces.join(", ")))
      } else {
        console.log(chalk.yellow("No WiFi interfaces detected"))
      }
    } catch (error) {
      console.log(chalk.red("Could not enumerate network interfaces"))
    }

    // Port availability check
    console.log(chalk.blue("Checking port availability..."))
    const testPorts = [2222, 2121, 2323, 8080, 3306]
    const availablePorts = []

    for (const port of testPorts) {
      if (await this.checkPortAvailable(port)) {
        availablePorts.push(port)
      }
    }

    if (availablePorts.length === testPorts.length) {
      console.log(chalk.green("All honeypot ports available (" + testPorts.join(", ") + ")"))
    } else {
      const busyPorts = testPorts.filter((p) => !availablePorts.includes(p))
      console.log(chalk.yellow("Some ports busy: " + busyPorts.join(", ")))
      console.log(chalk.blue("Available ports: " + availablePorts.join(", ")))
    }

    console.log()
  }

  async checkWiFiCapabilities() {
    console.log(chalk.yellow.bold("WiFi Honeypot Capabilities"))
    console.log(chalk.gray("━".repeat(50)))

    if (!this.isRoot) {
      console.log(chalk.yellow("Not running as root - WiFi capabilities limited"))
      console.log(chalk.blue("Run with sudo to check full WiFi capabilities"))
      console.log()
      return
    }

    const wifiTools = [
      { name: "hostapd", description: "WiFi access point daemon", critical: true },
      { name: "dnsmasq", description: "DNS/DHCP server", critical: true },
      { name: "tcpdump", description: "Packet capture", critical: false },
      { name: "iptables", description: "Firewall rules", critical: false },
    ]

    let wifiScore = 0
    let criticalCount = 0

    for (const tool of wifiTools) {
      if (await this.checkCommand(tool.name)) {
        console.log(chalk.green(tool.name + " - " + tool.description))
        wifiScore++
        if (tool.critical) criticalCount++
      } else {
        const level = tool.critical ? chalk.red : chalk.yellow
        const icon = tool.critical ? "FAIL" : "WARN"
        console.log(level(icon + " " + tool.name + " - " + tool.description))
        this.suggestWiFiInstallation(tool.name)
      }
    }

    this.capabilities.wifi = criticalCount >= 2

    // Check wireless interface capabilities
    if (await this.checkCommand("iwconfig")) {
      try {
        const iwconfig = execSync("iwconfig 2>/dev/null", { encoding: "utf-8" })
        if (iwconfig.includes("IEEE 802.11")) {
          console.log(chalk.green("Wireless interface detected"))
        } else {
          console.log(chalk.yellow("No wireless interfaces found"))
        }
      } catch (error) {
        console.log(chalk.gray("Could not check wireless interfaces"))
      }
    }

    // Check monitor mode support
    if (await this.checkCommand("iw")) {
      try {
        const iwSupported = execSync("iw list 2>/dev/null | grep -i monitor", { encoding: "utf-8" })
        if (iwSupported.includes("monitor")) {
          console.log(chalk.green("Monitor mode supported"))
        }
      } catch (error) {
        console.log(chalk.gray("Monitor mode support unknown"))
      }
    }

    console.log()
  }

  async checkMonitoringTools() {
    console.log(chalk.yellow.bold("Monitoring & Analysis Tools"))
    console.log(chalk.gray("━".repeat(50)))

    const monitoringTools = [
      { name: "netstat", description: "Network connections", alternative: "ss" },
      { name: "lsof", description: "Open files and ports" },
      { name: "nmap", description: "Network discovery", optional: true },
      { name: "nc", description: "Network connections", alternative: "netcat" },
      { name: "curl", description: "HTTP client", optional: true },
      { name: "tail", description: "Log monitoring" },
    ]

    let monitoringScore = 0

    for (const tool of monitoringTools) {
      let found = false

      if (await this.checkCommand(tool.name)) {
        console.log(chalk.green(tool.name + " - " + tool.description))
        found = true
        monitoringScore++
      } else if (tool.alternative && (await this.checkCommand(tool.alternative))) {
        console.log(chalk.green(tool.alternative + " - " + tool.description + " (alternative)"))
        found = true
        monitoringScore++
      } else {
        const level = tool.optional ? chalk.gray : chalk.yellow
        const icon = tool.optional ? "INFO" : "WARN"
        console.log(level(icon + " " + tool.name + " - " + tool.description + (tool.optional ? " (optional)" : "")))
      }
    }

    this.capabilities.monitoring = monitoringScore >= 4

    console.log()
  }

  async checkFilePermissions() {
    console.log(chalk.yellow.bold("File System & Permissions"))
    console.log(chalk.gray("━".repeat(50)))

    const directories = [
      { path: "logs", description: "Log storage" },
      { path: "harvested-data", description: "Captured data" },
      { path: "server", description: "Server code" }, // Updated description
    ]

    for (const dir of directories) {
      try {
        if (fs.existsSync(dir.path)) {
          const stats = fs.statSync(dir.path)
          if (stats.isDirectory()) {
            // Check write permissions
            try {
              const testFile = path.join(dir.path, ".write-test")
              fs.writeFileSync(testFile, "test")
              fs.unlinkSync(testFile)
              console.log(chalk.green(dir.path + "/ - " + dir.description + " (writable)"))
            } catch (writeError) {
              console.log(chalk.red(dir.path + "/ - " + dir.description + " (not writable)"))
            }
          } else {
            console.log(chalk.red(dir.path + " exists but is not a directory"))
          }
        } else {
          console.log(chalk.yellow(dir.path + "/ - " + dir.description + " (does not exist)"))
        }
      } catch (error) {
        console.log(chalk.red(dir.path + "/ - " + dir.description + " (access error)"))
      }
    }

    // Check temp directory access
    try {
      const tempDir = os.tmpdir()
      const testFile = path.join(tempDir, "honeypot-test-" + Date.now())
      fs.writeFileSync(testFile, "test")
      fs.unlinkSync(testFile)
      console.log(chalk.green("Temporary directory (" + tempDir + ") - writable"))
    } catch (error) {
      console.log(chalk.red("Temporary directory access failed"))
    }

    console.log()
  }

  showSummary() {
    console.log(chalk.cyan.bold("CAPABILITY SUMMARY"))
    console.log(chalk.gray("━".repeat(50)))

    const capabilities = [
      { name: "Node.js Environment", status: this.capabilities.node, critical: true },
      { name: "Basic Networking", status: this.capabilities.networking, critical: true },
      { name: "WiFi Honeypot", status: this.capabilities.wifi, critical: false },
      { name: "Monitoring Tools", status: this.capabilities.monitoring, critical: false },
    ]

    for (const cap of capabilities) {
      const icon = cap.status ? "OK" : "FAIL"
      const color = cap.status ? chalk.green : cap.critical ? chalk.red : chalk.yellow
      const critText = cap.critical ? " (critical)" : ""
      console.log(color(icon + " " + cap.name + critText))
    }

    const overallStatus = this.capabilities.node && this.capabilities.networking
    console.log()

    if (overallStatus) {
      console.log(chalk.green.bold("System is ready to run the honeypot!"))
    } else {
      console.log(chalk.red.bold("System requires fixes before running honeypot"))
    }

    console.log()
  }

  showRecommendations() {
    console.log(chalk.cyan.bold("RECOMMENDATIONS"))
    console.log(chalk.gray("━".repeat(50)))

    if (!this.capabilities.node) {
      console.log(chalk.red("Install Node.js 18+ from https://nodejs.org/"))
    }

    if (!this.capabilities.networking) {
      console.log(chalk.yellow("Install basic networking tools for your platform"))
    }

    if (!this.capabilities.wifi && this.isRoot) {
      console.log(chalk.yellow("Install WiFi tools for full honeypot capabilities:"))
      if (this.platform === "linux") {
        console.log(chalk.blue("   sudo apt-get install hostapd dnsmasq tcpdump"))
      } else if (this.platform === "darwin") {
        console.log(chalk.blue("   brew install hostapd dnsmasq tcpdump"))
      }
    }

    if (!this.capabilities.wifi && !this.isRoot) {
      console.log(chalk.yellow("Run as root (sudo) for WiFi honeypot features"))
    }

    if (!this.capabilities.monitoring) {
      console.log(chalk.yellow("Install monitoring tools like nmap, netcat for enhanced detection"))
    }

    // Security recommendations
    console.log(chalk.cyan("Security recommendations:"))
    console.log(chalk.blue("   • Run honeypot in isolated environment"))
    console.log(chalk.blue("   • Monitor honeypot logs regularly"))
    console.log(chalk.blue("   • Only use on networks you own/control"))
    console.log(chalk.blue("   • Keep system and dependencies updated"))

    console.log()
    console.log(chalk.gray("Run 'npm run setup' to install dependencies and configure directories"))
  }

  async checkCommand(command) {
    try {
      execSync(`which ${command}`, { stdio: "ignore" })
      return true
    } catch (error) {
      return false
    }
  }

  async checkPortAvailable(port) {
    try {
      // Try to bind to the port briefly
      const { createServer } = await import("net")
      const server = createServer()

      return new Promise((resolve) => {
        server.listen(port, "127.0.0.1", () => {
          server.close()
          resolve(true)
        })

        server.on("error", () => {
          resolve(false)
        })
      })
    } catch (error) {
      return false
    }
  }

  suggestWiFiInstallation(toolName) {
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
        linux: "sudo apt-get install iptables-persistent",
        darwin: "Not available on macOS",
      },
    }

    const suggestion = suggestions[toolName]
    if (suggestion && suggestion[this.platform]) {
      console.log(chalk.blue("    Install: " + suggestion[this.platform]))
    }
  }
}

// Run system check if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const checker = new SystemChecker()
  checker.run().catch((error) => {
    console.error(chalk.red(`System check failed: ${error.message}`))
    process.exit(1)
  })
}
