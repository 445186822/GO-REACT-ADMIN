@echo off
setlocal EnableExtensions
chcp 65001 >nul

set "APP_DIR=%~dp0"
set "BACKEND_DIR=%APP_DIR%backend"
set "FRONTEND_DIR=%APP_DIR%frontend"
set "LOG_DIR=%APP_DIR%logs"
set "BACKEND_PORT=18080"
set "FRONTEND_PORT=15173"
set "BACKEND_ADDR=127.0.0.1:%BACKEND_PORT%"
set "FRONTEND_ADDR=127.0.0.1:%FRONTEND_PORT%"
set "PING_EXE=%SystemRoot%\System32\ping.exe"
set "START_WAIT_SECONDS=60"

cd /d "%APP_DIR%"

if "%~1"=="" set "ED_MENU=1" & goto menu
if /I "%~1"=="start" goto start
if /I "%~1"=="stop" goto stop
if /I "%~1"=="restart" goto restart
if /I "%~1"=="status" goto status
goto help

:start
call :check_tools
if errorlevel 1 goto done_fail

if not exist "%BACKEND_DIR%\.env" (
  if exist "%BACKEND_DIR%\.env.example" copy "%BACKEND_DIR%\.env.example" "%BACKEND_DIR%\.env" >nul
  echo Created backend\.env from .env.example.  Please edit it first.
  echo   INITIAL_ADMIN_PASSWORD must be set.
  echo   JWT_SECRET should be changed to a long random value.
  goto done_fail
)

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

call :require_port 5432 "PostgreSQL"
if errorlevel 1 goto done_fail
call :require_port 6379 "Redis"
if errorlevel 1 goto done_fail

call :find_port %BACKEND_PORT%
if defined PORT_PID (
  echo Backend already running on %BACKEND_PORT%: PID %PORT_PID%.
) else (
  echo Starting backend: http://%BACKEND_ADDR%
  (
    echo @echo off
    echo cd /d "%BACKEND_DIR%"
    echo set HTTP_ADDR=:%BACKEND_PORT%^&^& set ALLOWED_ORIGIN=http://%FRONTEND_ADDR%^&^& go run ./cmd/api 1^>"%LOG_DIR%\backend.out.log" 2^>"%LOG_DIR%\backend.err.log"
  ) > "%LOG_DIR%\run_backend.bat"
  start "enterprise-demo-backend" /B "%LOG_DIR%\run_backend.bat"
)

call :find_port %FRONTEND_PORT%
if defined PORT_PID (
  echo Frontend already running on %FRONTEND_PORT%: PID %PORT_PID%.
) else (
  echo Starting frontend: http://%FRONTEND_ADDR%
  (
    echo @echo off
    echo cd /d "%FRONTEND_DIR%"
    echo set VITE_DEV_PORT=%FRONTEND_PORT%^&^& set VITE_API_PROXY_TARGET=http://%BACKEND_ADDR%^&^& npm.cmd run dev -- --host 127.0.0.1 --port %FRONTEND_PORT% 1^>"%LOG_DIR%\frontend.out.log" 2^>"%LOG_DIR%\frontend.err.log"
  ) > "%LOG_DIR%\run_frontend.bat"
  start "enterprise-demo-frontend" /B "%LOG_DIR%\run_frontend.bat"
)

set /A WAIT_SECONDS=0
goto wait_start

:wait_start
call :find_port %BACKEND_PORT%
set "BACKEND_READY="
if defined PORT_PID set "BACKEND_READY=1"
call :find_port %FRONTEND_PORT%
set "FRONTEND_READY="
if defined PORT_PID set "FRONTEND_READY=1"
if defined BACKEND_READY if defined FRONTEND_READY goto started
set /A WAIT_SECONDS=%WAIT_SECONDS%+1
if %WAIT_SECONDS% GEQ %START_WAIT_SECONDS% goto start_failed
call :sleep1
goto wait_start

:started
echo.
echo Enterprise Demo started.
echo Backend:  http://%BACKEND_ADDR%
echo Frontend: http://%FRONTEND_ADDR%
echo Logs:
echo   logs\backend.out.log
echo   logs\backend.err.log
echo   logs\frontend.out.log
echo   logs\frontend.err.log
goto done_ok

:start_failed
echo.
echo Enterprise Demo did not fully start within %START_WAIT_SECONDS% seconds.
echo.
echo Diagnostic information:
echo   Backend log:  %LOG_DIR%\backend.out.log
echo   Backend error: %LOG_DIR%\backend.err.log
echo   Frontend log:  %LOG_DIR%\frontend.out.log
echo   Frontend error: %LOG_DIR%\frontend.err.log
echo.
echo If this is the first run, go run may still be compiling.
echo Try increasing START_WAIT_SECONDS or run the services manually:
echo   cd backend ^&^& set HTTP_ADDR=:%BACKEND_PORT% ^&^& set ALLOWED_ORIGIN=http://%FRONTEND_ADDR% ^&^& go run ./cmd/api
echo   cd frontend ^&^& set VITE_DEV_PORT=%FRONTEND_PORT% ^&^& set VITE_API_PROXY_TARGET=http://%BACKEND_ADDR% ^&^& npm run dev -- --host 127.0.0.1 --port %FRONTEND_PORT%
goto done_fail

:stop
call :kill_port %FRONTEND_PORT% "frontend"
call :kill_port %BACKEND_PORT% "backend"
del "%LOG_DIR%\run_backend.bat" 2>nul
del "%LOG_DIR%\run_frontend.bat" 2>nul
goto done_ok

:restart
call :kill_port %FRONTEND_PORT% "frontend"
call :kill_port %BACKEND_PORT% "backend"
del "%LOG_DIR%\run_backend.bat" 2>nul
del "%LOG_DIR%\run_frontend.bat" 2>nul
call :sleep1
goto start

:status
echo.
echo Enterprise Demo status
echo.
call :print_port %BACKEND_PORT% "Backend" "http://%BACKEND_ADDR%"
call :print_port %FRONTEND_PORT% "Frontend" "http://%FRONTEND_ADDR%"
call :print_port 5432 "PostgreSQL" "localhost:5432"
call :print_port 6379 "Redis" "localhost:6379"
goto done_ok

:check_tools
where go >nul 2>nul
if errorlevel 1 (
  echo Go command was not found. Please install Go or add it to PATH.
  exit /b 1
)
where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo npm.cmd was not found. Please install Node.js or add npm to PATH.
  exit /b 1
)
if not exist "%FRONTEND_DIR%\node_modules" (
  echo Frontend dependencies were not found. Run:
  echo   cd frontend
  echo   npm install
  exit /b 1
)
exit /b 0

:require_port
call :find_port %~1
if defined PORT_PID (
  echo %~2 is available on port %~1: PID %PORT_PID%.
  exit /b 0
)
echo %~2 is not listening on port %~1.
echo Start local %~2 first, or run manually:
echo   docker compose up -d
exit /b 1

:kill_port
call :find_port %~1
if not defined PORT_PID (
  echo %~2 is not running on port %~1.
  goto :eof
)
echo Stopping %~2 on port %~1: PID %PORT_PID% ...
taskkill /PID %PORT_PID% /T /F
goto :eof

:print_port
call :find_port %~1
if defined PORT_PID (
  echo %~2: running at %~3 - PID %PORT_PID%
  goto :eof
)
echo %~2: stopped ^(port %~1 not in use^)
goto :eof

:find_port
set "PORT_PID="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%~1 .*LISTENING"') do (
  set "PORT_PID=%%P"
  goto :eof
)
goto :eof

:sleep1
"%PING_EXE%" -n 2 127.0.0.1 >nul
goto :eof

:menu
echo.
echo Enterprise Demo Manager
echo.
echo   1. Start
echo   2. Stop
echo   3. Restart
echo   4. Status
echo   5. Exit
echo.
set "ED_CHOICE="
set /p "ED_CHOICE=Choose an option [1-5]: "
if "%ED_CHOICE%"=="1" goto start
if "%ED_CHOICE%"=="2" goto stop
if "%ED_CHOICE%"=="3" goto restart
if "%ED_CHOICE%"=="4" goto status
if "%ED_CHOICE%"=="5" exit /b 0
echo Invalid option: %ED_CHOICE%
goto menu

:done_ok
if defined ED_MENU (
  echo.
  pause
  goto menu
)
exit /b 0

:done_fail
if defined ED_MENU (
  echo.
  pause
  goto menu
)
exit /b 1

:help
echo Usage: %~nx0 start ^| stop ^| restart ^| status
exit /b 1
