import crypto from "crypto"
import { EventEmitter } from "events"
import http from "http"
import net from "net"
import geoip from "geoip-lite"
import { Logger } from "../utils/logger.js"

export class HoneypotCore extends EventEmitter {
  constructor() {
    super()
    this.logger = new Logger()
    this.services = new Map()
    this.connections = new Map()
    this.isActive = false
    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      attacksDetected: 0,
      dataHarvested: 0,
    }

    // WSL-friendly port configuration
    this.ports = {
      ssh: 2222,
      telnet: 2323,
      ftp: 2121,
      http: 8080,
      https: 8443,
      smtp: 2525,
      mysql: 3306,
      postgresql: 5432,
      redis: 6379,
      mongodb: 27017,
      rdp: 3389,
      smb: 445,
      // Additional protocols for better coverage
      dns: 5353,
      snmp: 1161,
      tftp: 6969,
      vnc: 5900,
      elasticsearch: 9200,
      memcached: 11211,
    }
  }

  async initialize() {
    this.logger.log("TrapDaemon core initializing...", "info")
    try {
      await this.checkWSLCapabilities()
      await this.setupServices()
      this.logger.log("TrapDaemon core initialized successfully", "success")
    } catch (error) {
      this.logger.logError(error, "TrapDaemon core initialization")
      throw error
    }
  }

  async checkWSLCapabilities() {
    this.logger.log("Checking WSL capabilities...", "info")

    // Check if running in WSL
    try {
      const fs = await import("fs")
      if (fs.existsSync("/proc/version")) {
        const version = fs.readFileSync("/proc/version", "utf8")
        if (version.includes("Microsoft") || version.includes("WSL")) {
          this.logger.log("WSL environment detected - adjusting configuration", "info")
          this.isWSL = true
        }
      }
    } catch (error) {
      this.logger.log("Could not detect WSL environment", "warn")
    }

    // Check port availability
    const testPorts = [2222, 2121, 2323, 8080, 3306, 5432, 6379]
    for (const port of testPorts) {
      const available = await this.checkPortAvailable(port)
      if (!available) {
        this.logger.log(`Port ${port} is busy, trying alternative`, "warn")
        // Find alternative port
        let altPort = port + 1000
        while (!(await this.checkPortAvailable(altPort)) && altPort < port + 2000) {
          altPort++
        }
        this.logger.log(`Using alternative port ${altPort} instead of ${port}`, "info")
        // Update port mapping
        const service = Object.keys(this.ports).find((key) => this.ports[key] === port)
        if (service) {
          this.ports[service] = altPort
        }
      }
    }
  }

  async checkPortAvailable(port) {
    return new Promise((resolve) => {
      const server = net.createServer()
      server.listen(port, "0.0.0.0", () => {
        server.close()
        resolve(true)
      })
      server.on("error", () => {
        resolve(false)
      })
    })
  }

  async setupServices() {
    // Core services
    await this.createSSHHoneypot()
    await this.createHTTPHoneypot()
    await this.createFTPHoneypot()
    await this.createTelnetHoneypot()

    // Database services
    await this.createDatabaseServices()

    // Additional protocol services
    await this.createAdditionalServices()
  }

  async createDatabaseServices() {
    const dbServices = [
      { port: this.ports.mysql, name: "mysql", banner: "5.7.34-0ubuntu0.18.04.1\n\x00\x00\x00\x0a5.7.34\x00" },
      {
        port: this.ports.postgresql,
        name: "postgresql",
        banner: 'FATAL: password authentication failed for user "postgres"\n',
      },
      { port: this.ports.redis, name: "redis", banner: "-NOAUTH Authentication required.\r\n" },
      {
        port: this.ports.mongodb,
        name: "mongodb",
        banner: "MongoDB shell version v4.4.6\nconnecting to: mongodb://127.0.0.1:27017/\n",
      },
    ]

    for (const service of dbServices) {
      await this.createGenericService(service)
    }
  }

  async createAdditionalServices() {
    const additionalServices = [
      { port: this.ports.dns, name: "dns", banner: "" },
      { port: this.ports.snmp, name: "snmp", banner: "SNMPv2-MIB::sysDescr.0 = STRING: Linux\n" },
      { port: this.ports.tftp, name: "tftp", banner: "TFTP server ready\n" },
      { port: this.ports.vnc, name: "vnc", banner: "RFB 003.008\n" },
      {
        port: this.ports.elasticsearch,
        name: "elasticsearch",
        banner: '{"error":{"type":"security_exception","reason":"missing authentication credentials"}}\n',
      },
      { port: this.ports.memcached, name: "memcached", banner: "ERROR\r\n" },
    ]

    for (const service of additionalServices) {
      await this.createGenericService(service)
    }
  }

  async createGenericService(serviceInfo) {
    try {
      const server = net.createServer((socket) => {
        const connectionId = this.generateConnectionId()
        const clientInfo = this.extractClientInfo(socket)

        this.logger.log(`${serviceInfo.name.toUpperCase()} connection from ${clientInfo.ip}:${clientInfo.port}`, "info")
        this.stats.totalConnections++
        this.stats.activeConnections++

        this.connections.set(connectionId, {
          id: connectionId,
          service: serviceInfo.name,
          socket: socket,
          client: clientInfo,
          startTime: new Date(),
          port: serviceInfo.port,
        })

        this.emit("newConnection", this.createTargetInfo(clientInfo, connectionId, serviceInfo.name))

        // Send banner if available
        if (serviceInfo.banner) {
          socket.write(serviceInfo.banner)
        }

        socket.on("data", (data) => {
          this.handleGenericServiceData(connectionId, data, serviceInfo)
        })

        socket.on("close", () => {
          this.handleConnectionClose(connectionId)
        })

        socket.on("error", (error) => {
          this.logger.log(`${serviceInfo.name} connection error: ${error.message}`, "warn")
          this.handleConnectionClose(connectionId)
        })

        // Auto-close after timeout
        setTimeout(() => {
          if (this.connections.has(connectionId)) {
            socket.destroy()
          }
        }, 300000) // 5 minutes
      })

      server.on("error", (error) => {
        if (error.code === "EADDRINUSE") {
          this.logger.log(`${serviceInfo.name} port ${serviceInfo.port} already in use`, "warn")
          return
        }
        this.logger.logError(error, `${serviceInfo.name} server`)
      })

      // Bind to all interfaces for WSL compatibility
      server.listen(serviceInfo.port, "0.0.0.0", () => {
        this.logger.log(`${serviceInfo.name} honeypot listening on port ${serviceInfo.port}`, "success")
      })

      this.services.set(serviceInfo.name, server)
    } catch (error) {
      this.logger.logError(error, `Creating ${serviceInfo.name} service`)
    }
  }

  handleGenericServiceData(connectionId, data, serviceInfo) {
    const connection = this.connections.get(connectionId)
    if (!connection) return

    const input = this.safeString(data.toString().trim())
    this.logger.log(
      `${serviceInfo.name.toUpperCase()} data from ${connection.client.ip}: ${input.substring(0, 100)}...`,
      "info",
    )

    this.emit("dataHarvested", {
      type: `${serviceInfo.name}-data`,
      connectionId: connectionId,
      data: input,
      size: data.length,
      timestamp: new Date(),
      payload: input,
      service: serviceInfo.name,
      port: serviceInfo.port,
    })

    // Service-specific responses
    this.sendServiceResponse(connection.socket, serviceInfo.name, input)
  }

  sendServiceResponse(socket, serviceName, input) {
    try {
      switch (serviceName) {
        case "mysql":
          socket.write("ERROR 1045 (28000): Access denied for user 'root'@'localhost' (using password: YES)\n")
          break
        case "postgresql":
          socket.write('FATAL: password authentication failed for user "postgres"\n')
          break
        case "redis":
          if (input.toLowerCase().includes("auth")) {
            socket.write("-WRONGPASS invalid username-password pair\r\n")
          } else {
            socket.write("-NOAUTH Authentication required.\r\n")
          }
          break
        case "mongodb":
          socket.write('{"ok": 0, "errmsg": "Authentication failed.", "code": 18}\n')
          break
        case "elasticsearch":
          socket.write(
            '{"error":{"type":"security_exception","reason":"missing authentication credentials for REST request"}}\n',
          )
          break
        case "memcached":
          socket.write("ERROR\r\n")
          break
        case "dns":
          // DNS response would be binary, just close
          socket.end()
          break
        case "snmp":
          socket.write("No Such Object available on this agent at this OID\n")
          break
        case "tftp":
          socket.write("File not found\n")
          break
        case "vnc":
          socket.write("Authentication failure\n")
          break
        default:
          socket.write("Access denied\n")
      }
    } catch (error) {
      this.logger.logError(error, `Sending ${serviceName} response`)
    }
  }

  async createSSHHoneypot() {
    try {
      const sshServer = net.createServer((socket) => {
        const connectionId = this.generateConnectionId()
        const clientInfo = this.extractClientInfo(socket)
        this.logger.log(`SSH connection attempt from ${clientInfo.ip}:${clientInfo.port}`, "info")

        this.stats.totalConnections++
        this.stats.activeConnections++

        this.connections.set(connectionId, {
          id: connectionId,
          service: "ssh",
          socket: socket,
          client: clientInfo,
          startTime: new Date(),
          attempts: 0,
          commands: [],
          authenticated: false,
        })

        this.emit("newConnection", this.createTargetInfo(clientInfo, connectionId, "ssh"))

        // Enhanced SSH banner
        socket.write("SSH-2.0-OpenSSH_8.9p1 Ubuntu-3ubuntu0.1\r\n")

        socket.on("data", (data) => {
          this.handleSSHData(connectionId, data)
        })

        socket.on("close", () => {
          this.handleConnectionClose(connectionId)
        })

        socket.on("error", (error) => {
          this.logger.log(`SSH connection error: ${error.message}`, "warn")
          this.handleConnectionClose(connectionId)
        })

        setTimeout(() => {
          if (this.connections.has(connectionId)) {
            socket.destroy()
          }
        }, 300000)
      })

      sshServer.on("error", (error) => {
        if (error.code === "EADDRINUSE") {
          this.logger.log(`SSH port ${this.ports.ssh} already in use, trying alternative port`, "warn")
          this.ports.ssh += 1
          this.createSSHHoneypot()
          return
        }
        this.logger.logError(error, "SSH server")
      })

      sshServer.listen(this.ports.ssh, "0.0.0.0", () => {
        this.logger.log(`SSH honeypot listening on port ${this.ports.ssh}`, "success")
      })

      this.services.set("ssh", sshServer)
    } catch (error) {
      this.logger.logError(error, "Creating SSH honeypot")
    }
  }

  async createHTTPHoneypot() {
    try {
      const httpServer = http.createServer((req, res) => {
        const connectionId = this.generateConnectionId()
        const clientInfo = this.extractHTTPClientInfo(req)
        this.logger.log(`HTTP ${req.method} ${req.url} from ${clientInfo.ip}`, "info")

        this.stats.totalConnections++

        const target = {
          id: connectionId,
          service: "http",
          client: clientInfo,
          startTime: new Date(),
          requests: [
            {
              method: req.method,
              url: req.url,
              headers: req.headers,
              timestamp: new Date(),
            },
          ],
        }

        this.connections.set(connectionId, target)
        this.emit("newConnection", this.createTargetInfo(clientInfo, connectionId, "http"))

        let body = ""
        req.on("data", (chunk) => {
          body += chunk.toString()
        })

        req.on("end", () => {
          if (body) {
            const payload = `HTTP ${req.method} ${req.url}: ${body.substring(0, 200)}`
            this.emit("dataHarvested", {
              type: "http-post-data",
              connectionId: connectionId,
              data: body,
              size: body.length,
              url: req.url,
              method: req.method,
              headers: req.headers,
              timestamp: new Date(),
              payload: payload,
            })
          }

          this.serveHTTPContent(req, res, connectionId)
        })
      })

      httpServer.on("error", (error) => {
        if (error.code === "EADDRINUSE") {
          this.logger.log(`HTTP port ${this.ports.http} already in use, trying alternative port`, "warn")
          this.ports.http += 1
          this.createHTTPHoneypot()
          return
        }
        this.logger.logError(error, "HTTP server")
      })

      httpServer.listen(this.ports.http, "0.0.0.0", () => {
        this.logger.log(`HTTP honeypot listening on port ${this.ports.http}`, "success")
      })

      this.services.set("http", httpServer)
    } catch (error) {
      this.logger.logError(error, "Creating HTTP honeypot")
    }
  }

  async createFTPHoneypot() {
    try {
      const ftpServer = net.createServer((socket) => {
        const connectionId = this.generateConnectionId()
        const clientInfo = this.extractClientInfo(socket)
        this.logger.log(`FTP connection attempt from ${clientInfo.ip}`, "info")
        this.stats.totalConnections++
        this.stats.activeConnections++

        this.connections.set(connectionId, {
          id: connectionId,
          service: "ftp",
          socket: socket,
          client: clientInfo,
          startTime: new Date(),
          authenticated: false,
          commands: [],
          currentPath: "/",
          username: null,
        })

        this.emit("newConnection", this.createTargetInfo(clientInfo, connectionId, "ftp"))

        socket.write("220 Welcome to Ubuntu FTP Server (vsFTPd 3.0.3)\r\n")

        socket.on("data", (data) => {
          this.handleFTPData(connectionId, data)
        })

        socket.on("close", () => {
          this.handleConnectionClose(connectionId)
        })

        socket.on("error", () => {
          this.handleConnectionClose(connectionId)
        })

        setTimeout(() => {
          if (this.connections.has(connectionId)) {
            socket.destroy()
          }
        }, 600000)
      })

      ftpServer.on("error", (error) => {
        if (error.code === "EADDRINUSE") {
          this.logger.log(`FTP port ${this.ports.ftp} already in use, trying alternative port`, "warn")
          this.ports.ftp += 1
          this.createFTPHoneypot()
          return
        }
        this.logger.logError(error, "FTP server")
      })

      ftpServer.listen(this.ports.ftp, "0.0.0.0", () => {
        this.logger.log(`FTP honeypot listening on port ${this.ports.ftp}`, "success")
      })

      this.services.set("ftp", ftpServer)
    } catch (error) {
      this.logger.logError(error, "Creating FTP honeypot")
    }
  }

  async createTelnetHoneypot() {
    try {
      const telnetServer = net.createServer((socket) => {
        const connectionId = this.generateConnectionId()
        const clientInfo = this.extractClientInfo(socket)
        this.logger.log(`Telnet connection attempt from ${clientInfo.ip}`, "info")
        this.stats.totalConnections++
        this.stats.activeConnections++

        this.connections.set(connectionId, {
          id: connectionId,
          service: "telnet",
          socket: socket,
          client: clientInfo,
          startTime: new Date(),
          authenticated: false,
          commands: [],
          state: "login",
          username: null,
        })

        this.emit("newConnection", this.createTargetInfo(clientInfo, connectionId, "telnet"))

        socket.write("Ubuntu 22.04.3 LTS\r\n")
        socket.write(`${clientInfo.ip} login: `)

        socket.on("data", (data) => {
          this.handleTelnetData(connectionId, data)
        })

        socket.on("close", () => {
          this.handleConnectionClose(connectionId)
        })

        socket.on("error", () => {
          this.handleConnectionClose(connectionId)
        })

        setTimeout(() => {
          if (this.connections.has(connectionId)) {
            socket.destroy()
          }
        }, 600000)
      })

      telnetServer.on("error", (error) => {
        if (error.code === "EADDRINUSE") {
          this.logger.log(`Telnet port ${this.ports.telnet} already in use, trying alternative port`, "warn")
          this.ports.telnet += 1
          this.createTelnetHoneypot()
          return
        }
        this.logger.logError(error, "Telnet server")
      })

      telnetServer.listen(this.ports.telnet, "0.0.0.0", () => {
        this.logger.log(`Telnet honeypot listening on port ${this.ports.telnet}`, "success")
      })

      this.services.set("telnet", telnetServer)
    } catch (error) {
      this.logger.logError(error, "Creating Telnet honeypot")
    }
  }

  extractClientInfo(socket) {
    const ip = socket.remoteAddress?.replace(/^::ffff:/, "") || "unknown"
    const port = socket.remotePort || 0

    let geo = null
    try {
      if (ip !== "unknown" && ip !== "127.0.0.1" && !ip.startsWith("192.168.") && !ip.startsWith("10.")) {
        geo = geoip.lookup(ip)
      }
    } catch (e) {
      this.logger.logError(e, "GeoIP lookup")
    }

    return {
      ip: ip,
      port: port,
      location: geo ? `${geo.city || "Unknown"}, ${geo.country || "Unknown"}` : "Local/Unknown",
      coordinates: geo ? { lat: geo.ll[0], lon: geo.ll[1] } : null,
      timestamp: new Date(),
      userAgent: null,
      device: this.detectDevice(socket),
    }
  }

  extractHTTPClientInfo(req) {
    const ip = req.socket.remoteAddress?.replace(/^::ffff:/, "") || req.headers["x-forwarded-for"] || "unknown"
    const port = req.socket.remotePort || 0

    let geo = null
    try {
      if (ip !== "unknown" && ip !== "127.0.0.1" && !ip.startsWith("192.168.") && !ip.startsWith("10.")) {
        geo = geoip.lookup(ip)
      }
    } catch (e) {
      this.logger.logError(e, "GeoIP lookup")
    }

    return {
      ip: ip,
      port: port,
      location: geo ? `${geo.city || "Unknown"}, ${geo.country || "Unknown"}` : "Local/Unknown",
      coordinates: geo ? { lat: geo.ll[0], lon: geo.ll[1] } : null,
      userAgent: req.headers["user-agent"] || "Unknown",
      device: this.detectDeviceFromUserAgent(req.headers["user-agent"]),
      timestamp: new Date(),
    }
  }

  createTargetInfo(clientInfo, connectionId, service) {
    return {
      id: connectionId,
      ip: clientInfo.ip,
      port: clientInfo.port,
      service: service,
      location: clientInfo.location,
      coordinates: clientInfo.coordinates,
      timestamp: clientInfo.timestamp,
      lastActivity: new Date(),
      attacks: 0,
      userAgent: clientInfo.userAgent,
      device: clientInfo.device,
    }
  }

  detectDevice(socket) {
    return "Unknown Device"
  }

  detectDeviceFromUserAgent(userAgent) {
    if (!userAgent) return "Unknown"
    const ua = userAgent.toLowerCase()
    if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
      return "Mobile Device"
    } else if (ua.includes("tablet") || ua.includes("ipad")) {
      return "Tablet"
    } else if (ua.includes("windows")) {
      return "Windows PC"
    } else if (ua.includes("macintosh") || ua.includes("mac os")) {
      return "Mac"
    } else if (ua.includes("linux")) {
      return "Linux"
    } else if (ua.includes("bot") || ua.includes("crawler") || ua.includes("spider")) {
      return "Bot/Crawler"
    } else {
      return "Desktop Computer"
    }
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

  handleSSHData(connectionId, data) {
    const connection = this.connections.get(connectionId)
    if (!connection) return
    const input = this.safeString(data.toString().trim())
    connection.commands.push({ command: input, timestamp: new Date() })
    this.logger.log(`SSH data from ${connection.client.ip}: ${input.substring(0, 100)}...`, "info")
    this.emit("dataHarvested", {
      type: "ssh-command",
      connectionId: connectionId,
      data: input,
      size: data.length,
      timestamp: new Date(),
      payload: input,
    })

    if (input.includes("password") || input.includes("login")) {
      connection.attempts = (connection.attempts || 0) + 1
      connection.socket.write("Permission denied (publickey,password).\r\n")
      if (connection.attempts > 3) {
        connection.socket.write("Too many authentication failures\r\n")
        connection.socket.destroy()
      }
    } else if (input.startsWith("SSH-")) {
      connection.socket.write("SSH-2.0-OpenSSH_8.9p1 Ubuntu-3ubuntu0.1\r\n")
    } else {
      connection.socket.write("$ ")
    }
  }

  handleFTPData(connectionId, data) {
    const connection = this.connections.get(connectionId)
    if (!connection) return
    const command = this.safeString(data.toString().trim()).toUpperCase()
    const parts = command.split(" ")
    const cmd = parts[0]
    const arg = parts.slice(1).join(" ")
    connection.commands.push({ command: command, timestamp: new Date() })
    this.logger.log(`FTP command from ${connection.client.ip}: ${command}`, "info")
    this.emit("dataHarvested", {
      type: "ftp-command",
      connectionId: connectionId,
      data: command,
      size: data.length,
      timestamp: new Date(),
      payload: command,
    })

    switch (cmd) {
      case "USER":
        connection.username = arg
        connection.socket.write("331 Username ok, need password.\r\n")
        break
      case "PASS":
        connection.socket.write("530 Login incorrect.\r\n")
        break
      case "SYST":
        connection.socket.write("215 UNIX Type: L8\r\n")
        break
      case "PWD":
        connection.socket.write(`257 "${connection.currentPath}" is current directory.\r\n`)
        break
      case "LIST":
        connection.socket.write("150 Here comes the directory listing.\r\n")
        connection.socket.write("drwxr-xr-x    2 ftp      ftp          4096 Jan 01 12:00 documents\r\n")
        connection.socket.write("drwxr-xr-x    2 ftp      ftp          4096 Jan 01 12:00 downloads\r\n")
        connection.socket.write("-rw-r--r--    1 ftp      ftp           123 Jan 01 12:00 readme.txt\r\n")
        connection.socket.write("226 Directory send OK.\r\n")
        break
      case "CWD":
        connection.currentPath = arg || "/"
        connection.socket.write("250 Directory successfully changed.\r\n")
        break
      case "RETR":
        connection.socket.write("550 File not found.\r\n")
        break
      case "QUIT":
        connection.socket.write("221 Goodbye.\r\n")
        connection.socket.destroy()
        break
      default:
        connection.socket.write("500 Unknown command.\r\n")
    }
  }

  handleTelnetData(connectionId, data) {
    const connection = this.connections.get(connectionId)
    if (!connection) return
    const input = this.safeString(data.toString().replace(/\r\n|\r|\n/g, "")).trim()
    this.logger.log(`Telnet input from ${connection.client.ip}: ${input}`, "info")
    this.emit("dataHarvested", {
      type: "telnet-input",
      connectionId: connectionId,
      data: input,
      size: data.length,
      timestamp: new Date(),
      payload: input,
    })

    switch (connection.state) {
      case "login":
        connection.username = input
        connection.state = "password"
        connection.socket.write("Password: ")
        break
      case "password":
        connection.socket.write("\r\nLogin incorrect\r\n")
        connection.socket.write(`${connection.client.ip} login: `)
        connection.state = "login"
        connection.username = null
        break
      default:
        connection.socket.write("$ ")
    }
  }

  serveHTTPContent(req, res, connectionId) {
    const connection = this.connections.get(connectionId)
    const reqData = {
      method: req.method,
      url: req.url,
      headers: req.headers,
      timestamp: new Date(),
    }

    const payload = `HTTP ${req.method} ${req.url} ${this.safeString(JSON.stringify(req.headers))}`
    this.emit("dataHarvested", {
      type: "http-request",
      connectionId: connectionId,
      data: reqData,
      size: payload.length,
      timestamp: new Date(),
      payload: payload,
    })

    let content = ""
    let contentType = "text/html"
    let statusCode = 200

    if (req.url.includes("admin") || req.url.includes("login")) {
      content = this.generateFakeLoginPage()
    } else if (req.url.includes("api")) {
      content = JSON.stringify({ error: "Unauthorized", code: 401 })
      contentType = "application/json"
      statusCode = 401
    } else if (req.url.includes("robots.txt")) {
      content = this.generateRobotsTxt()
      contentType = "text/plain"
    } else if (req.url.includes(".php")) {
      content = this.generatePHPError()
    } else {
      content = this.generateFakeWebsite()
    }

    const contentLength = Buffer.byteLength(content, "utf8")

    res.writeHead(statusCode, {
      "Content-Type": `${contentType}; charset=utf-8`,
      Server: "Apache/2.4.52 (Ubuntu)",
      "X-Powered-By": "PHP/8.1.2",
      Date: new Date().toUTCString(),
      "Content-Length": contentLength,
    })

    res.end(content)
  }

  generateFakeLoginPage() {
    return `<!DOCTYPE html>
<html>
<head>
    <title>Admin Portal - Login</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body {
            font-family: 'Courier New', monospace;
            background: linear-gradient(135deg, #1a0000 0%, #330000 100%);
            margin: 0; padding: 0; height: 100vh;
            display: flex; align-items: center; justify-content: center;
            color: #ff0000;
        }
        .login-container {
            background: #000; border: 2px solid #ff0000; padding: 40px;
            box-shadow: 0 0 20px #ff0000;
            width: 100%; max-width: 400px;
        }
        .logo { text-align: center; margin-bottom: 30px; }
        .logo h1 { color: #ff0000; margin: 0; font-size: 28px; }
        label {
            display: block; margin-bottom: 5px; color: #ff0000; font-weight: bold;
        }
        input[type="text"], input[type="password"] {
            width: 100%; padding: 12px; border: 2px solid #ff0000;
            background: #000; color: #ff0000; font-size: 16px;
            font-family: 'Courier New', monospace;
        }
        input:focus { outline: none; box-shadow: 0 0 10px #ff0000; }
        .login-btn {
            width: 100%; padding: 12px; background: #ff0000;
            color: #000; border: none;
            font-size: 16px; cursor: pointer;
            font-family: 'Courier New', monospace;
        }
        .login-btn:hover { background: #cc0000; }
        .forgot-link { text-align: center; margin-top: 20px; }
        .forgot-link a { color: #ff0000; text-decoration: none; }
    </style>
</head>
<body>
    <div class="login-container">
        <div class="logo"><h1>ADMIN PORTAL</h1></div>
        <form action="/admin/login" method="post">
            <div class="form-group">
                <label for="username">Username</label>
                <input type="text" id="username" name="username" required>
            </div>
            <div class="form-group">
                <label for="password">Password</label>
                <input type="password" id="password" name="password" required>
            </div>
            <button type="submit" class="login-btn">SIGN IN</button>
        </form>
        <div class="forgot-link"><a href="/forgot-password">Forgot your password?</a></div>
    </div>
</body>
</html>`
  }

  generateFakeWebsite() {
    return `<!DOCTYPE html>
<html>
<head>
    <title>Corporate Systems - Secure Access</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Courier New', monospace;
            background: #000;
            color: #00ff00;
        }
        .header {
            background: #1a0000; color: #ff0000;
            padding: 1rem 0;
            border-bottom: 2px solid #ff0000;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }
        .nav {
            display: flex; justify-content: space-between; align-items: center;
        }
        .logo { font-size: 24px; font-weight: bold; }
        .nav-links {
            display: flex; list-style: none; gap: 2rem;
        }
        .nav-links a {
            color: #ff0000;
            text-decoration: none;
        }
        .hero {
            background: linear-gradient(135deg, #001100, #003300);
            color: #00ff00;
            padding: 80px 0;
            text-align: center;
        }
        .hero h1 {
            font-size: 48px;
            margin-bottom: 20px;
        }
        .hero p {
            font-size: 20px;
            margin-bottom: 30px;
        }
        .btn {
            display: inline-block; background: #ff0000;
            color: #000; border: none;
            padding: 12px 30px;
            text-decoration: none;
        }
        .btn:hover { background: #cc0000; }
        .services {
            padding: 80px 0;
            background: #000;
        }
        .services h2 {
            text-align: center;
            margin-bottom: 50px;
            font-size: 36px;
            color: #ff0000;
        }
        .service-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 40px;
        }
        .service-card {
            background: #1a1a1a;
            padding: 30px;
            border: 1px solid #ff0000;
        }
        .footer {
            background: #1a0000;
            color: #ff0000;
            padding: 40px 0;
            text-align: center;
        }
    </style>
</head>
<body>
    <header class="header">
        <div class="container">
            <nav class="nav">
                <div class="logo">CORP SYSTEMS</div>
                <ul class="nav-links">
                    <li><a href="/">Home</a></li>
                    <li><a href="/services">Services</a></li>
                    <li><a href="/about">About</a></li>
                    <li><a href="/contact">Contact</a></li>
                    <li><a href="/admin">Admin</a></li>
                </ul>
            </nav>
        </div>
    </header>
    <section class="hero">
        <div class="container">
            <h1>SECURE CORPORATE SYSTEMS</h1>
            <p>All connections are monitored</p>
            <a href="/services" class="btn">ACCESS SERVICES</a>
        </div>
    </section>
    <section class="services">
        <div class="container">
            <h2>SYSTEM SERVICES</h2>
            <div class="service-grid">
                <div class="service-card">
                    <h3>SECURITY SYSTEMS</h3>
                    <p>Advanced security monitoring and threat detection systems.</p>
                </div>
                <div class="service-card">
                    <h3>DATA SYSTEMS</h3>
                    <p>Secure data storage and processing infrastructure.</p>
                </div>
                <div class="service-card">
                    <h3>NETWORK SYSTEMS</h3>
                    <p>Enterprise network infrastructure and communications.</p>
                </div>
            </div>
        </div>
    </section>
    <footer class="footer">
        <div class="container">
            <p>&copy; 2024 Corporate Systems. All rights reserved.</p>
            <p>security@corpsystems.com | +1 (550) 123-4567</p>
        </div>
    </footer>
</body>
</html>`
  }

  generateRobotsTxt() {
    return `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /private/
Disallow: /backup/
Disallow: /config/
Disallow: /.env
Disallow: /database/
Sitemap: /sitemap.xml`
  }

  generatePHPError() {
    return `<!DOCTYPE html>
<html>
<head>
    <title>System Error</title>
    <style>
        body {
            font-family: 'Courier New', monospace;
            background: #000;
            color: #ff0000;
        }
    </style>
</head>
<body>
    <h1>Fatal System Error</h1>
    <p><b>Fatal error</b>: Uncaught Error: Call to undefined function mysql_connect() in <b>/var/www/html/config.php:12</b><br>
    Stack trace:<br>
    #0 /var/www/html/index.php(5): include()<br>
    #1 {main}<br>
    thrown in <b>/var/www/html/config.php</b> on line <b>12</b></p>
</body>
</html>`
  }

  handleConnectionClose(connectionId) {
    const connection = this.connections.get(connectionId)
    if (connection) {
      this.logger.log(`Connection closed: ${connection.client.ip} (${connection.service})`, "info")
      this.stats.activeConnections = Math.max(0, this.stats.activeConnections - 1)
      this.connections.delete(connectionId)
    }
  }

  generateConnectionId() {
    return crypto.randomBytes(8).toString("hex")
  }

  async start() {
    this.isActive = true
    this.logger.log("TrapDaemon core started", "success")

    setInterval(() => {
      this.cleanupStaleConnections()
    }, 60000)
  }

  async stop() {
    this.isActive = false

    for (const [name, service] of this.services) {
      if (service && typeof service.close === "function") {
        service.close()
        this.logger.log(`${name} service stopped`, "info")
      }
    }

    for (const connection of this.connections.values()) {
      if (connection.socket && typeof connection.socket.destroy === "function") {
        connection.socket.destroy()
      }
    }

    this.connections.clear()
    this.logger.log("TrapDaemon core stopped", "info")
  }

  cleanupStaleConnections() {
    const now = Date.now()
    const staleConnections = []

    for (const [id, connection] of this.connections) {
      const age = now - connection.startTime.getTime()
      if (age > 1800000) {
        staleConnections.push(id)
      }
    }

    staleConnections.forEach((id) => {
      const connection = this.connections.get(id)
      if (connection && connection.socket && connection.socket.destroy) {
        connection.socket.destroy()
      }
      this.connections.delete(id)
    })

    if (staleConnections.length > 0) {
      this.logger.log(`Cleaned up ${staleConnections.length} stale connections`, "info")
    }
  }

  getStats() {
    return {
      ...this.stats,
      activeConnections: this.connections.size,
      services: Array.from(this.services.keys()),
      isActive: this.isActive,
      ports: this.ports,
    }
  }

  getActiveConnections() {
    return Array.from(this.connections.values()).map((conn) => ({
      id: conn.id,
      service: conn.service,
      ip: conn.client.ip,
      startTime: conn.startTime,
      commands: conn.commands?.length || 0,
    }))
  }

  getServicePorts() {
    return this.ports
  }
}
