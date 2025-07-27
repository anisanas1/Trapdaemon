#!/usr/bin/env node

import chalk from "chalk"
import { HoneypotCore } from "./server/core/honeypot-core.js" // Updated path
import { AttackDetector } from "./server/detection/attack-detector.js" // Updated path
import { NetworkManager } from "./server/network/network-manager.js" // Updated path
import { Logger } from "./server/utils/logger.js" // Updated path

class HoneypotTest {
  constructor() {
    this.logger = new Logger()
    this.core = new HoneypotCore()
    this.attackDetector = new AttackDetector()
    this.networkManager = new NetworkManager()
    this.testResults = []
  }

  async run() {
    console.log(chalk.cyan.bold("ADVANCED HONEYPOT TEST SUITE\n"))

    try {
      await this.testLogger()
      await this.testHoneypotCore()
      await this.testAttackDetector()
      await this.testNetworkManager()

      this.showResults()
    } catch (error) {
      console.log(chalk.red(`Test suite failed: ${error.message}`))
      process.exit(1)
    }
  }

  async testLogger() {
    console.log(chalk.yellow("Testing Logger..."))

    try {
      this.logger.log("Test log message", "info")
      this.logger.logError(new Error("Test error"), "test context")

      const stats = this.logger.getLogStats()

      this.addResult("Logger", true, "Logging functionality works")
      console.log(chalk.green("Logger test passed"))
    } catch (error) {
      this.addResult("Logger", false, error.message)
      console.log(chalk.red("Logger test failed"))
    }
  }

  async testHoneypotCore() {
    console.log(chalk.yellow("Testing Honeypot Core..."))

    try {
      await this.core.initialize()

      // Test service setup
      const ports = this.core.getServicePorts()
      if (Object.keys(ports).length > 0) {
        this.addResult("Honeypot Core", true, `${Object.keys(ports).length} services configured`)
        console.log(chalk.green("Honeypot core test passed"))
        console.log(chalk.blue(`Services: ${Object.keys(ports).join(", ")}`))
      } else {
        this.addResult("Honeypot Core", false, "No services configured")
        console.log(chalk.red("Honeypot core test failed"))
      }

      // Test stats
      const stats = this.core.getStats()
      console.log(chalk.blue(`Core stats: ${JSON.stringify(stats)}`))
    } catch (error) {
      this.addResult("Honeypot Core", false, error.message)
      console.log(chalk.red(`Honeypot core test failed: ${error.message}`))
    }
  }

  async testAttackDetector() {
    console.log(chalk.yellow("Testing Attack Detector..."))

    try {
      await this.attackDetector.initialize()

      // Test detection rules
      const stats = this.attackDetector.getDetectionStats()

      if (stats.detectionRules > 0) {
        this.addResult("Attack Detector", true, `${stats.detectionRules} detection rules loaded`)
        console.log(chalk.green("Attack detector test passed"))
        console.log(chalk.blue(`Detection rules: ${stats.detectionRules}`))
        console.log(chalk.blue(`Threat signatures: ${stats.threatSignatures}`))
      } else {
        this.addResult("Attack Detector", false, "No detection rules loaded")
        console.log(chalk.red("Attack detector test failed"))
      }

      // Test traffic analysis
      this.attackDetector.processTrafficData({
        src_ip: "192.168.1.100",
        dst_ip: "192.168.1.1",
        payload: "SELECT * FROM users WHERE id=1 OR 1=1",
        timestamp: Date.now(),
      })

      console.log(chalk.blue("Test traffic data processed"))
    } catch (error) {
      this.addResult("Attack Detector", false, error.message)
      console.log(chalk.red(`Attack detector test failed: ${error.message}`))
    }
  }

  async testNetworkManager() {
    console.log(chalk.yellow("Testing Network Manager..."))

    try {
      await this.networkManager.initialize()

      const stats = this.networkManager.getNetworkStats()

      this.addResult("Network Manager", true, `Platform: ${stats.platform}`)
      console.log(chalk.green("Network manager test passed"))
      console.log(chalk.blue(`Platform: ${stats.platform}`))
      console.log(chalk.blue(`Interface: ${stats.interface}`))
    } catch (error) {
      this.addResult("Network Manager", false, error.message)
      console.log(chalk.red(`Network manager test failed: ${error.message}`))
    }
  }

  addResult(component, success, message) {
    this.testResults.push({
      component,
      success,
      message,
      timestamp: new Date(),
    })
  }

  showResults() {
    console.log(chalk.cyan.bold("\nTEST RESULTS SUMMARY"))
    console.log(chalk.gray("━".repeat(50)))

    const passed = this.testResults.filter((r) => r.success).length
    const total = this.testResults.length

    for (const result of this.testResults) {
      const color = result.success ? chalk.green : chalk.red
      console.log(color(`${result.component}: ${result.message}`))
    }

    console.log(chalk.gray("━".repeat(50)))

    if (passed === total) {
      console.log(chalk.green.bold("All tests passed! (" + passed + "/" + total + ")"))
      console.log(chalk.green("\nYour honeypot system is ready to use!"))
      console.log(chalk.cyan("\nQuick start commands:"))
      console.log(chalk.white("  npm run honeypot     # Start basic honeypot"))
      console.log(chalk.white("  sudo npm run honeypot # Start with WiFi features"))
      console.log(chalk.white("  node server/honeypot.js # Direct start"))
    } else {
      console.log(chalk.yellow.bold("Some tests failed (" + passed + "/" + total + ")"))
      console.log(chalk.yellow("\nThe honeypot may still work with limited functionality."))
    }

    console.log(chalk.cyan("\nFor a full interactive experience, run:"))
    console.log(chalk.white("  npm run dev"))
    console.log(chalk.gray("\nNote: Interactive dashboard requires a proper terminal environment."))
  }
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const test = new HoneypotTest()
  test.run().catch((error) => {
    console.error(chalk.red(`Test failed: ${error.message}`))
    process.exit(1)
  })
}
