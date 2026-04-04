const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Check if FFmpeg is installed
 */
function checkFfmpeg() {
  return new Promise((resolve) => {
    exec('ffmpeg -version', (error, stdout) => {
      if (error) {
        resolve({
          installed: false,
          message: 'FFmpeg is not installed',
          instructions: {
            macos: 'brew install ffmpeg',
            linux: 'sudo apt-get install ffmpeg',
            windows: 'Download from https://ffmpeg.org/download.html'
          }
        });
      } else {
        const versionMatch = stdout.match(/ffmpeg version (\S+)/);
        resolve({
          installed: true,
          version: versionMatch ? versionMatch[1] : 'unknown'
        });
      }
    });
  });
}

/**
 * Get video duration using ffprobe
 */
function getVideoDuration(inputPath) {
  return new Promise((resolve, reject) => {
    exec(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${inputPath}"`,
      (error, stdout) => {
        if (error) {
          reject(error);
        } else {
          resolve(parseFloat(stdout.trim()));
        }
      }
    );
  });
}

/**
 * Convert MOV to GIF using the two-pass palette method
 */
async function convertMovToGif(inputPath, outputPath, palettePath, fps = 15, width = 900, onProgress) {
  const startTime = Date.now();
  
  // Get video duration for progress calculation
  let duration;
  try {
    duration = await getVideoDuration(inputPath);
  } catch (e) {
    duration = 0;
  }

  // Step 1: Generate palette
  await generatePalette(inputPath, palettePath, fps, width, (progress) => {
    // Palette generation is ~30% of total work
    onProgress(Math.min(progress * 0.3, 30));
  }, duration);

  // Step 2: Generate GIF using palette
  await generateGif(inputPath, palettePath, outputPath, fps, width, (progress) => {
    // GIF generation is ~70% of total work
    onProgress(30 + Math.min(progress * 0.7, 70));
  }, duration);

  // Clean up palette file
  try {
    fs.unlinkSync(palettePath);
  } catch (e) {
    // Ignore cleanup errors
  }

  // Get output file size
  const stats = fs.statSync(outputPath);
  const endTime = Date.now();

  return {
    outputSize: stats.size,
    duration: (endTime - startTime) / 1000
  };
}

/**
 * Step 1: Generate color palette
 */
function generatePalette(inputPath, palettePath, fps, width, onProgress, totalDuration) {
  return new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-i', inputPath,
      '-vf', `fps=${fps},scale=${width}:-1:flags=lanczos,palettegen`,
      palettePath
    ];

    const ffmpeg = spawn('ffmpeg', args);
    let stderr = '';

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
      const progress = parseProgress(data.toString(), totalDuration);
      if (progress !== null) {
        onProgress(progress);
      }
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Palette generation failed: ${stderr}`));
      }
    });

    ffmpeg.on('error', (err) => {
      reject(new Error(`Failed to start FFmpeg: ${err.message}`));
    });
  });
}

/**
 * Step 2: Generate GIF using palette
 */
function generateGif(inputPath, palettePath, outputPath, fps, width, onProgress, totalDuration) {
  return new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-i', inputPath,
      '-i', palettePath,
      '-filter_complex', `fps=${fps},scale=${width}:-1:flags=lanczos[x];[x][1:v]paletteuse`,
      outputPath
    ];

    const ffmpeg = spawn('ffmpeg', args);
    let stderr = '';

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
      const progress = parseProgress(data.toString(), totalDuration);
      if (progress !== null) {
        onProgress(progress);
      }
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`GIF generation failed: ${stderr}`));
      }
    });

    ffmpeg.on('error', (err) => {
      reject(new Error(`Failed to start FFmpeg: ${err.message}`));
    });
  });
}

/**
 * Parse FFmpeg progress from stderr output
 */
function parseProgress(output, totalDuration) {
  if (!totalDuration || totalDuration === 0) return null;

  // Match time=00:00:00.00 pattern
  const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
  if (timeMatch) {
    const hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2]);
    const seconds = parseInt(timeMatch[3]);
    const centiseconds = parseInt(timeMatch[4]);
    
    const currentTime = hours * 3600 + minutes * 60 + seconds + centiseconds / 100;
    const progress = (currentTime / totalDuration) * 100;
    
    return Math.min(progress, 100);
  }
  
  return null;
}

module.exports = {
  checkFfmpeg,
  convertMovToGif,
  getVideoDuration
};
