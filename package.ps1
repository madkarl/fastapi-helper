# Script for packaging both source code and VSIX

# Define source directory and target zip file path
$projectDir = 'E:\Projects\python\fastapi_basic_project'
$projectZip = '.\assets\project_template.zip'
$moduleDir = Join-Path $projectDir 'template\module'
$moduleZip = '.\assets\module_template.zip'
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
    if (Test-Path $projectZip) {
        Remove-Item $projectZip -Force
        Write-Host 'Removed existing zip file' -ForegroundColor Gray
    }
}

function New-ModulePackage {
    Write-StatusMessage 'Starting module packaging'
    
    $tempDir = $null
    
    # Check if module directory exists
    if (-not (Test-Path $moduleDir)) {
        Write-Host 'Module directory not found, skipping module packaging' -ForegroundColor Yellow
        return
    }
    
    # Delete target module zip file if it already exists
    if (Test-Path $moduleZip) {
        Remove-Item $moduleZip -Force
        Write-Host 'Removed existing module zip file' -ForegroundColor Gray
    }
    
    try {
        # Import required .NET assembly
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        
        # Create temporary directory
        $tempDir = Join-Path $env:TEMP ([Guid]::NewGuid().ToString())
        New-Item -ItemType Directory -Path $tempDir | Out-Null
        Write-Host 'Created temporary directory for module packaging' -ForegroundColor Gray
        
        # Copy module files to be packaged to temporary directory
        Get-ChildItem -Path $moduleDir -Recurse | 
            Where-Object { 
                $_.FullName -notmatch '\\__pycache__\\|\\__pycache__$'
            } | 
            ForEach-Object {
                $relativePath = $_.FullName.Substring($moduleDir.Length + 1)
                $targetPath = Join-Path $tempDir $relativePath
                $targetDir = Split-Path $targetPath -Parent
                
                if (-not (Test-Path $targetDir)) {
                    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
                }
                Copy-Item -Path $_.FullName -Destination $targetPath -Force
            }
        
        # Create module zip file
        [System.IO.Compression.ZipFile]::CreateFromDirectory($tempDir, $moduleZip)
        
        # Display success message and file size
        $zipSize = (Get-Item $moduleZip).Length / 1KB
        Write-Host "Module packaging successful! File saved to: $moduleZip" -ForegroundColor Green
        Write-Host "Module package size: $($zipSize.ToString('0.00')) KB" -ForegroundColor Green
        
    } catch {
        Write-Host "Module packaging failed: $_" -ForegroundColor Red
        throw
    } finally {
        # Clean up temporary directory
        if ($tempDir -and (Test-Path $tempDir)) {
            Remove-Item $tempDir -Recurse -Force
            Write-Host 'Cleaned up temporary directory' -ForegroundColor Gray
        }
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
        Get-ChildItem -Path $projectDir -Recurse | 
            Where-Object { 
                -not ($excludeList -contains $_.Name) -and 
                $_.FullName -notmatch '\\__pycache__\\|\\__pycache__$' -and
                $_.FullName -notmatch '\\alembic\\|\\alembic$' -and
                $_.FullName -notmatch '\\.venv\\|\\.venv$' -and
                $_.FullName -notmatch '\\template\\|\\template$'
            } | 
            ForEach-Object {
                $relativePath = $_.FullName.Substring($projectDir.Length + 1)
                $targetPath = Join-Path $tempDir $relativePath
                $targetDir = Split-Path $targetPath -Parent
                
                if (-not (Test-Path $targetDir)) {
                    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
                }
                Copy-Item -Path $_.FullName -Destination $targetPath -Force
            }
        
        # Create zip file
        [System.IO.Compression.ZipFile]::CreateFromDirectory($tempDir, $projectZip)
        
        # Display success message and file size
        $zipSize = (Get-Item $projectZip).Length / 1MB
        Write-Host "Source code packaging successful! File saved to: $projectZip" -ForegroundColor Green
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

function Copy-TemplateFiles {
    Write-StatusMessage 'Starting template files copying'
    
    $templateDir = Join-Path $projectDir 'template'
    $targetFiles = @('router.py', 'schema.py')
    
    # Check if template directory exists
    if (-not (Test-Path $templateDir)) {
        Write-Host 'Template directory not found, skipping template files copying' -ForegroundColor Yellow
        return
    }
    
    try {
        $copiedCount = 0
        
        foreach ($fileName in $targetFiles) {
            $sourceFile = Join-Path $templateDir $fileName
            $targetFile = Join-Path '.\assets' $fileName
            
            if (Test-Path $sourceFile) {
                # Remove existing file if it exists
                if (Test-Path $targetFile) {
                    Remove-Item $targetFile -Force
                    Write-Host "Removed existing file: $fileName" -ForegroundColor Gray
                }
                
                # Copy file to assets directory
                Copy-Item -Path $sourceFile -Destination $targetFile -Force
                Write-Host "Copied $fileName to assets directory" -ForegroundColor Green
                $copiedCount++
            } else {
                Write-Host "Source file not found: $fileName" -ForegroundColor Yellow
            }
        }
        
        Write-Host "Template files copying completed! Copied $copiedCount files" -ForegroundColor Green
        
    } catch {
        Write-Host "Template files copying failed: $_" -ForegroundColor Red
        throw
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
    New-ModulePackage
    Copy-TemplateFiles
    New-VsixPackage
    Write-StatusMessage 'All packaging operations completed successfully!' 'Green'
} catch {
    Write-StatusMessage 'Packaging process failed!' 'Red'
    exit 1
}