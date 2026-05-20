$ErrorActionPreference = 'Stop'

$profiles = Get-NetConnectionProfile | Where-Object {
    $_.IPv4Connectivity -eq 'Internet'
}

foreach ($profile in $profiles) {
    Set-NetConnectionProfile `
        -InterfaceIndex $profile.InterfaceIndex `
        -NetworkCategory Private
}

$rules = @(
    @{ Name = 'AstanaSafe Frontend 5173'; Port = 5173 },
    @{ Name = 'AstanaSafe Backend 8000'; Port = 8000 }
)

foreach ($rule in $rules) {
    $existingRule = Get-NetFirewallRule `
        -DisplayName $rule.Name `
        -ErrorAction SilentlyContinue

    if (-not $existingRule) {
        New-NetFirewallRule `
            -DisplayName $rule.Name `
            -Direction Inbound `
            -Action Allow `
            -Protocol TCP `
            -LocalPort $rule.Port `
            -Profile Any | Out-Null
    }
}

$lanAddress = (
    Get-NetIPConfiguration |
    Where-Object {
        $_.IPv4Address -and
        $_.NetAdapter.Status -eq 'Up' -and
        $_.IPv4Address.IPAddress -match '^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)'
    } |
    Select-Object -First 1 -ExpandProperty IPv4Address
).IPAddress

Write-Host ''
Write-Host 'AstanaSafe network access is ready.'
Write-Host "Open on phones: http://$($lanAddress):5173"
Write-Host ''
Read-Host 'Press Enter to close'
