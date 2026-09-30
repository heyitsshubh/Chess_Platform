<div align="center">

# ♟ Chess Platform

**A production-grade, real-time multiplayer chess platform built as a TypeScript monorepo.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-9.7-F69220?style=flat-square&logo=pnpm&logoColor=white)](https://pnpm.io/)
[![Turborepo](https://img.shields.io/badge/Turborepo-2.x-EF4444?style=flat-square&logo=turborepo&logoColor=white)](https://turbo.build/)
[![Expo](https://img.shields.io/badge/Expo-53-000020?style=flat-square&logo=expo&logoColor=white)](https://expo.dev/)
[![Material Design 3](https://img.shields.io/badge/Material_Design_3-React_Native_Paper-6750A4?style=flat-square&logo=materialdesign&logoColor=white)](https://callstack.github.io/react-native-paper/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

[Architecture](#architecture) · [Services](#services) · [Mobile Client](#-mobile-client-appsmobile-app) · [Tech Stack](#tech-stack) · [Getting Started](#getting-started) · [Testing & Bot](#bot-testing-utility) · [API Reference](#api-reference)

</div>

---

## Overview

Chess Platform is a full-stack, microservice-based chess application built with production engineering principles. It features a **Material Design 3 React Native mobile client**, two independently deployable **backend microservices**, a custom **bitboard chess engine**, a **gRPC inter-service communication layer**, and an **event-driven architecture** backed by Apache Kafka.

The monorepo is managed with **pnpm** and orchestrated by **Turborepo** for parallel execution, strict type-safety, and unified React 19 overrides.

---

## 📱 Application Screenshots

<div align="center">

| Lobby & Matchmaking Dashboard | Interactive Live Game & Move Validation |
| :---: | :---: |
| <img src="docs/screenshots/lobby.jpg" width="340" alt="Lobby Screen" /> | <img src="docs/screenshots/game.jpg" width="340" alt="Live Game Screen" /> |

</div>

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Mobile Client (Expo)                         │
│     React Native · Material Design 3 (Paper) · Expo Router · Zustand │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTP/REST + WebSocket
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      NGINX API Gateway (:80)                        │
│            Reverse Proxy · Rate Limiting · WebSocket Upgrade        │
│                                                                     │
│    /auth/*  ─────────────────────────────────► Auth Service (:3001) │
│    /game/*  ─────────────────────────────────► Game Service (:3002) │
│    /socket.io/*  ────────────────────────────► Game Service (:3002) │
└─────────────────────────────────────────────────────────────────────┘
                     │                          │
          ┌──────────┘                          └──────────┐
          ▼                                               ▼
┌──────────────────────┐   gRPC (:50051)   ┌──────────────────────────┐
│    Auth Service      │ ◄────────────────► │     Game Service         │
│                      │                    │                          │
│  Express + JWT       │                    │  Express + Socket.IO     │
│  Prisma + Postgres   │                    │  Prisma + Postgres       │
│  Redis (sessions)    │                    │  Redis (queues/pub-sub)  │
│  Resend (email)      │                    │  Kafka (event sourcing)  │
│  bcrypt + zod        │                    │  Chess Engine            │
└──────────────────────┘                    └──────────────────────────┘
          │                                               │
          ▼                                               ▼
  ┌───────────────┐                            ┌──────────────────────┐
  │  chess_auth_db│                            │  chess_game_db       │
  │  (PostgreSQL) │                            │  (PostgreSQL)        │
  └───────────────┘                            └──────────────────────┘
                          ┌──────────────┐
                          │    Redis     │  ← Shared cache + queue
                          └──────────────┘
                          ┌──────────────┐
                          │    Kafka     │  ← Event bus (game events)
                          └──────────────┘
```

### Key Architectural Highlights

| Feature | Engineering Implementation |
|---------|----------------------------|
| **Microservices** | Auth and Game domains are fully isolated; each service owns its Postgres DB & Prisma schema. |
| **Material Design 3 UI** | Built with `react-native-paper` featuring a dark mode palette, surface elevations, and interactive chips/badges. |
| **gRPC Inter-service RPC** | High-performance gRPC connection (`:50051`) for Game Service to fetch player ELO directly from Auth Service. |
| **Bitboard Chess Engine** | Custom 64-bit bitboard engine (`@chess/engine`) handling FEN parsing, 16-bit move encoding, and move generation. |
| **NGINX Gateway** | Single entry point (`:80`) proxying REST endpoints and upgrading Socket.IO WebSockets cleanly. |
| **Monorepo Overrides** | Unified single-version React 19 (`react` & `react-dom`) pnpm overrides preventing duplicate module instances in Metro. |

---

## Monorepo Structure

```
chess-platform/
├── apps/
│   ├── auth-service/          ← Auth microservice (Express, Prisma, gRPC server, Resend)
│   ├── game-service/          ← Game microservice (Express, Socket.IO, gRPC client, Redis)
│   └── mobile-app/            ← React Native mobile app (Expo Router v5, Material Design 3)
│
├── packages/
│   ├── chess-engine/          ← Custom bitboard chess engine (FEN, perft, legal moves)
│   ├── shared-grpc/           ← Protobuf definitions + generated TypeScript stubs
│   ├── shared-errors/         ← Typed error classes (AppError, AuthError, ValidationError)
│   ├── shared-logger/         ← Pino structured logger
│   └── shared-config/         ← ESLint + Prettier shared rules
│
├── docker/
│   ├── docker-compose.yml     ← PostgreSQL, Redis, Kafka, Zookeeper, NGINX
│   └── nginx/
│       └── nginx.conf         ← Reverse proxy + WebSocket upgrade configuration
│
├── scripts/
│   └── bot_play.js            ← Automated test bot script for instant single-handed dev testing
│
├── turbo.json                 ← Turborepo pipeline configuration
├── pnpm-workspace.yaml        ← Workspace package discovery
└── package.json               ← Root package scripts + dev tooling
```

---

## Services

### 🔐 Auth Service (`apps/auth-service`)

Handles user registration, login, token refresh, and user profile management.

**Key Features:**
- Registration with transactional email support via **Resend SDK**
- JWT access tokens + HTTP-only refresh cookies
- gRPC server exposing `getUserInfo` RPC on port **50051**
- Rate limiting per IP via Redis store
- PostgreSQL database (`chess_auth_db`)

**Core Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/auth/register` | Register a new user |
| `POST` | `/auth/login` | Login and receive JWT access token |
| `GET`  | `/auth/me` | Fetch profile of authenticated user |
| `POST` | `/auth/refresh` | Refresh access token using cookie |
| `POST` | `/auth/logout` | Invalidate user session |

---

### 🎮 Game Service (`apps/game-service`)

Handles real-time matchmaking, live WebSocket gameplay, and move verification.

**Key Features:**
- Socket.IO server with JWT authentication middleware
- Redis-backed matchmaking queue per time control (`1|0`, `3|0`, `5|0`, `10|0`)
- gRPC client fetching player ELO from Auth Service upon queue pairing
- Bitboard move validation using `@chess/engine`
- PostgreSQL database (`chess_game_db`) for game history

**Socket.IO Events:**

| Direction | Event | Payload / Description |
|-----------|-------|-----------------------|
| Client → Server | `matchmaking:join` | `timeControl: string` (e.g. `'3|0'`) |
| Client → Server | `matchmaking:leave` | Cancel matchmaking search |
| Server → Client | `matchmaking:matched` | `{ gameId, white, black, fen }` |
| Client → Server | `game:move` | `{ gameId, move: number }` (packed 16-bit move) |
| Server → Client | `game:move_made` | `{ fen, whiteTime, blackTime }` |
| Client → Server | `game:resign` | Resign current active game |
| Server → Client | `game:end` | `{ winner, reason }` |

---

### 📱 Mobile Client (`apps/mobile-app`)

A modern, high-performance React Native app built with **Expo SDK 53** and **Material Design 3 (`react-native-paper`)**.

**UI & Feature Highlights:**
- **Material Design 3 Dark Theme**: Purple/gold accent palette with surface elevation levels.
- **Interactive Inputs**: Material `AuthInput` with trailing eye icons for password toggles.
- **Lobby Screen**: User avatar, ELO score card, Win/Loss/Draw chips, and time control selector (`Bullet`, `Blitz`, `Rapid`).
- **Interactive Chess Board**: 
  - Dynamic `uiToEngine` coordinate translation (`a1` to `h8` mapping).
  - Real-time **legal move dot highlights** generated directly by `@chess/engine`.
  - Automatic board rotation when playing as Black.
- **Live Game Screen**: Turn status badges, countdown clocks, game-over result cards, and resignation dialogs.

---

## Tech Stack

### Backend & Core
- **Node.js** 20+ & **TypeScript** 5.8 (Strict Mode)
- **Express 4** (REST APIs)
- **Socket.IO 4** (WebSocket server)
- **Prisma 5** (PostgreSQL ORM)
- **PostgreSQL 14** & **Redis 7**
- **Apache Kafka 7.5** (Event Bus)
- **gRPC + Protocol Buffers** (Inter-service RPC)
- **Vitest** (Unit Testing)

### Mobile App
- **React Native** & **Expo SDK 53**
- **Material Design 3** (`react-native-paper` 5)
- **Expo Router v5** (File-based navigation)
- **Zustand 5** (State Management)
- **Axios** & **Socket.IO Client**

---

## Getting Started

### 1. Prerequisites

- **Node.js** ≥ 20.0.0
- **pnpm** ≥ 9.0.0 (`npm install -g pnpm`)
- **Docker Desktop** (for Postgres, Redis, NGINX, Kafka)
- **Expo Go** app on your iOS / Android phone (or an emulator)

### 2. Clone & Install

```bash
git clone https://github.com/heyitsshubh/Chess_backend.git
cd Chess_backend
pnpm install
```

### 3. Start Infrastructure

```bash
cd docker
docker-compose up -d
```
*Starts PostgreSQL (`:5432`), Redis (`:6379`), NGINX (`:80`), Kafka (`:9092`), and Zookeeper (`:2181`).*

### 4. Database Setup

```bash
# Push Prisma schema to PostgreSQL databases
pnpm --filter @chess/auth-service exec prisma db push
pnpm --filter @chess/game-service exec prisma db push
```

### 5. Start Backend Services

```bash
# Start all microservices via Turborepo
pnpm dev
```
- **Auth Service**: `http://localhost:3001`
- **Game Service**: `http://localhost:3002`
- **NGINX Gateway**: `http://localhost:80`

---

## Bot Testing Utility

To test real-time matchmaking and gameplay single-handedly on your computer without needing a second physical device:

1. **Start the Mobile App** on your phone / emulator:
   ```bash
   cd apps/mobile-app
   npx expo start -c
   ```
2. Press **"Find a Game"** on `3 min Blitz` in the app.
3. Run the automated opponent bot in your computer terminal:
   ```bash
   pnpm bot:play
   ```
   *The bot instantly registers, logs in, joins the queue, matches with your phone, and starts the game!*

---

## Running Tests & Typecheck

```bash
# Run full typecheck across all 8 monorepo packages
pnpm typecheck

# Run unit tests across all services
pnpm test
```

---

## License

Distributed under the **MIT License**. See `LICENSE` for details.

<div align="center">

Built with ♟ by **heyitsshubh**

</div>
