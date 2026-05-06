# Fortress Sentinel: Last Stand

A top-down defense shooter and management game built with Phaser 3 and TypeScript. Players must defend a fortress while managing unit production in a barracks to push back relentless enemy waves.

## Project Overview

*   **Technologies:** Phaser 3, TypeScript, Vite, Tailwind CSS 4.
*   **Architecture:** Scene-based architecture (`BootScene`, `GameScene`, `UIScene`, `ResultScene`).
*   **Key Systems:**
    *   **Control Modes:** Toggle between `fortress` (active shooting) and `barracks` (adjusting production ratios) using the **TAB** key.
    *   **Weapon Modes:** Three modes (**RAPID**, **BLAST**, **PIERCE**) with unique colors and effects. Switch using **Right Click** or **SPACE**.
    *   **Unit Production:** Barracks automatically produce units based on adjustable ratios (Keys **1/2/3** to increase, **Q/W/E** to decrease).
    *   **Lanes:** Game logic is lane-based (5 lanes defined in `constants.ts`).
    *   **Stalemates:** Units (Friendly vs Enemy) can enter a "stalemate" state upon collision, pausing movement for a duration based on squad size differences.

## Building and Running

### Prerequisites
*   Node.js

### Commands
*   `npm install`: Install dependencies.
*   `npm run dev`: Start the development server (port 3000).
*   `npm run build`: Build the project for production.
*   `npm run lint`: Run TypeScript type checking.
*   `npm run clean`: Remove the `dist` directory.

### Configuration
*   Set `GEMINI_API_KEY` in a `.env.local` file if required by the application logic (referenced in `vite.config.ts`).

## Development Conventions

*   **Scene Organization:**
    *   `BootScene`: Asset preloading and texture generation.
    *   `GameScene`: Core gameplay logic, physics, and state management.
    *   `UIScene`: HUD and overlay elements.
    *   `ResultScene`: Game over/Victory screens.
*   **Entities:** Located in `src/entities.ts`. Classes like `Bullet`, `Enemy`, and `Friendly` extend Phaser GameObjects and include their own `spawn` and `deactivate` logic.
*   **Constants:** Centralized in `src/constants.ts` (screen dimensions, speeds, colors, gameplay balances).
*   **Styling:** Tailwind CSS 4 is used for global styles (`src/index.css`), while Phaser handles all in-game rendering.
*   **Communication:** Scenes and entities communicate primarily via the `GameScene` event bus (`this.events.emit`).

## Key Files
*   `src/main.ts`: Game entry point and configuration.
*   `src/constants.ts`: Global gameplay parameters.
*   `src/entities.ts`: Physics-enabled game objects.
*   `src/scenes/GameScene.ts`: The "brain" of the game.
*   `vite.config.ts`: Vite and Tailwind configuration.
