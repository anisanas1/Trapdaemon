import { exec, spawn } from "child_process"
import { EventEmitter } from "events"
import fs from "fs"
import path from "path"
import os from "os"
import { Logger } from "../utils/logger.js" // Corrected path

export class NetworkManager extends EventEmitter {
  constructor() {
    super()
    this.logger = new Logger()
    this.isActive = false
    this.monitoringProcesses = []
    this.networkInterface = null
    this.platform = os.platform()
  }

  async initialize() {
    this.logger.log("TrapDaemon Network Manager initializing...", "info")
    try {
      await this.checkSystemCapabilities()
      await this.detectNetworkInterface()
      this.logger.log("TrapDaemon Network Manager initialized", "success")
    } catch (error) {
      this.logger.logError(error, "Network Manager initialization")
      this.logger.log("Running in limited mode - some features may not work", "warn")
    }
  }

  async checkSystemCapabilities() {
    this.logger.log("Checking system capabilities...", "info")

    if (process.getuid && process.getuid() !== 0) {
      this.logger.log("Not running as root - network monitoring will be limited", "warn")
      return
    }

    const requiredTools = ["tcpdump", "iptables"]
    const availableTools = []

    for (const tool of requiredTools) {
      try {
        await this.executeCommand(`which ${tool}`)
        availableTools.push(tool)
      } catch (error) {
        this.logger.log(`Tool not found: ${tool}`, "warn")
      }
    }

    if (availableTools.includes("tcpdump") && availableTools.includes("iptables")) {
      this.logger.log("Network monitoring tools available", "success")
    } else {
      const missing = requiredTools.filter((t) => !availableTools.includes(t)).join(", ")
      this.logger.log(`Missing tools: ${missing}`, "warn")
    }
  }

  async detectNetworkInterface() {
    try {
      const interfaces = os.networkInterfaces()
      for (const name of Object.keys(interfaces)) {
        const info = interfaces[name].find((iface) => iface.family === "IPv4" && !iface.internal)
        if (info) {
          this.networkInterface = name
          this.logger.log(`Found network interface: ${name}`, "info")
          return
        }
      }

      const defaultRoute = await this.executeCommand("ip route | grep default")
      const match = defaultRoute.match(/dev (\w+)/)
      this.networkInterface = match ? match[1] : "eth0"

      this.logger.log(`Using network interface: ${this.networkInterface}`, "info")
    } catch (error) {
      this.networkInterface = "eth0"
      this.logger.log("Could not detect network interface, using eth0", "warn")
    }
  }

  async startNetworkMonitoring() {
    try {
      const monitorScript = `
#!/bin/bash
while true; do
    ss -tuln | grep -E ':2222|:2121|:2323|:8080' | while read line; do
        echo "NETSTAT: $line"
    done
    sleep 5
done
      `
      const scriptPath = "/tmp/trapdaemon/network_monitor.sh"

      // Create directory if it doesn't exist
      const scriptDir = path.dirname(scriptPath)
      if (!fs.existsSync(scriptDir)) {
        fs.mkdirSync(scriptDir, { recursive: true })
      }

      fs.writeFileSync(scriptPath, monitorScript)
      await this.executeCommand(`chmod +x ${scriptPath}`)
      const monitorProcess = spawn("bash", [scriptPath], { stdio: "pipe" })

      monitorProcess.stdout.on("data", (data) => {
        this.handleMonitoringData(data.toString())
      })

      monitorProcess.on("error", (error) => {
        this.logger.log(`Network monitoring error: ${error.message}`, "warn")
      })

      this.monitoringProcesses.push(monitorProcess)
      this.logger.log("Network monitoring started", "success")
    } catch (error) {
      this.logger.logError(error, "Starting network monitoring")
    }
  }

  async startPacketCapture() {
    try {
      const captureFile = "/tmp/trapdaemon/capture.pcap"
      const captureProcess = spawn("tcpdump", ["-i", this.networkInterface, "-w", captureFile, "-U"], { stdio: "pipe" })

      captureProcess.stderr.on("data", (data) => {
        const output = data.toString()
        if (output.includes("packets captured")) {
          this.logger.log(output.trim(), "info")
        }
      })

      captureProcess.on("error", (error) => {
        this.logger.log(`Packet capture error: ${error.message}`, "warn")
      })

      this.monitoringProcesses.push(captureProcess)
      this.logger.log("Packet capture started", "success")
    } catch (error) {
      this.logger.logError(error, "Starting packet capture")
    }
  }

  handleNewConnection(dhcpOutput) {
    try {
      const ipMatch = dhcpOutput.match(/(\d+\.\d+\.\d+\.\d+)/)
      const macMatch = dhcpOutput.match(
        /([0-9a-fA-F]{2}:[0-9a-fA-F]{2}:[0-9a-fA-F]{2}:[0-9a-fA-F]{2}:[0-9a-fA-F]{2}:[0-9a-fA-F]{2})/,
      )

      if (ipMatch) {
        const ip = ipMatch[1]
        const connectionInfo = {
          ip: ip,
          mac: macMatch ? macMatch[1] : "unknown",
          timestamp: new Date(),
          interface: this.networkInterface,
        }

        this.logger.log(`New connection: ${ip}`, "info")
        this.emit("newConnection", connectionInfo)
        this.gatherDeviceInfo(connectionInfo)
      }
    } catch (error) {
      this.logger.logError(error, "Handling new connection")
    }
  }

  async gatherDeviceInfo(connectionInfo) {
    try {
      const deviceInfo = {
        ...connectionInfo,
        hostname: await this.getHostname(connectionInfo.ip),
        openPorts: await this.scanPorts(connectionInfo.ip),
        services: [],
      }

      this.logger.log(`Device info gathered for ${connectionInfo.ip}`, "info")
      this.emit("deviceInfo", deviceInfo)
    } catch (error) {
      this.logger.logError(error, "Gathering device info")
    }
  }

  async getHostname(ip) {
    try {
      const result = await this.executeCommand(`nslookup ${ip}`)
      const match = result.match(/name = (.+)\./)
      return match ? match[1] : "Unknown"
    } catch (error) {
      return "Unknown"
    }
  }

  async scanPorts(ip) {
    try {
      const commonPorts = [22, 23, 25, 53, 80, 443, 3306, 6379, 27017, 5900]
      const openPorts = []

      for (const port of commonPorts.slice(0, 5)) {
        try {
          await this.executeCommand(`timeout 2 nc -z ${ip} ${port}`)
          openPorts.push(port)
          this.logger.log(`Open port found: ${ip}:${port}`, "info")
        } catch (error) {
          // Port is closed
        }
      }

      return openPorts
    } catch (error) {
      return []
    }
  }

  handleMonitoringData(data) {
    const lines = data.split("\n").filter((line) => line.trim())
    lines.forEach((line) => {
      if (line.startsWith("ARP_ENTRY:")) {
        this.logger.log(line, "info")
      } else if (line.startsWith("NETSTAT:")) {
        this.logger.log(line, "info")
      }
    })
  }

  async cleanup() {
    try {
      for (const process of this.monitoringProcesses) {
        if (process && typeof process.kill === "function") {
          process.kill("SIGTERM")
        }
      }
      this.monitoringProcesses = []
      this.logger.log("Network cleanup completed", "success")
    } catch (error) {
      this.logger.logError(error, "Network cleanup")
    }
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

  getNetworkStats() {
    return {
      isActive: this.isActive,
      interface: this.networkInterface,
      monitoringProcesses: this.monitoringProcesses.length,
      platform: this.platform,
    }
  }
}
