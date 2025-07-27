# Use an official Node.js runtime as a parent image
# Using Node.js 20-alpine for a smaller image size
FROM node:20-alpine

# Install system dependencies required for network monitoring and WiFi honeypot features
# These tools often require root privileges to function correctly
RUN apk add --no-cache \
    tcpdump \
    iptables \
    hostapd \
    dnsmasq \
    net-tools \
    iproute2 \
    procps \
    grep \
    awk \
    coreutils \
    bash \
    curl \
    nmap \
    netcat-openbsd \
    lsof

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
# This allows Docker to cache the npm install step
COPY package*.json ./

# Install Node.js dependencies
# Using --omit=dev to not install devDependencies in the production image
RUN npm install --omit=dev

# Copy the rest of the application code to the working directory
COPY . .

# Ensure the main honeypot script is executable
RUN chmod +x honeypot.js

# Create necessary directories for logs and data
RUN mkdir -p logs exports harvested-data config tmp/trapdaemon

# Expose the ports the honeypot services and dashboard will run on
# SSH: 2222, FTP: 2121, Telnet: 2323, HTTP: 8080, Dashboard: 3001
# Fake DB services: MySQL: 3306, PostgreSQL: 5432, Redis: 6379, MongoDB: 27017, MSSQL: 1433
EXPOSE 2222 2121 2323 8080 3001 3306 5432 6379 27017 1433

# Command to run the application
# Running as root is necessary for network monitoring tools like tcpdump and iptables
# and for hostapd/dnsmasq for WiFi honeypot features.
# In a production environment, consider dropping capabilities or using a non-root user
# with specific capabilities if possible, but for a honeypot, root is often required.
CMD ["node", "honeypot.js"]
