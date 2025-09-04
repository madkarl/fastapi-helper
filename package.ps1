# Script for packaging both source code and VSIX

# Define source directory and target zip file path
$sourceDir = 'E:\Projects\python\fastapi_basic_project'
$targetZip = '.\assets\fastapi.zip'
$ErrorActionPreference = 'Stop'

function Write-StatusMessage {
    param(
        [string]$Message,
        [string]$Color = 'Cyan'
    )
    Write-Host "=== $Message ===" -ForegroundColor $Color
}

function Initialize-PackageEnvironment {
    # Create assets directory if it doesn't exist
    if (-not (Test-Path '.\assets')) {
        New-Item -ItemType Directory -Path '.\assets' | Out-Null
        Write-Host 'Created assets directory' -ForegroundColor Gray
    }

    # Delete target zip file if it already exists
    if (Test-Path $targetZip) {
        Remove-Item $targetZip -Force
        Write-Host 'Removed existing zip file' -ForegroundColor Gray
    }
}

function New-SourcePackage {
    Write-StatusMessage 'Starting source code packaging'
    
    # Create exclusion list
    $excludeList = @('.venv', '.env', 'alembic', 'alembic.ini', 'pyproject.toml', 'poetry.lock')
    $tempDir = $null

    try {
        # Import required .NET assembly
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        
        # Create temporary directory
        $tempDir = Join-Path $env:TEMP ([Guid]::NewGuid().ToString())
        New-Item -ItemType Directory -Path $tempDir | Out-Null
        Write-Host 'Created temporary directory for packaging' -ForegroundColor Gray
        
        # Copy files to be packaged to temporary directory
        Get-ChildItem -Path $sourceDir -Recurse | 
            Where-Object { 
                -not ($excludeList -contains $_.Name) -and 
                $_.FullName -notmatch '\\__pycache__\\|\\__pycache__$' -and
                $_.FullName -notmatch '\\alembic\\|\\alembic$' -and
                $_.FullName -notmatch '\\.venv\\|\\.venv$'
            } | 
            ForEach-Object {
                $relativePath = $_.FullName.Substring($sourceDir.Length + 1)
                $targetPath = Join-Path $tempDir $relativePath
                $targetDir = Split-Path $targetPath -Parent
                
                if (-not (Test-Path $targetDir)) {
                    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
                }
                Copy-Item -Path $_.FullName -Destination $targetPath -Force
            }
        
        # Create zip file
        [System.IO.Compression.ZipFile]::CreateFromDirectory($tempDir, $targetZip)
        
        # Display success message and file size
        $zipSize = (Get-Item $targetZip).Length / 1MB
        Write-Host "Source code packaging successful! File saved to: $targetZip" -ForegroundColor Green
        Write-Host "Package size: $($zipSize.ToString('0.00')) MB" -ForegroundColor Green
        
    } catch {
        Write-Host "Source code packaging failed: $_" -ForegroundColor Red
        throw
    } finally {
        # Clean up temporary directory
        if ($tempDir -and (Test-Path $tempDir)) {
            Remove-Item $tempDir -Recurse -Force
            Write-Host 'Cleaned up temporary directory' -ForegroundColor Gray
        }
    }
}

function New-VsixPackage {
    Write-StatusMessage 'Starting VSIX packaging'
    
    try {
        # Clean up existing VSIX files
        Get-ChildItem -Path '.' -Filter '*.vsix' | ForEach-Object {
            Remove-Item $_.FullName -Force
            Write-Host "Removed existing VSIX file: $($_.Name)" -ForegroundColor Gray
        }
        
        # Clean up dist directory if it exists
        if (Test-Path '.\dist') {
            Remove-Item '.\dist' -Recurse -Force
            Write-Host 'Removed existing dist directory' -ForegroundColor Gray
        }
        
        npx vsce package
        Write-Host 'VSIX packaging completed successfully' -ForegroundColor Green
    } catch {
        Write-Host "VSIX packaging failed: $_" -ForegroundColor Red
        throw
    }
}

try {
    Initialize-PackageEnvironment
    New-SourcePackage
    New-VsixPackage
    Write-StatusMessage 'All packaging operations completed successfully!' 'Green'
} catch {
    Write-StatusMessage 'Packaging process failed!' 'Red'
    exit 1
}