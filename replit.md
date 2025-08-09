# replit.md

## Overview
This project is a Node.js web application with an Express backend and a React frontend, designed to provide a comprehensive bot management system. Its core purpose is to manage Minecraft bots using the Mineflayer library, offering real-time control, configuration, and monitoring through a web interface. The application aims for a user-friendly, aesthetically pleasing interface with a specific "pink/cute" theme, targeting users in Vietnam with localized content. It envisions enabling advanced bot functionalities like autonomous exploration, self-defense, and AI-driven interactions, creating a unique and engaging experience for managing in-game automation.

## User Preferences
Preferred communication style: Simple, everyday language.
Vietnamese language for UI text and communications.
Pink/cute aesthetic theme with kawaii/anime styling.
Auto-playing background music with controls.
Integration of user's social media links (Facebook and YouTube).

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Routing**: Wouter
- **State Management**: TanStack Query (React Query)
- **UI Framework**: shadcn/ui components on Radix UI primitives
- **Styling**: Tailwind CSS with custom CSS variables
- **Form Handling**: React Hook Form with Zod validation
- **Aesthetic**: Pink gradients, cute animations, kawaii-inspired design elements.

### Backend
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js for REST API
- **Database ORM**: Drizzle ORM
- **Database Provider**: Neon Database (serverless PostgreSQL)
- **Bot Integration**: Mineflayer library for Minecraft bot functionality
- **Validation**: Zod schemas
- **Session Storage**: PostgreSQL-based session storage using `connect-pg-simple`

### Data Storage
- **Database**: PostgreSQL
- **Schema**: Users (id, username, password), Bots (server, status, behavior settings, uptime tracking)
- **ORM**: Drizzle ORM with type-safe queries and migrations
- **Monorepo Structure**: Shared types and schemas between frontend and backend.
- **In-Memory Storage Fallback**: Supports in-memory storage for development without a database.

### Key Features & Components
- **API Endpoints**: CRUD for bots, start/stop bot, update bot config.
- **Bot Management**: Real-time status (online, offline, connecting, error), configurable movement patterns (random, follow, stay, custom), auto-reconnection, chat toggles, response delay, uptime monitoring.
- **Web Console**: WebSocket-based real-time console for bot interaction and logging.
- **Advanced Bot Features**: Kawaii personality, auto-greetings, dance performance, random movement, health monitoring, advanced chat interactions, intelligent exploration (pathfinding, looting, obstacle avoidance), hostile mob detection and combat, item collection, self-defense system.
- **UI Components**: BotCard, BotConfigModal, MusicPlayer, VipPricing.

### Core Architectural Decisions
- **Real-time Bot Management**: Utilizes Mineflayer for actual Minecraft bot connections.
- **Shared Validation**: Zod schemas ensure consistent validation across client and server.
- **Modern React Patterns**: Leverages React Query for server state management.
- **Concurrent Server Execution**: Designed to run web server and bot environment simultaneously.
- **Process Management**: Includes mechanisms for preventing duplicate bot logins and ensuring process stability.

## External Dependencies

- **@neondatabase/serverless**: Serverless PostgreSQL driver for Neon Database.
- **mineflayer**: Minecraft bot framework for connecting to servers.
- **drizzle-orm**: Type-safe ORM for PostgreSQL.
- **@tanstack/react-query**: Server state management and caching.
- **@radix-ui/***: Headless UI components.
- **tailwindcss**: Utility-first CSS framework.
- **shadcn/ui**: Pre-built UI components.
- **lucide-react**: Icon library.
- **class-variance-authority**: Utility for component variants.
- **tsx**: TypeScript execution for development.
- **esbuild**: Fast JavaScript bundler.
- **drizzle-kit**: Database migration and schema management.
- **mineflayer-pathfinder**: For bot navigation and pathfinding.
- **concurrently**: For running multiple Node.js processes simultaneously.