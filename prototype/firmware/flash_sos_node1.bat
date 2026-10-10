@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
echo ============================================================
echo   Flash SOS Node1 onto the ESP32 with arduino-cli
echo ============================================================
where arduino-cli >nul 2>nul || (echo arduino-cli not found in PATH. Put arduino-cli.exe in this folder or add it to PATH. & pause & exit /b 1)

echo [1/4] ESP32 board support (first time downloads ~300 MB)...
arduino-cli config init --overwrite >nul 2>nul
arduino-cli config add board_manager.additional_urls https://espressif.github.io/arduino-esp32/package_esp32_index.json
arduino-cli core update-index
arduino-cli core list | findstr /i "esp32:esp32" >nul || arduino-cli core install esp32:esp32
if errorlevel 1 (echo Could not install esp32 core. Check internet. & pause & exit /b 1)

echo [2/4] Finding the ESP32 port...
set PORT=%1
if "%PORT%"=="" (
  for /f "tokens=1" %%p in ('arduino-cli board list ^| findstr /i "COM"') do if "!PORT!"=="" set PORT=%%p
)
if "%PORT%"=="" (echo No COM port found. Plug the ESP32 in with a DATA cable / install CP210x or CH340 driver. & arduino-cli board list & pause & exit /b 1)
echo        using %PORT%

echo [3/4] Compiling...
arduino-cli compile --fqbn esp32:esp32:esp32 SOS_Node1_single
if errorlevel 1 (echo Compile failed - copy the red text above to Claude. & pause & exit /b 1)

echo [4/4] Uploading to %PORT%  (if stuck on "Connecting...", HOLD the BOOT button)
arduino-cli upload -p %PORT% --fqbn esp32:esp32:esp32 SOS_Node1_single
if errorlevel 1 (echo Upload failed. Hold BOOT and run again, or close Serial Monitor using %PORT%. & pause & exit /b 1)

echo.
echo DONE. Press EN/RST on the ESP32. Wi-Fi "SOS Node1" appears in ~5 s.
echo Showing node output (Ctrl+C to stop, then run ..\start.bat):
arduino-cli monitor -p %PORT% -c baudrate=115200
