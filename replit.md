# MindzWeb - Minecraft Bot Management System

## Project Overview
A web-based Minecraft bot management system with real-time monitoring and control features. The project has been successfully extracted from MindzWeb.zip and replaced all existing files.

## Project Architecture
- **Frontend**: React + TypeScript with Vite
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **UI Components**: Radix UI + Tailwind CSS + shadcn/ui
- **Bot Framework**: Mineflayer for Minecraft Java Edition
- **Real-time**: WebSocket support for live console updates
- **AI Integration**: Google Gemini AI for advanced bot features

## Key Features
- 🤖 Multiple Minecraft bot management
- 🎮 Cute pink kawaii UI theme
- 📊 Real-time bot status monitoring
- 💬 Web-based console for bot interaction
- 🔧 Flexible bot configuration
- 🎵 Background music player
- 📱 Responsive design
- 🌐 VPS simulator page

## Recent Changes
- **2025-08-15**: Successfully extracted BotControl.zip and replaced simple mindz website
- **2025-08-15**: Database configured and web server running on port 5000
- **2025-08-15**: Fixed duplicate function declarations in bot component
- **2025-08-15**: Both web server and bot component now starting successfully
- **2025-08-10**: Successfully extracted and replaced all project files from MindzWeb.zip
- **2025-08-10**: Installed missing dependencies (@google/genai, mineflayer, mineflayer-pathfinder)
- **2025-08-10**: Project structure now includes complete Minecraft bot management system
- **2025-08-10**: MAJOR UPDATE - Comprehensive bot behavior improvements:
  - Enhanced chat delay management (4s interval with queue system)
  - Smart health & food management with automatic recovery
  - Death handling with item recovery system
  - Intelligent mining with torch placement and staircase patterns
  - Smart exploration avoiding leaves and using appropriate tools
  - Chest hunting system with 32-block radius scanning
  - AI-powered building system with Gemini integration
  - Improved player following with precise 1-block distance
  - Enhanced protection mode with patrol patterns
  - Auto equipment management for optimal gear
  - Self-defense system during idle periods
  - Survival skills: auto-feeding, threat avoidance, safe spot finding
- **2025-08-10**: REQUIREMENT #4 COMPLETED - Environment setup and VPS Simulator:
  - Created .env.example with DATA_URL and SECRET_KEY templates
  - Added .env to .gitignore for security
  - Built comprehensive VPS Simulator page with kawaii pink theme
  - Implemented real-time monitoring with CPU, RAM, disk usage
  - Added console interface with command execution
  - Integrated API configuration panel with data URL and secret key management
  - Created navigation link from main page to VPS Simulator (/vps route)

## User Preferences
- Language: Vietnamese (project documentation and UI in Vietnamese)
- Theme: Cute pink kawaii design
- Focus: Minecraft bot automation and management

## Technical Stack
- Node.js 18+
- React 18.3.1
- TypeScript 5.6.3
- Express 4.21.2
- Drizzle ORM 0.39.3
- Mineflayer 4.25.0
- Tailwind CSS 3.4.17
- Vite 5.4.19

## Environment Variables Required
- DATABASE_URL: PostgreSQL connection string
- SESSION_SECRET: For session management
- GOOGLE_API_KEY: Optional, for AI features

## Scripts
- `npm run dev`: Start both web server and bot
- `npm run web`: Start only web server
- `npm run bot`: Start only bot
- `npm run build`: Build for production
- `npm start`: Start production server
- `npm run db:push`: Push database schema changes