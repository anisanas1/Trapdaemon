"use client"

import { useEffect, useState } from "react"
import { io, type Socket } from "socket.io-client"

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

interface LogEntry {
  timestamp: string
  message: string
  type: string
}

export default function Home() {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const [stats, setStats] = useState<SystemStats | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [connectionError, setConnectionError] = useState<string | null>(null)

  useEffect(() => {
    const newSocket = io("http://localhost:3001")

    newSocket.on("connect", () => {
      setConnected(true)
      setConnectionError(null)
    })

    newSocket.on("disconnect", () => {
      setConnected(false)
    })

    newSocket.on("connect_error", () => {
      setConnectionError("Failed to connect to backend.")
    })

    newSocket.on("initialData", (data) => {
      if (data.stats) setStats(data.stats)
      if (data.logs) setLogs(data.logs)
    })

    newSocket.on("dataUpdate", (data) => {
      if (data.stats) setStats(data.stats)
      if (data.logs) setLogs(data.logs)
    })

    setSocket(newSocket)

    return () => {
      newSocket.disconnect()
    }
  }, [])

  const emit = (event: string) => {
    if (socket && connected) socket.emit(event)
  }

  return (
    <div className="dashboard-container">
      {!connected ? (
        <div className="text-center text-red-500">{connectionError || "Connecting to TrapDaemon..."}</div>
      ) : (
        <>
          <div className="dashboard-grid">
            <div className="section">
              <div className="section-title">Stats</div>
              <div>
                <span className="label">Connections:</span> {stats?.totalConnections ?? "-"}
              </div>
              <div>
                <span className="label">Targets:</span> {stats?.activeTargets ?? "-"}
              </div>
              <div>
                <span className="label">Attacks:</span> {stats?.attacksDetected ?? "-"}
              </div>
              <div>
                <span className="label">Data:</span> {stats?.dataHarvested ?? "-"}
              </div>
              <div>
                <span className="label">Uptime:</span> {stats?.uptime ?? "-"}
              </div>
            </div>
            <div className="section">
              <div className="section-title">System</div>
              <div>
                <span className="label">Platform:</span> {stats?.system.platform ?? "-"}
              </div>
              <div>
                <span className="label">Arch:</span> {stats?.system.arch ?? "-"}
              </div>
              <div>
                <span className="label">Node:</span> {stats?.system.nodeVersion ?? "-"}
              </div>
              <div>
                <span className="label">Memory:</span> {stats?.system.memory ?? "-"} MB
              </div>
              <div>
                <span className="label">CPUs:</span> {stats?.system.cpus ?? "-"}
              </div>
            </div>
            <div className="section">
              <div className="section-title">Services</div>
              <div>
                <span className="label">Core:</span>{" "}
                <span className={stats?.services.core ? "status-ok" : "status-bad"}>
                  {stats?.services.core ? "ON" : "OFF"}
                </span>
              </div>
              <div>
                <span className="label">Detection:</span>{" "}
                <span className={stats?.services.detection ? "status-ok" : "status-bad"}>
                  {stats?.services.detection ? "ON" : "OFF"}
                </span>
              </div>
            </div>
          </div>

          <div className="button-bar">
            <button className="btn-hacker" onClick={() => emit("startHoneypot")}>
              Start
            </button>
            <button className="btn-hacker" onClick={() => emit("stopHoneypot")}>
              Stop
            </button>
            <button className="btn-hacker" onClick={() => emit("clearLogs")}>
              Clear Logs
            </button>
            <button className="btn-hacker" onClick={() => emit("exportData")}>
              Export
            </button>
            <button className="btn-hacker" onClick={() => emit("getSystemInfo")}>
              Sys Info
            </button>
          </div>

          <div className="terminal-logs">
            {logs.length > 0 ? (
              logs.slice(-100).map((log, i) => (
                <div key={i}>
                  [{log.timestamp}] {log.message}
                </div>
              ))
            ) : (
              <div>[~] No logs yet.</div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
