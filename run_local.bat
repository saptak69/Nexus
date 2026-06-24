@echo off
echo Starting Nexus - Real-Time Communication Platform...

REM 1. Start Spring Boot Backend in H2 database mode (out-of-the-box)
echo [Nexus] Launching Java Spring Boot Backend (Port 8080)...
start "Nexus Backend" cmd /k "cd backend && mvnw.cmd spring-boot:run"

REM 2. Start React Frontend
echo [Nexus] Installing dependencies and starting React Vite Frontend (Port 5173)...
start "Nexus Frontend" cmd /k "cd frontend && npm install && npm run dev"

echo [Nexus] Startup commands initiated!
echo - Backend will be available at http://localhost:8080
echo - Frontend will be available at http://localhost:5173
echo - H2 Console (in-memory db) is available at http://localhost:8080/h2-console (JDBC URL: jdbc:h2:file:./data/nexus_db, Username: sa, Password: <empty>)
echo.
echo Press any key to exit this launcher window.
pause > null
