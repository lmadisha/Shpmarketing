# Network Configuration Instructions

This guide explains how to configure the ShpMarketing application to run on your local network, allowing access from other machines on the same network.

## Prerequisites

- Node.js and npm installed
- PostgreSQL database running
- Git repository cloned

## Step 1: Find Your Machine's IP Address

### Windows
1. Open Command Prompt or PowerShell
2. Run the following command:
   ```
   ipconfig
   ```
3. Look for your network adapter (usually "Ethernet adapter" or "Wireless LAN adapter")
4. Find the "IPv4 Address" - this is your local IP (e.g., `192.168.1.100`)

### Alternative Method
Run this PowerShell command to get your IP:
```powershell
Get-NetIPAddress | Where-Object {$_.AddressFamily -eq "IPv4" -and $_.PrefixOrigin -eq "Dhcp"} | Select-Object IPAddress
```

## Step 2: Configure the Operations API

1. Open `operations-api/.env`
2. The API is already configured to listen on all network interfaces
3. Update the `CORS_ORIGIN` to include your IP and port where the frontend will run:
   ```
   CORS_ORIGIN=http://localhost:5173,http://localhost:5174,https://localhost:5173,https://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174,http://YOUR_IP:5173,http://YOUR_IP:5174,https://YOUR_IP:5173,https://YOUR_IP:5174
   ```
   Replace `YOUR_IP` with your actual IP address from Step 1.

## Step 3: Configure the Frontend

1. Open the root `.env` file
2. Change the operations API base URL:
   ```
   NUXT_PUBLIC_OPERATIONS_API_BASE=http://YOUR_IP:5001
   ```
   Replace `YOUR_IP` with your actual IP address.

## Step 4: Windows Firewall Configuration

To allow other machines to connect, you may need to configure Windows Firewall:

### Option 1: Allow Node.js applications
1. Open Windows Defender Firewall
2. Click "Allow an app or feature through Windows Defender Firewall"
3. Click "Change settings"
4. Click "Allow another app..."
5. Browse to your Node.js installation (usually `C:\Program Files\nodejs\node.exe`)
6. Add it and ensure both Private and Public are checked

### Option 2: Allow specific ports
1. Open Windows Defender Firewall
2. Click "Advanced settings"
3. Click "Inbound Rules" → "New Rule..."
4. Select "Port" → Next
5. Enter ports: `5001,5173,5174` (comma-separated)
6. Select "Allow the connection" → Next
7. Check all profiles (Domain, Private, Public) → Next
8. Give it a name like "ShpMarketing App Ports" → Finish

## Step 5: Start the Application

1. Start the database (PostgreSQL)
2. In one terminal, start the operations API:
   ```bash
   cd operations-api
   npm start
   ```
3. In another terminal, start the frontend:
   ```bash
   npm run dev
   ```

## Step 6: Access from Other Machines

- Frontend will be available at: `http://YOUR_IP:5173` or `https://YOUR_IP:5174`
- Other machines on the same network can access using your IP address
- Make sure all machines are on the same subnet (same first 3 numbers in IP, e.g., 192.168.1.x)

## Troubleshooting

### Can't connect from other machines?
- Verify IP address is correct
- Check Windows Firewall settings
- Ensure both machines are on the same network
- Try disabling firewall temporarily for testing

### CORS errors?
- Make sure `CORS_ORIGIN` in `operations-api/.env` includes the IP and port of the accessing machine

### API not reachable?
- Confirm the operations API is running on port 5001
- Check if PostgreSQL is running and accessible

## Security Note

Running on network interfaces exposes the application to other devices on your network. In production, use proper authentication and consider VPN or secure network configurations.