# Docker Desktop Startup Troubleshooting

## Current Status
✅ Docker Desktop Service is **Running**  
❌ Docker Engine is **NOT responding**

## Diagnosis
The Windows service `com.docker.service` is active, but Docker Desktop's container engine hasn't fully started. This is usually due to:

1. **WSL 2 Backend Issues** - Most common
2. **Hyper-V Conflicts** - If enabled alongside WSL 2
3. **Corrupted Docker Desktop Data**
4. **Insufficient Resources** - RAM or disk space

## Solutions to Try (In Order)

### 1. Check Docker Desktop UI
Open Docker Desktop application from Start Menu and check:
- Settings → General → "Use WSL 2 based engine" should be **checked**
- Look for any error messages in the UI
- Check if it's stuck on "Starting..."

### 2. Verify WSL 2 Distribution
```powershell
wsl --list --verbose
```

If you see no distributions or WSL 1:
```powershell
# Install Ubuntu (recommended)
wsl --install -d Ubuntu-24.04

# Set it as default
wsl --set-default Ubuntu-24.04
```

### 3. Reset Docker to WSL 2 Backend
In Docker Desktop:
- Settings → General
- Ensure "Use the WSL 2 based engine" is **checked**
- Click "Apply & restart"

### 4. Clear Docker Desktop Data
⚠️ **This will delete all containers, images, and volumes**

**Option A: Via Docker Desktop UI**
- Settings → Troubleshoot → "Clean / Purge data"
- Click "Purge Data" and restart

**Option B: Manual cleanup**
```powershell
# Stop Docker Desktop completely (via system tray)
# Then delete these folders:
Remove-Item "$env:APPDATA\Docker" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "$env:LOCALAPPDATA\Docker" -Recurse -Force -ErrorAction SilentlyContinue
```

Restart Docker Desktop

### 5. Enable Required Windows Features (As Administrator)
```powershell
# Run PowerShell as Administrator
Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux -NoRestart
Enable-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform -NoRestart
```

Restart computer

### 6. Check System Resources
Docker Desktop requires:
- **Minimum:** 4GB RAM (8GB recommended)
- **10GB free disk space** (for images/containers)

Check:
```powershell
# Check free RAM
Get-CimInstance Win32_OperatingSystem | Select FreePhysicalMemory

# Check free disk space (C: drive)
Get-PSDrive C | Select Used,Free
```

### 7. Complete Reinstall
If nothing else works:

1. **Uninstall Docker Desktop**
   - Settings → Apps → Docker Desktop → Uninstall

2. **Clean up remaining data**
   ```powershell
   Remove-Item "$env:APPDATA\Docker" -Recurse -Force -ErrorAction SilentlyContinue
   Remove-Item "$env:LOCALAPPDATA\Docker" -Recurse -Force -ErrorAction SilentlyContinue
   Remove-Item "C:\ProgramData\Docker" -Recurse -Force -ErrorAction SilentlyContinue
   ```

3. **Restart computer**

4. **Download latest Docker Desktop** from https://www.docker.com/products/docker-desktop/

5. **Install with WSL 2 backend** (default option)

## Quick Verification Commands

Once Docker Desktop says "Docker Desktop is running":

```powershell
# Test basic connectivity
docker version

# Test engine
docker run hello-world

# Verify images
docker images
```

## Alternative: Use Native Windows Installation

If Docker Desktop continues failing, you can run the Ukombozi backend and frontend **without Docker** using your existing setup:

```bash
# Terminal 1: Backend
cd backend
npm install
npm start

# Terminal 2: Frontend  
cd frontend
npm install
npm start
```

Access at http://localhost:3000 (frontend proxies to backend at :5000)

## Need More Help?

Check Docker Desktop logs:
- Windows: `%LOCALAPPDATA%\Docker\log.txt`
- Or via Docker Desktop → Troubleshoot → "Show logs"

Share the error messages for specific debugging.
