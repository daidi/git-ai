$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$Repo = "daidi/git-ai"
$TempDir = $null
$StagedDestination = $null

function Invoke-WithRetry {
    param(
        [Parameter(Mandatory = $true)][scriptblock]$Operation,
        [Parameter(Mandatory = $true)][string]$Description
    )

    $LastError = $null
    for ($Attempt = 1; $Attempt -le 3; $Attempt++) {
        try {
            return & $Operation
        } catch {
            $LastError = $_
            if ($Attempt -lt 3) {
                Start-Sleep -Seconds ([Math]::Pow(2, $Attempt - 1))
            }
        }
    }
    throw "$Description failed after 3 attempts: $($LastError.Exception.Message)"
}

try {
    if (-not ([Net.ServicePointManager]::SecurityProtocol -band [Net.SecurityProtocolType]::Tls12)) {
        [Net.ServicePointManager]::SecurityProtocol =
            [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    }

    $Architecture = if ($env:PROCESSOR_ARCHITEW6432) {
        $env:PROCESSOR_ARCHITEW6432
    } else {
        $env:PROCESSOR_ARCHITECTURE
    }
    switch -Regex ($Architecture) {
        '^(AMD64|x86_64)$' { $ArchName = 'amd64'; break }
        '^(ARM64|aarch64)$' { $ArchName = 'arm64'; break }
        default { throw "Unsupported Windows architecture: $Architecture" }
    }

    $Headers = @{
        Accept = "application/vnd.github+json"
        "User-Agent" = "git-ai-installer"
    }
    Write-Host "Fetching latest version of git-ai..."
    $Release = Invoke-WithRetry -Description "GitHub release lookup" -Operation {
        Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest" `
            -Headers $Headers -TimeoutSec 30
    }
    $Version = [string]$Release.tag_name
    if ($Version -notmatch '^v[0-9]+\.[0-9]+\.[0-9]+(?:[+-][0-9A-Za-z.-]+)?$') {
        throw "GitHub returned an invalid release version."
    }
    Write-Host "Latest release: $Version"

    $FileName = "git-ai_windows_$ArchName.zip"
    $BaseUrl = "https://github.com/$Repo/releases/download/$Version"
    $TempDir = Join-Path ([IO.Path]::GetTempPath()) ("git-ai-install-" + [Guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Path $TempDir | Out-Null
    $ZipFile = Join-Path $TempDir $FileName
    $ChecksumFile = Join-Path $TempDir "checksums.txt"

    Write-Host "Downloading $BaseUrl/$FileName..."
    Invoke-WithRetry -Description "Release archive download" -Operation {
        Remove-Item -LiteralPath $ZipFile -Force -ErrorAction SilentlyContinue
        Invoke-WebRequest -Uri "$BaseUrl/$FileName" -OutFile $ZipFile -TimeoutSec 300
    } | Out-Null
    Invoke-WithRetry -Description "Release checksum download" -Operation {
        Remove-Item -LiteralPath $ChecksumFile -Force -ErrorAction SilentlyContinue
        Invoke-WebRequest -Uri "$BaseUrl/checksums.txt" -OutFile $ChecksumFile -TimeoutSec 60
    } | Out-Null
    $ArchiveLength = (Get-Item -LiteralPath $ZipFile).Length
    if ($ArchiveLength -lt 1 -or $ArchiveLength -gt 150MB) {
        throw "The release archive has an invalid size."
    }
    if ((Get-Item -LiteralPath $ChecksumFile).Length -gt 1MB) {
        throw "The release checksum response exceeded the safety limit."
    }

    $EscapedFileName = [Regex]::Escape($FileName)
    $ChecksumLine = @(Get-Content -LiteralPath $ChecksumFile | Where-Object {
        $_ -match "^[0-9a-fA-F]{64}\s+\*?$EscapedFileName$"
    })
    if ($ChecksumLine.Count -ne 1) {
        throw "The release checksum list does not contain exactly one valid entry for $FileName."
    }
    $ExpectedChecksum = ($ChecksumLine[0] -split '\s+', 2)[0].ToLowerInvariant()
    $ActualChecksum = (Get-FileHash -LiteralPath $ZipFile -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($ExpectedChecksum -ne $ActualChecksum) {
        throw "Checksum verification failed. The existing installation was left unchanged."
    }

    $ExtractDir = Join-Path $TempDir "extracted"
    New-Item -ItemType Directory -Path $ExtractDir | Out-Null
    $Binary = Join-Path $ExtractDir "git-ai.exe"

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $Zip = [IO.Compression.ZipFile]::OpenRead($ZipFile)
    try {
        $Entries = @($Zip.Entries | Where-Object {
            $_.FullName -ceq "git-ai.exe" -and -not [string]::IsNullOrEmpty($_.Name)
        })
        if ($Entries.Count -ne 1) {
            throw "The verified archive did not contain exactly one git-ai.exe entry."
        }
        if ($Entries[0].Length -lt 1 -or $Entries[0].Length -gt 100MB) {
            throw "The executable in the verified archive has an invalid size."
        }
        $InputStream = $Entries[0].Open()
        $OutputStream = [IO.File]::Create($Binary)
        try {
            $Buffer = New-Object byte[] 81920
            $TotalBytes = 0L
            while (($Read = $InputStream.Read($Buffer, 0, $Buffer.Length)) -gt 0) {
                $TotalBytes += $Read
                if ($TotalBytes -gt 100MB) {
                    throw "The executable in the verified archive exceeded the safety limit."
                }
                $OutputStream.Write($Buffer, 0, $Read)
            }
            $OutputStream.Flush()
        } finally {
            $OutputStream.Dispose()
            $InputStream.Dispose()
        }
    } finally {
        $Zip.Dispose()
    }
    & $Binary --version *> $null
    if ($LASTEXITCODE -ne 0) {
        throw "The downloaded executable failed validation. The existing installation was left unchanged."
    }

    $InstallDir = Join-Path $env:USERPROFILE ".local\bin"
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    $Destination = Join-Path $InstallDir "git-ai.exe"
    $StagedDestination = Join-Path $InstallDir (".git-ai.install." + [Guid]::NewGuid().ToString("N") + ".exe")
    Copy-Item -LiteralPath $Binary -Destination $StagedDestination

    if (Test-Path -LiteralPath $Destination -PathType Leaf) {
        $Backup = Join-Path $TempDir "git-ai.previous.exe"
        [IO.File]::Replace($StagedDestination, $Destination, $Backup, $true)
    } else {
        [IO.File]::Move($StagedDestination, $Destination)
    }
    $StagedDestination = $null

    $UserPath = [Environment]::GetEnvironmentVariable("PATH", [EnvironmentVariableTarget]::User)
    $PathEntries = @($UserPath -split ';' | Where-Object { $_ })
    if (-not ($PathEntries | Where-Object { $_.TrimEnd('\') -ieq $InstallDir.TrimEnd('\') })) {
        Write-Host "Adding $InstallDir to the user PATH..."
        $NewUserPath = if ([string]::IsNullOrWhiteSpace($UserPath)) { $InstallDir } else { "$InstallDir;$UserPath" }
        [Environment]::SetEnvironmentVariable("PATH", $NewUserPath, [EnvironmentVariableTarget]::User)
        $env:PATH = "$InstallDir;$env:PATH"
    }

    Write-Host ""
    Write-Host "✅ Git AI successfully installed and checksum-verified." -ForegroundColor Green
    Write-Host "Run 'git-ai --version' to verify the installation (you may need to restart your terminal)."
    Write-Host "Then 'cd' into your repository and run 'git-ai init' to get started."
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "No verified download was installed; any previous installation remains available." -ForegroundColor Yellow
    exit 1
} finally {
    if ($StagedDestination -and (Test-Path -LiteralPath $StagedDestination)) {
        Remove-Item -LiteralPath $StagedDestination -Force -ErrorAction SilentlyContinue
    }
    if ($TempDir -and (Test-Path -LiteralPath $TempDir)) {
        Remove-Item -LiteralPath $TempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
