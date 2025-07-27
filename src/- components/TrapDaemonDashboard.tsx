"use client"

import type React from "react"

interface SystemStats {
  totalConnections: number
  activeTargets: number
  attacksDetected: number
  dataHarvested: number
  uptime: string
  isRunning: boolean
  services: {
    core: boolean
    detection: boolean
  }
  system: {
    platform: string
    arch: string
    nodeVersion: string
    memory: number
    cpus: number
  }
  capabilities: {
    isRoot: boolean
  }
}

interface Target {
  id: string
  ip: string
  service: string
  location: string
  device: string
  timestamp: string
  lastActivity: string
  attacks: number
}

interface Attack {
  id: string
  type: string
  description: string
  severity: string
  source: string
  target: string
  timestamp: string
}

interface LogEntry {
  timestamp: string
  message: string
  type: string
}

interface Props {
  stats: SystemStats | null
  targets: Target[]
  attacks: Attack[]
  logs: LogEntry[]
  onStartHoneypot: () => void
  onStopHoneypot: () => void
  onClearLogs: () => void
  onExportData: () => void
  onGetSystemInfo: () => void
}

export const TrapDaemonDashboard: React.FC<Props> = ({
  stats,
  targets,
  attacks,
  logs,
  onStartHoneypot,
  onStopHoneypot,
  onClearLogs,
  onExportData,
  onGetSystemInfo,
}) => {
  return (
    <div className="flex flex-col min-h-screen bg-black text-green-500 font-mono overflow-hidden">
      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Stats */}
        <div className="bg-[#111] border border-red-600 p-4">
          <h2 className="text-red-500 font-bold mb-2">System Stats</h2>
          {stats ? (
            <ul className="space-y-1 text-sm">
              <li>Total Connections: {stats.totalConnections}</li>
              <li>Active Targets: {stats.activeTargets}</li>
              <li>Attacks Detected: {stats.attacksDetected}</li>
              <li>Data Harvested: {stats.dataHarvested}</li>
              <li>Uptime: {stats.uptime}</li>
              <li>Status: {stats.isRunning ? "Running" : "Stopped"}</li>
            </ul>
          ) : (
            <p className="text-yellow-500">No stats available.</p>
          )}
        </div>

        {/* Controls */}
        <div className="bg-[#111] border border-red-600 p-4 flex flex-col space-y-2">
          <h2 className="text-red-500 font-bold mb-2">Controls</h2>
          <button onClick={onStartHoneypot} className="btn-hacker">
            Start Honeypot
          </button>
          <button onClick={onStopHoneypot} className="btn-hacker">
            Stop Honeypot
          </button>
          <button onClick={onClearLogs} className="btn-hacker">
            Clear Logs
          </button>
          <button onClick={onExportData} className="btn-hacker">
            Export Data
          </button>
          <button onClick={onGetSystemInfo} className="btn-hacker">
            System Info
          </button>
        </div>

        {/* System Info */}
        <div className="bg-[#111] border border-red-600 p-4">
          <h2 className="text-red-500 font-bold mb-2">System Details</h2>
          {stats ? (
            <ul className="space-y-1 text-sm">
              <li>Platform: {stats.system.platform}</li>
              <li>Arch: {stats.system.arch}</li>
              <li>Node: {stats.system.nodeVersion}</li>
              <li>Memory: {stats.system.memory} MB</li>
              <li>CPUs: {stats.system.cpus}</li>
              <li>Root: {stats.capabilities.isRoot ? "Yes" : "No"}</li>
            </ul>
          ) : (
            <p className="text-yellow-500">No system info.</p>
          )}
        </div>

        {/* Targets */}
        <div className="md:col-span-2 bg-[#111] border border-red-600 p-4 overflow-x-auto">
          <h2 className="text-red-500 font-bold mb-2">Targets</h2>
          <table className="w-full text-xs hacker-table">
            <thead>
              <tr>
                <th>IP</th>
                <th>Service</th>
                <th>Location</th>
                <th>Device</th>
                <th>Attacks</th>
              </tr>
            </thead>
            <tbody>
              {targets.map((target) => (
                <tr key={target.id}>
                  <td>{target.ip}</td>
                  <td>{target.service}</td>
                  <td>{target.location}</td>
                  <td>{target.device}</td>
                  <td>{target.attacks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Attacks */}
        <div className="bg-[#111] border border-red-600 p-4 overflow-x-auto">
          <h2 className="text-red-500 font-bold mb-2">Attacks</h2>
          <table className="w-full text-xs hacker-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Source</th>
                <th>Target</th>
                <th>Severity</th>
              </tr>
            </thead>
            <tbody>
              {attacks.map((attack) => (
                <tr key={attack.id}>
                  <td>{attack.type}</td>
                  <td>{attack.source}</td>
                  <td>{attack.target}</td>
                  <td className={`severity-${attack.severity.toLowerCase()}`}>{attack.severity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Logs (Fixed Terminal Panel) */}
      <div className="fixed bottom-0 left-0 w-full bg-black border-t border-red-600 h-48 overflow-y-auto terminal shadow-lg">
        <div className="terminal-header">TrapDaemon Logs</div>
        <div className="terminal-content">
          {logs.length > 0 ? (
            logs.slice(-100).map((log, index) => (
              <div key={index}>
                <span className="text-green-500">[{log.timestamp}]</span> {log.message}
              </div>
            ))
          ) : (
            <div className="text-red-500">No logs available.</div>
          )}
        </div>
      </div>
    </div>
  )
}
