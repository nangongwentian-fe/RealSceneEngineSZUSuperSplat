# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SuperSplat is a web-based 3D Gaussian Splat editor built with TypeScript and PlayCanvas. It allows users to inspect, edit, optimize, and publish 3D Gaussian Splats directly in the browser.

## Development Commands

### Build and Development
- `npm install` - Install dependencies (first run `git submodule update --init`)
- `npm run develop` - Build and serve locally with hot reload (debug mode, available at http://localhost:3000)
- `npm run build` - Production build
- `npm run watch` - Watch for changes and rebuild
- `npm run serve` - Start local server

### Code Quality
- `npm run lint` - Run ESLint on source files

### Build Configuration
- Debug builds: `cross-env BUILD_TYPE=debug npm run build`
- Profile builds: `cross-env BUILD_TYPE=profile npm run build`
- Release builds: Default or `cross-env BUILD_TYPE=release npm run build`

## Architecture

### Core Components

The application follows a modular architecture with clear separation of concerns:

- **Scene Management** (`src/scene.ts`): Central scene orchestrator managing the PlayCanvas app, layers, and rendering
- **Splat System** (`src/splat.ts`): Core 3D Gaussian Splat implementation with GPU-accelerated rendering
- **UI System** (`src/ui/`): PCUI-based interface components for editing and visualization
- **Tools** (`src/tools/`): Selection and transformation tools (move, rotate, scale, various selection modes)
- **Serialization** (`src/serialize/`): Custom PLY format handling and compression
- **Shaders** (`src/shaders/`): WebGL/WebGPU shaders for splat rendering and effects

### Key Design Patterns

1. **Event-Driven Architecture**: Central event system (`src/events.ts`) for decoupled communication
2. **Tool Manager Pattern**: Unified tool management for selection and transformation operations
3. **State Management**: Dual state system for before/after comparisons and undo/redo
4. **GPU Acceleration**: Texture-based state storage for splat properties and transformations

### File Organization

- `/src` - Main TypeScript source code
  - `/ui` - UI components and panels
  - `/tools` - Interactive editing tools
  - `/shaders` - WebGL shader implementations
  - `/serialize` - File format handlers
  - `/anim` - Animation utilities
- `/static` - Static assets (images, icons, libraries)
- `/submodules/supersplat-viewer` - Viewer dependency (built separately)
- `/dist` - Build output directory

### Dependencies

- **PlayCanvas Engine**: 3D rendering and scene management
- **PCUI**: UI component framework
- **JSZip**: File compression for exports
- **mp4-muxer**: Video export functionality
- **i18next**: Internationalization support

### Build System

Uses Rollup with TypeScript compilation:
- Separate builds for main app and service worker
- SCSS compilation with PostCSS/Autoprefixer
- Debug/Profile/Release build modes
- Source maps in all modes

## Important Notes

- The application runs entirely in the browser with no server-side processing
- Service worker (`src/sw.ts`) handles file operations and caching
- WebGL 2.0 or WebGPU required for rendering
- Supports PLY file format for Gaussian Splats
- Custom compression format for optimized file sizes