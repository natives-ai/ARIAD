@echo off
setlocal EnableExtensions EnableDelayedExpansion
title ARIAD Launcher

cd /d "%~dp0"
set "ROOT=%CD%"

if "%ARIAD_BACKEND_HOST%"=="" set "ARIAD_BACKEND_HOST=127.0.0.1"
if "%ARIAD_BACKEND_PORT%"=="" set "ARIAD_BACKEND_PORT=3001"
if "%ARIAD_FRONTEND_HOST%"=="" set "ARIAD_FRONTEND_HOST=127.0.0.1"
if "%ARIAD_FRONTEND_PORT%"=="" set "ARIAD_FRONTEND_PORT=5173"

set "BACKEND_HEALTH_URL=http://%ARIAD_BACKEND_HOST%:%ARIAD_BACKEND_PORT%/api/health"
set "SERVICE_URL=http://%ARIAD_FRONTEND_HOST%:%ARIAD_FRONTEND_PORT%/service.html"
set "RUNTIME_DIR=%ROOT%\.codex-runtime\launcher"

if not exist "%RUNTIME_DIR%" mkdir "%RUNTIME_DIR%" >nul 2>nul

echo ============================================================
echo ARIAD one-click launcher
echo Root: %ROOT%
echo Backend: %BACKEND_HEALTH_URL%
echo Frontend: %SERVICE_URL%
echo Runtime logs: %RUNTIME_DIR%
echo ============================================================
echo.

call :require_command node.exe
if errorlevel 1 goto :fail
call :require_command yarn.cmd
if errorlevel 1 goto :fail
call :require_command powershell.exe
if errorlevel 1 goto :fail
echo [INFO] Launching single-window bootstrap with live logs...
echo [INFO] The launcher writes logs into %RUNTIME_DIR%.
echo.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\scripts\launch-local.ps1"
if errorlevel 1 goto :fail
goto :eof

:require_command
where %~1 >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Required command not found: %~1
  echo [HINT] Install the missing tool and try again.
  exit /b 1
)

exit /b 0

:fail
echo.
echo [FAIL] ARIAD launcher did not complete successfully.
echo [FAIL] Review the messages above and logs under %RUNTIME_DIR%, then try again.
pause
exit /b 1
