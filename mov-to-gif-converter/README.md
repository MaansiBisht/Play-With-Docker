# MOV to GIF Converter

A web-based tool that converts macOS screen recordings (.mov) into optimized GIFs using FFmpeg's two-pass palette generation method for high-quality output.

![MOV to GIF Converter](https://img.shields.io/badge/FFmpeg-Powered-green)
![React](https://img.shields.io/badge/React-18-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3-cyan)

## Features

- **Drag & Drop Upload** - Easy file upload with drag-and-drop support
- **High-Quality GIFs** - Uses FFmpeg's palette generation for optimal color reproduction
- **Progress Tracking** - Real-time conversion progress based on FFmpeg logs
- **Batch Processing** - Convert multiple files at once
- **Customizable Settings** - Adjust FPS (5-30) and width (200-1920px)
- **Preview & Download** - View generated GIF and download with one click
- **Size Reduction Info** - Shows original vs. output file size comparison
- **FFmpeg Detection** - Automatically checks for FFmpeg installation

## Tech Stack

- **Frontend**: React + TypeScript + TailwindCSS + Vite
- **Backend**: Node.js + Express
- **Video Processing**: FFmpeg (CLI execution)
- **Icons**: Lucide React

## Prerequisites

### FFmpeg Installation

FFmpeg must be installed on your system:

**macOS (Homebrew):**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt-get install ffmpeg
```

**Windows:**
Download from [https://ffmpeg.org/download.html](https://ffmpeg.org/download.html)

## Quick Start

### Docker-First Approach (Recommended)

The application is designed to run entirely through Docker - no need to manage separate frontend/backend servers.

#### Development Mode

```bash
cd mov-to-gif-converter

# Start with hot-reload
npm run dev
# OR
make dev

# Access at http://localhost:3000
```

#### Production Mode

```bash
cd mov-to-gif-converter

# Build and run production image
npm run prod
# OR
make prod

# Access at http://localhost:3001
```

#### Management Commands

```bash
# Stop all containers
npm run stop
# OR
make stop

# View logs
npm run logs
# OR
make logs

# Clean everything (containers, images, volumes)
npm run clean
# OR
make clean
```

### Option 2: Manual Local Development

If you prefer running servers manually (not recommended):

```bash
cd mov-to-gif-converter

# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Start backend
cd backend && npm run dev

# Start frontend (new terminal)
cd frontend && npm run dev

# Frontend: http://localhost:3000
# Backend: http://localhost:3001
```

## Project Structure

```
mov-to-gif-converter/
├── backend/
│   ├── src/
│   │   ├── index.js          # Express server & API routes
│   │   └── converter.js      # FFmpeg conversion logic
│   ├── package.json
│   └── Dockerfile.dev
├── frontend/
│   ├── src/
│   │   ├── App.tsx           # Main React component
│   │   ├── api.ts            # API client functions
│   │   ├── types.ts          # TypeScript interfaces
│   │   ├── main.tsx          # React entry point
│   │   └── index.css         # Tailwind styles
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── Dockerfile.dev
├── docker-compose.yml        # Production Docker config
├── docker-compose.dev.yml    # Development Docker config
├── Dockerfile                # Production multi-stage build
├── .dockerignore
├── .gitignore
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ffmpeg-check` | Check if FFmpeg is installed |
| POST | `/api/convert` | Upload and convert single file |
| POST | `/api/convert-batch` | Upload and convert multiple files |
| GET | `/api/progress/:id` | Get conversion progress |
| GET | `/api/download/:id` | Download converted GIF |

## FFmpeg Pipeline

The converter uses a two-pass method for optimal GIF quality:

**Step 1: Palette Generation**
```bash
ffmpeg -i input.mov -vf "fps=15,scale=900:-1:flags=lanczos,palettegen" palette.png
```

**Step 2: GIF Generation**
```bash
ffmpeg -i input.mov -i palette.png -filter_complex "fps=15,scale=900:-1:flags=lanczos[x];[x][1:v]paletteuse" output.gif
```

## Configuration Options

| Option | Default | Range | Description |
|--------|---------|-------|-------------|
| FPS | 15 | 5-30 | Frames per second |
| Width | 900 | 200-1920 | Output width in pixels (height auto-scales) |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3001 | Backend server port |
| `NODE_ENV` | development | Environment mode |

## Troubleshooting

### FFmpeg not found
- Ensure FFmpeg is installed and in your PATH
- Restart your terminal after installation
- On macOS, try `which ffmpeg` to verify installation

### Large file uploads failing
- Default limit is 500MB
- Modify `multer` config in `backend/src/index.js` if needed

### Conversion taking too long
- Reduce FPS setting
- Reduce width setting
- Large/long videos naturally take longer

## License

MIT License
