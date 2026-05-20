$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend'
$python = Join-Path $backend 'venv-win\Scripts\python.exe'
$lanAddress = (
    Get-NetIPConfiguration |
    Where-Object {
        $_.IPv4Address -and
        $_.NetAdapter.Status -eq 'Up' -and
        $_.IPv4Address.IPAddress -match '^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)'
    } |
    Select-Object -First 1 -ExpandProperty IPv4Address
).IPAddress

function Test-ListenPort {
    param([int]$Port)
    return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

function Test-PythonExecutable {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        return $false
    }

    try {
        & $Path --version *> $null
        return $LASTEXITCODE -eq 0
    }
    catch {
        return $false
    }
}

function New-BackendVenv {
    Push-Location $backend
    try {
        $candidates = @(
            @{ File = 'py'; Args = @('-3.13', '-m', 'venv', '--clear', 'venv-win') },
            @{ File = 'py'; Args = @('-3', '-m', 'venv', '--clear', 'venv-win') },
            @{ File = 'python'; Args = @('-m', 'venv', '--clear', 'venv-win') }
        )

        foreach ($candidate in $candidates) {
            if (-not (Get-Command $candidate.File -ErrorAction SilentlyContinue)) {
                continue
            }

            $exe = $candidate.File
            $cmdArgs = $candidate.Args
            & $exe @cmdArgs

            if ($LASTEXITCODE -eq 0 -and (Test-PythonExecutable $python)) {
                return
            }
        }

        throw 'Could not create backend Python virtual environment. Install Python 3 and make sure it is available in PATH.'
    }
    finally {
        Pop-Location
    }
}

if (-not (Test-PythonExecutable $python)) {
    Write-Host 'Preparing backend Python environment...'
    New-BackendVenv
}

Push-Location $backend
& $python -m pip install --upgrade pip
& $python -m pip install -r requirements.txt
& $python (Join-Path $backend 'scripts\migrate_database.py')
Pop-Location

if (-not (Test-Path (Join-Path $frontend 'node_modules\.bin\vite.cmd'))) {
    Push-Location $frontend
    npm install
    Pop-Location
}

if (-not (Test-ListenPort 8000)) {
    Start-Process -FilePath $python `
        -ArgumentList @('-m', 'uvicorn', 'app.main:app', '--host', '0.0.0.0', '--port', '8000') `
        -WorkingDirectory $backend `
        -RedirectStandardOutput (Join-Path $backend 'uvicorn-dev.out.log') `
        -RedirectStandardError (Join-Path $backend 'uvicorn-dev.err.log') `
        -WindowStyle Hidden
}

if (-not (Test-ListenPort 5173)) {
    Start-Process -FilePath 'npm.cmd' `
        -ArgumentList @('run', 'dev', '--', '--host', '0.0.0.0') `
        -WorkingDirectory $frontend `
        -RedirectStandardOutput (Join-Path $frontend 'vite-dev.out.log') `
        -RedirectStandardError (Join-Path $frontend 'vite-dev.err.log') `
        -WindowStyle Hidden
}

Write-Host 'Backend:  http://127.0.0.1:8000'
Write-Host 'Frontend: http://localhost:5173'
if ($lanAddress) {
    Write-Host "Phone URL: http://$($lanAddress):5173"
}
