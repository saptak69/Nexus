# Nexus — Real-Time Communication Platform

Nexus is a full-stack communications hub combining instant text messaging, file sharing, and real-time WebRTC video calls in a glassmorphic dark interface.

## 📁 Repository Structure
* **`backend/`**: Java Spring Boot application (Spring Security, Spring WebSocket, JPA, PostgreSQL).
* **`frontend/`**: React Vite TypeScript application (Zustand, Tailwind CSS, Framer Motion, WebRTC).

## 🚀 Quick Start Guide

### 1. PostgreSQL Database
The application connects to `postgresql://localhost:5432/nexus_db`. Ensure your PostgreSQL server is running and the database exists.

### 2. Run the Java Spring Boot Backend
```bash
cd backend
.\mvnw.cmd spring-boot:run
```
* Serves the REST API and WebSocket connection on `http://localhost:8080`.

### 3. Run the React Frontend
```bash
cd frontend
npm install
npm run dev
```
* Serves the client console on `http://localhost:5173`.

---

For details on the system architecture, unified WebSocket protocol, and database mappings, see [setup_and_architecture.md](file:///C:/Users/admin/.gemini/antigravity-cli/brain/ab154ffc-2f1c-49d1-957c-10e40d20c897/setup_and_architecture.md).
