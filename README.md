# Nexus — Enterprise Real-Time Communication Platform

[![Backend CI/CD](https://github.com/saptak69/Nexus/actions/workflows/ci.yml/badge.svg)](https://github.com/saptak69/Nexus/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.3.0-brightgreen.svg)](https://spring.io/projects/spring-boot)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://reactjs.org/)
[![Docker](https://img.shields.io/badge/Docker-Supported-blue.svg)](https://www.docker.com/)

Nexus is a full-stack real-time communications hub featuring instant text messaging, channels, server groups, media sharing, and WebRTC peer-to-peer audio/video calls served via a beautiful glassmorphic dark interface.

---

## 📁 Repository Structure

```
├── backend/                  # Java Spring Boot application (Security, WebSockets, Actuator, OpenAPI)
│   ├── src/main/java         # Java application source code
│   ├── src/test/java         # JUnit 5 & Mockito test suite
│   ├── Dockerfile            # Multi-stage production JRE container
│   └── pom.xml               # Maven configuration
├── frontend/                 # React Vite TypeScript application (Zustand, Tailwind CSS, WebRTC)
│   ├── src/                  # React components & Zustand stores
│   ├── Dockerfile            # Multi-stage build (Node -> Nginx)
│   └── nginx.conf            # Nginx SPA router configuration
├── docker-compose.yml        # Docker Compose configuration (PostgreSQL, Backend, Frontend)
└── README.md                 # Production architecture documentation
```

---

## 🏗️ System Architecture

Nexus is built with a highly decoupled, service-oriented architecture designed to handle concurrent data connections and low-latency audio/video feeds.

```mermaid
graph TD
    Client[React Client (Zustand)] <-->|1. HTTP / REST APIs| Auth[Spring Boot Controllers]
    Client <-->|2. WS Connection / signaling| WS[WebSocket Controller]
    
    subgraph WebRTC Signaling & Media Flow
        ClientA[Client A] <-->|3. Signaling: SDP & ICE| WS
        ClientB[Client B] <-->|3. Signaling: SDP & ICE| WS
        ClientA <==|4. Peer-to-Peer Media Channel| ClientB
    end

    subgraph Backend Core
        Auth -->|Spring JPA| DB[(PostgreSQL Database)]
        WS -->|Memory Registry| Sessions[WebSocket Session Registry]
    end
```

---

## 🛡️ Production Security Hardening

1. **HttpOnly & Secure Cookies**: Authentication tokens (JWT) are sent in secure `HttpOnly`, `SameSite=None`, `Secure` cookies. This mitigates **Cross-Site Scripting (XSS)** token theft vectors.
2. **In-Memory JWT Token Bootstrap**: The React client bootstraps its session by calling `/api/auth/refresh` on initialization to retrieve the JWT to memory, ensuring no tokens are persisted in `localStorage`.
3. **CORS Validation**: Cross-Origin Resource Sharing is configured to restrict origins to verified domains, allowing developer environments (`localhost`) while blocking unauthorized domains.
4. **Centralized Exception Mappings**: A centralized `@RestControllerAdvice` translates unchecked errors into clean, consistent JSON payloads, hiding verbose stack traces from consumers.

---

## 🚀 Quick Start Guide

### Option 1: Docker Compose (Zero Configuration)
Ensure you have Docker and Docker Compose installed:
```bash
docker-compose up --build
```
* **Frontend**: `http://localhost:3000`
* **Backend REST API / Swagger UI**: `http://localhost:8080` / `http://localhost:8080/swagger-ui.html`
* **Prometheus Metrics**: `http://localhost:8080/actuator/prometheus`

### Option 2: Local Development

#### Prerequisites
* JDK 21
* Node.js v20+
* PostgreSQL running locally (default: `postgresql://localhost:5432/nexus_db`)

#### 1. Setup Environment Configuration
Copy env template files and update the configuration variables (e.g. database credentials, Cloudinary tokens):
```bash
# In backend/src/main/resources/
cp application.properties.example application.properties

# In frontend/
cp .env.example .env
```

#### 2. Run the Java Spring Boot Backend
```bash
cd backend
./mvnw clean test
./mvnw spring-boot:run
```

#### 3. Run the React Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## 📈 Scalability & Production Readiness

### 1. Scaling to 10,000+ Concurrent Users
* **WebSocket Horizontal Scaling**: WebSocket connections are stateful. To scale, we distribute sessions across multiple nodes and use a **Redis Pub/Sub** message broker to distribute and synchronize events across different servers.
* **Presence Synchronization**: Presence (Online, Away, DND) is synchronized using a high-throughput cache like Redis. When a user connects/disconnects, presence is updated in Redis and broadcasted to subscribed peers.
* **Database Optimization**: Connection pooling is managed using HikariCP. Critical queries utilize indexes on foreign keys (`sender_id`, `recipient_id`, `server_id`) to ensure sub-millisecond retrieval.

### 2. Message Ordering Guarantees
* Messages are stamped with monotonically increasing sequence IDs at the database level using auto-incrementing primary keys or UUIDs ordered by creation timestamp.
* For distributed queues, a partition key like `conversation_id` is used so that messages in the same channel are processed in order by the same message broker thread.

---

## 📞 WebRTC Resilience & Network Traversal

Nexus WebRTC features are designed to handle real-world mobile networks:
1. **Network Traversal (STUN/TURN)**: The client configures a Google public STUN server for NAT traversal. In restricted corporate networks or symmetric NAT firewalls, the signaling configuration falls back to a **Coturn TURN Server** to relay media traffic.
2. **ICE Reconnection & Restart**: The client monitors the `iceConnectionState`. If it transitions to `failed` or `disconnected` due to IP address changes (e.g., switching from Wi-Fi to cellular data), the client automatically initiates an **ICE Restart** to rebuild the connection without hanging up.
3. **Adaptive Bitrate & Packet Loss**: Google WebRTC automatically implements FEC (Forward Error Correction) and adaptive bitrate control via RTCP feedbacks (NACK, PLI) to degrade quality gracefully in low-bandwidth networks.

---

## 📊 Monitoring & Observability
Nexus exposes internal telemetry for operations teams:
* **Metrics**: Available at `/actuator/metrics` and formatted for Prometheus scraping at `/actuator/prometheus`.
* **Health Checks**: Endpoint `/actuator/health` monitors DB connectivity and disk space.
* **Structured Logging**: Logging levels are configurable per package to capture verbose signaling issues or keep production logs concise.
