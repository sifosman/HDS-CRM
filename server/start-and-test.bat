@echo off
echo Starting Freecut Server and Testing Email...
echo.

REM Start the server
echo Starting server on port 3000...
start cmd /k "npm run dev"

REM Wait for server to start
echo Waiting for server to start...
timeout /t 5 /nobreak >nul

REM Test email connection
echo Testing email service connection...
curl http://localhost:3000/api/email/test-email-connection

REM Test hardcoded email
echo.
echo Testing email to sifosman@gmail.com...
curl http://localhost:3000/api/email-hardcoded/quick-test

echo.
echo Server should be running at http://localhost:3000
echo Test emails sent to sifosman@gmail.com
echo.
pause
