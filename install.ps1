$ErrorActionPreference = "Stop"
$Repo = "daidi/git-ai"

# Detect Architecture
$Arch = $env:PROCESSOR_ARCHITECTURE.ToLower()
$ArchName = "amd64"
if ($Arch -match "arm") {
    $ArchName = "arm64"
}

# Fetch latest version
Write-Host "Fetching latest version of git-ai..."
try {
    $Release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest"
    $Version = $Release.tag_name
} catch {
    Write-Host "Error: Failed to fetch the latest version." -ForegroundColor Red
    exit 1
}

if (-not $Version) {
    Write-Host "Error: Failed to find the latest version tag." -ForegroundColor Red
    exit 1
}

Write-Host "Latest release: $Version"

$FileName = "git-ai_windows_$ArchName.zip"
$DownloadUrl = "https://github.com/$Repo/releases/download/$Version/$FileName"

# Determine Install Directory
$InstallDir = "$env:USERPROFILE\.local\bin"
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir | Out-Null
}

$TempDir = Join-Path $env:TEMP "git-ai-install"
if (Test-Path $TempDir) {
    Remove-Item -Recurse -Force $TempDir
}
New-Item -ItemType Directory -Path $TempDir | Out-Null

$ZipFile = Join-Path $TempDir $FileName

Write-Host "Downloading $DownloadUrl..."
try {
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $ZipFile
} catch {
    Write-Host "Error: Failed to download Git AI. The release might not be available for windows_$ArchName." -ForegroundColor Red
    Remove-Item -Recurse -Force $TempDir
    exit 1
}

Write-Host "Extracting..."
Expand-Archive -Path $ZipFile -DestinationPath $TempDir -Force

Write-Host "Installing to $InstallDir..."
Copy-Item -Path (Join-Path $TempDir "git-ai.exe") -Destination (Join-Path $InstallDir "git-ai.exe") -Force

# Check and Add to PATH
$UserPath = [Environment]::GetEnvironmentVariable("PATH", [EnvironmentVariableTarget]::User)
if ($UserPath -notmatch [regex]::Escape($InstallDir)) {
    Write-Host "Adding $InstallDir to user PATH..."
    [Environment]::SetEnvironmentVariable("PATH", "$InstallDir;$UserPath", [EnvironmentVariableTarget]::User)
    $env:PATH = "$InstallDir;$env:PATH" # Update current session
}

# Cleanup
Remove-Item -Recurse -Force $TempDir

Write-Host ""
Write-Host "✅ Git AI successfully installed!" -ForegroundColor Green
Write-Host "Run 'git-ai --version' to verify the installation (you may need to restart your terminal)."
Write-Host "Then 'cd' into your repository and run 'git-ai init' to get started."
