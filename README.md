# TrapDaemon - Advanced Multi-Protocol Honeypot

A comprehensive honeypot system with a modern Next.js dashboard designed for educational purposes, security research, and authorized penetration testing. TrapDaemon simulates various network services to attract and log malicious activities, providing insights into attack patterns and threat intelligence.

## Architecture

This project consists of two main components:
- **Next.js Frontend Dashboard** (`src/`) - Modern React-based web interface
- **Node.js Honeypot Server** (`server/`) - The actual honeypot services and detection engine

## Features

-   **Multi-Protocol Support**: Simulates SSH, HTTP, FTP, Telnet, and fake database services (MySQL, PostgreSQL, Redis, MongoDB, MSSQL).
-   **Real-time Attack Detection**: Advanced pattern matching and behavioral analysis for common attack types.
-   **Modern Web Dashboard**: React-based real-time monitoring and control interface.
-   **Comprehensive Logging**: Detailed logs with rotation and export capabilities for forensic analysis.
-   **Network Monitoring**: Traffic analysis and connection tracking (requires root privileges and specific tools).
-   **Geolocation**: IP-based location tracking for attackers.
-   **Telegram Alerts**: Real-time notifications for detected attacks via a Telegram bot.

## Getting Started

You can deploy TrapDaemon either by running it directly on your system or by using Docker for a containerized environment. Docker is highly recommended for ease of setup and isolation.

### Prerequisites

*   **Node.js**: Version 18 or higher (for local installation).
*   **npm**: Node Package Manager.
*   **Docker**: For containerized deployment.
*   **Linux/Unix system**: Recommended for full functionality, especially for network monitoring features that require root privileges.

## Deployment Options

### 1. Docker Deployment (Recommended)

Docker provides a clean, isolated environment for running TrapDaemon, simplifying dependency management and deployment.

#### Build the Docker Image

Navigate to the root directory of your TrapDaemon project (where `Dockerfile` is located) and run:

```bash
docker build -t trapdaemon .
```

This command builds a Docker image named `trapdaemon`. The process might take a few minutes as it installs Node.js dependencies and system tools.

#### Run the Docker Container

To run the honeypot, you need to map the exposed ports from the container to your host machine. You also need to provide your Telegram Bot Token and Chat ID as environment variables if you wish to receive alerts.

**Important:** For network monitoring features (like `tcpdump`, `iptables`, and WiFi honeypot capabilities), the Docker container needs to run with elevated privileges.

```bash
docker run -d \
  --name trapdaemon-honeypot \
  --cap-add=NET_ADMIN \
  --cap-add=NET_RAW \
  --network=host \
  -e TELEGRAM_BOT_TOKEN="YOUR_TELEGRAM_BOT_TOKEN" \
  -e TELEGRAM_CHAT_ID="YOUR_TELEGRAM_CHAT_ID" \
  trapdaemon
```

**Explanation of `docker run` options:**

*   `-d`: Runs the container in detached mode (in the background).
*   `--name trapdaemon-honeypot`: Assigns a name to your container for easy reference.
*   `--cap-add=NET_ADMIN --cap-add=NET_RAW`: Grants the container network administration and raw network access capabilities, essential for tools like `tcpdump` and `iptables`.
*   `--network=host`: Makes the container share the host's network namespace. This is crucial for the honeypot to bind to ports directly on the host and for network monitoring to function correctly. **Be aware that this mode reduces network isolation.**
*   `-e TELEGRAM_BOT_TOKEN="YOUR_TELEGRAM_BOT_TOKEN"`: Sets the Telegram Bot Token environment variable. **Replace `YOUR_TELEGRAM_BOT_TOKEN` with your actual bot token.**
*   `-e TELEGRAM_CHAT_ID="YOUR_TELEGRAM_CHAT_ID"`: Sets the Telegram Chat ID environment variable. **Replace `YOUR_TELEGRAM_CHAT_ID` with your actual chat ID.**
*   `trapdaemon`: The name of the Docker image to run.

#### Accessing the Application

Once the container is running:
- **Web Dashboard**: Access the main dashboard at `http://localhost:3000`
- **Honeypot Control Panel**: Real-time honeypot monitoring at `http://localhost:3001`

#### Stopping and Removing the Container

To stop the running container:

```bash
docker stop trapdaemon-honeypot
```

To remove the container (after stopping it):

```bash
docker rm trapdaemon-honeypot
```

### 2. Local Installation

If you prefer to run TrapDaemon directly on your system without Docker.

#### 1. Install Node.js Dependencies

Navigate to the root directory of your TrapDaemon project and run:

```bash
npm install
```

#### 2. Install Optional System Tools (for enhanced monitoring and WiFi features)

These tools are required for full network monitoring and WiFi honeypot capabilities.

**For Ubuntu/Debian:**

```bash
sudo apt-get update
sudo apt-get install tcpdump iptables hostapd dnsmasq net-tools iproute2 procps
```

**For CentOS/RHEL:**

```bash
sudo yum install tcpdump iptables hostapd dnsmasq net-tools iproute2 procps
```

#### 3. Configure Environment Variables

Copy the example environment file and configure your settings:

```bash
cp .env.example .env
```

Edit the `.env` file and add your Telegram Bot credentials:

```bash
# Get your bot token from @BotFather on Telegram
TELEGRAM_BOT_TOKEN=123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789

# Get your chat ID by messaging your bot and visiting:
# https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
TELEGRAM_CHAT_ID=-1001234567890
```

#### 4. Build the Next.js Application

```bash
npm run build
```

#### 5. Start the Application

**Option A: Start both components separately (recommended for development)**

Terminal 1 - Start the Next.js dashboard:
```bash
npm run dev
```

Terminal 2 - Start the honeypot server:
```bash
# Basic start (without root privileges)
npm run honeypot

# Full functionality start (with root privileges)
sudo npm run honeypot
```

**Option B: Production start**

Start the built Next.js application:
```bash
npm start
```

Then in another terminal, start the honeypot server:
```bash
# Basic start (without root privileges)
npm run honeypot

# Full functionality start (with root privileges)
sudo npm run honeypot
```

#### Accessing the Application

Once running:
- **Web Dashboard**: Access the main dashboard at `http://localhost:3000`
- **Honeypot Control Panel**: Real-time honeypot monitoring at `http://localhost:3001`

## Configuration

### Default Ports

**Main Application Ports:**
*   **Next.js Dashboard**: 3000
*   **Honeypot Control Panel**: 3001

**Honeypot Service Ports:**
*   **SSH Honeypot**: 2222
*   **HTTP Honeypot**: 8080
*   **FTP Honeypot**: 2121
*   **Telnet Honeypot**: 2323
*   **Fake Database Services**:
    *   MySQL: 3306
    *   PostgreSQL: 5432
    *   Redis: 6379
    *   MongoDB: 27017
    *   MSSQL: 1433

### Logs and Data Location

*   **Main logs**: `./logs/`
*   **Harvested data**: `./harvested-data/`
*   **Exports**: `./exports/`

### Telegram Notifications Setup

1. **Create a Telegram Bot:**
   - Message [@BotFather](https://t.me/BotFather) on Telegram
   - Use `/newbot` command and follow instructions
   - Save the bot token

2. **Get your Chat ID:**
   - Start a chat with your bot
   - Send any message to your bot
   - Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
   - Find your chat ID in the response

3. **Configure Environment Variables:**
   - Copy `.env.example` to `.env`
   - Add your bot token and chat ID

4. **Test Your Telegram Setup (Optional):**
   ```bash
   npm run test-telegram
   ```
   This will verify your Telegram bot configuration and send test messages.

## Available Scripts

- `npm run dev` - Start Next.js in development mode
- `npm run build` - Build the Next.js application
- `npm start` - Start the built Next.js application
- `npm run lint` - Run ESLint
- `npm run honeypot` - Start the honeypot server
- `npm run setup` - Run interactive setup script
- `npm run test` - Run test suite
- `npm run test-telegram` - Test Telegram bot configuration
- `npm run check-system` - Check system capabilities

## Security Warning

⚠️ **IMPORTANT**: This tool is for educational and authorized testing purposes only.

*   **Only use on networks you own or have explicit permission to test.**
*   **Do not use for malicious purposes.**
*   Be aware of legal implications in your jurisdiction regarding network monitoring and honeypot deployment.
*   Monitor resource usage to prevent system overload.
*   **For Docker deployments, `--network=host` reduces isolation.** Ensure you understand the implications for your environment.
*   **Running as root (locally or in Docker) grants extensive privileges.** Use with caution and in isolated environments.

## Features Overview

### Honeypot Services

*   **SSH**: Simulates an OpenSSH server, logging authentication attempts and commands.
*   **HTTP**: Fake web services with login pages and API endpoints to capture web-based attacks.
*   **FTP**: File Transfer Protocol simulation with directory listings and command logging.
*   **Telnet**: Terminal access simulation to capture interactive sessions.
*   **Database Services**: Fake MySQL, PostgreSQL, Redis, MongoDB, and MSSQL services to log connection attempts and queries.

### Attack Detection

*   **SQL Injection**: Detects common SQLi patterns in captured data.
*   **Cross-site Scripting (XSS)**: Identifies XSS payloads.
*   **Command Injection**: Recognizes attempts to inject system commands.
*   **Directory Traversal**: Flags attempts to access unauthorized directories.
*   **Brute Force Attacks**: Identifies repeated authentication failures.
*   **Port Scanning**: Detects attempts to scan multiple ports on the honeypot.
*   **Behavioral Anomalies**: Identifies unusual traffic patterns or high-volume activity.
*   **Threat Signatures**: Matches against known malicious IPs, domains, and attack patterns.

### Dashboard Features

*   **Real-time Statistics**: View total connections, active targets, attacks detected, and data harvested.
*   **Active Connections Monitoring**: See current connections to the honeypot.
*   **Attack Visualization**: View recent attacks with type, source, target, and severity.
*   **System Information**: Monitor honeypot host system details (platform, memory, CPU).
*   **Log Management**: View recent logs directly in the dashboard.
*   **Data Export**: Export captured data and logs for offline analysis.
*   **Controls**: Start/Stop honeypot, clear logs, export data, get system info.

## Troubleshooting

### Common Issues

1.  **Permission Denied**:
    *   Ensure you are running the honeypot server with `sudo` for features requiring root privileges (e.g., `sudo npm run honeypot`).
    *   Check file and directory permissions.

2.  **Port Already in Use**:
    *   TrapDaemon automatically tries alternative ports for honeypot services.
    *   For the dashboard (port 3000) or control panel (port 3001), ensure no other service is using them.
    *   Use `lsof -i :3000` or `lsof -i :3001` to check what's using these ports.

3.  **Missing Dependencies**:
    *   For Node.js dependencies, run `npm install`.
    *   For system tools (like `tcpdump`, `hostapd`), ensure they are installed on your host system.

4.  **Network Monitoring Issues**:
    *   Requires root privileges for the honeypot server.
    *   Ensure `tcpdump` and `iptables` are installed and accessible.
    *   For Docker, ensure `--cap-add=NET_ADMIN --cap-add=NET_RAW --network=host` are used.

5.  **Telegram Alerts Not Sending**:
    *   Verify your `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are correct in your `.env` file.
    *   Run `npm run test-telegram` to test your Telegram configuration.
    *   Ensure the honeypot server has internet connectivity to reach Telegram's API.
    *   Check the honeypot logs for any errors related to Telegram.
    *   Test your bot configuration by messaging it directly.

6.  **Dashboard Not Loading**:
    *   Ensure both the Next.js app and honeypot server are running.
    *   Check that ports 3000 and 3001 are accessible.
    *   Verify no firewall is blocking the connections.

### Logs

Check the `logs/` directory for detailed error information:
*   `logs/system.log` - System events and general application logs.
*   `logs/attacks.log` - Security events and attack detections.
*   `logs/trapdaemon.log` - General application logs.
*   `logs/errors.jsonl` - Detailed error information in JSONL format.
*   `logs/connections.jsonl` - Detailed connection information in JSONL format.
*   `logs/data_harvest.jsonl` - Detailed harvested data in JSONL format.

## Development

### Project Structure

```
├── src/                    # Next.js Frontend Application
│   ├── app/               # Next.js 13+ App Router
│   │   ├── page.tsx       # Main dashboard page
│   │   ├── layout.tsx     # App layout
│   │   └── globals.css    # Global styles
│   └── components/        # React components
├── server/                # Honeypot Server
│   ├── core/
│   │   └── honeypot-core.js    # Main honeypot services logic
│   ├── detection/
│   │   └── attack-detector.js  # Attack detection engine
│   ├── network/
│   │   └── network-manager.js  # Network monitoring and WiFi features
│   ├── utils/
│   │   ├── logger.js          # Centralized logging system
│   │   └── telegram-bot.js    # Telegram notification module
│   └── honeypot.js            # Main honeypot application entry point
├── logs/                      # Log files (created at runtime)
├── exports/                   # Data exports (created at runtime)
├── harvested-data/           # Captured data (created at runtime)
├── package.json              # Project dependencies and scripts
├── Dockerfile                # Docker build instructions
├── .dockerignore             # Files to ignore during Docker build
├── .env.example              # Example environment configuration
├── README.md                 # This documentation
├── setup.js                  # Local setup and configuration script
├── test.js                   # Test suite for honeypot components
├── check-system.js          # System capability checker
└── ... (other configuration files)
```

### Development Workflow

1. **Frontend Development:**
   ```bash
   npm run dev  # Starts Next.js in development mode with hot reload
   ```

2. **Backend Development:**
   ```bash
   npm run honeypot  # Starts the honeypot server
   ```

3. **Building for Production:**
   ```bash
   npm run build
   npm start  # Starts the built Next.js app
   npm run honeypot  # Starts the honeypot server
   ```

## License

MIT License - See the LICENSE file for details.

## Disclaimer

This software is provided for educational and research purposes. Users are responsible for complying with all applicable laws and regulations. The authors are not responsible for any misuse of this software or any damages incurred from its use.
