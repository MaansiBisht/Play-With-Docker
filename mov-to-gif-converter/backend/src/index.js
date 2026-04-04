const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { checkFfmpeg, convertMovToGif, getConversionProgress } = require('./converter');

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure directories exist
const uploadsDir = path.join(__dirname, '../uploads');
const outputDir = path.join(__dirname, '../output');
const tempDir = path.join(__dirname, '../temp');

[uploadsDir, outputDir, tempDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use('/output', express.static(outputDir));

// Serve static frontend in production
if (process.env.NODE_ENV === 'production') {
  const publicDir = path.join(__dirname, '../public');
  app.use(express.static(publicDir));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/output')) {
      res.sendFile(path.join(publicDir, 'index.html'));
    }
  });
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.mov') {
    cb(null, true);
  } else {
    cb(new Error('Only .mov files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit
});

// Store active conversions for progress tracking
const activeConversions = new Map();

// Routes

// Check if FFmpeg is installed
app.get('/api/ffmpeg-check', async (req, res) => {
  try {
    const result = await checkFfmpeg();
    res.json(result);
  } catch (error) {
    res.status(500).json({ installed: false, error: error.message });
  }
});

// Upload and convert file
app.post('/api/convert', upload.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const conversionId = uuidv4();
  const inputPath = req.file.path;
  const outputFilename = `${conversionId}.gif`;
  const outputPath = path.join(outputDir, outputFilename);
  const palettePath = path.join(tempDir, `${conversionId}_palette.png`);

  // Get options from request
  const fps = parseInt(req.body.fps) || 15;
  const width = parseInt(req.body.width) || 900;

  // Store conversion info
  activeConversions.set(conversionId, {
    progress: 0,
    status: 'processing',
    inputPath,
    outputPath,
    palettePath,
    originalName: req.file.originalname,
    originalSize: req.file.size
  });

  // Start conversion in background
  convertMovToGif(inputPath, outputPath, palettePath, fps, width, (progress) => {
    const conversion = activeConversions.get(conversionId);
    if (conversion) {
      conversion.progress = progress;
    }
  })
    .then((result) => {
      const conversion = activeConversions.get(conversionId);
      if (conversion) {
        conversion.status = 'completed';
        conversion.progress = 100;
        conversion.outputSize = result.outputSize;
        conversion.duration = result.duration;
      }
      // Clean up input file
      fs.unlink(inputPath, () => {});
    })
    .catch((error) => {
      const conversion = activeConversions.get(conversionId);
      if (conversion) {
        conversion.status = 'error';
        conversion.error = error.message;
      }
      // Clean up files on error
      fs.unlink(inputPath, () => {});
      fs.unlink(palettePath, () => {});
    });

  res.json({
    conversionId,
    message: 'Conversion started',
    originalName: req.file.originalname,
    originalSize: req.file.size
  });
});

// Get conversion progress
app.get('/api/progress/:conversionId', (req, res) => {
  const { conversionId } = req.params;
  const conversion = activeConversions.get(conversionId);

  if (!conversion) {
    return res.status(404).json({ error: 'Conversion not found' });
  }

  const response = {
    progress: conversion.progress,
    status: conversion.status,
    originalName: conversion.originalName,
    originalSize: conversion.originalSize
  };

  if (conversion.status === 'completed') {
    response.outputSize = conversion.outputSize;
    response.duration = conversion.duration;
    response.downloadUrl = `/output/${conversionId}.gif`;
    response.sizeReduction = ((1 - conversion.outputSize / conversion.originalSize) * 100).toFixed(1);
  }

  if (conversion.status === 'error') {
    response.error = conversion.error;
  }

  res.json(response);
});

// Download GIF
app.get('/api/download/:conversionId', (req, res) => {
  const { conversionId } = req.params;
  const conversion = activeConversions.get(conversionId);

  if (!conversion || conversion.status !== 'completed') {
    return res.status(404).json({ error: 'File not found or conversion not complete' });
  }

  const outputPath = path.join(outputDir, `${conversionId}.gif`);
  const downloadName = conversion.originalName.replace('.mov', '.gif');

  res.download(outputPath, downloadName);
});

// Batch upload and convert
app.post('/api/convert-batch', upload.array('videos', 10), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  const fps = parseInt(req.body.fps) || 15;
  const width = parseInt(req.body.width) || 900;

  const conversions = req.files.map(file => {
    const conversionId = uuidv4();
    const inputPath = file.path;
    const outputFilename = `${conversionId}.gif`;
    const outputPath = path.join(outputDir, outputFilename);
    const palettePath = path.join(tempDir, `${conversionId}_palette.png`);

    activeConversions.set(conversionId, {
      progress: 0,
      status: 'processing',
      inputPath,
      outputPath,
      palettePath,
      originalName: file.originalname,
      originalSize: file.size
    });

    // Start conversion
    convertMovToGif(inputPath, outputPath, palettePath, fps, width, (progress) => {
      const conversion = activeConversions.get(conversionId);
      if (conversion) {
        conversion.progress = progress;
      }
    })
      .then((result) => {
        const conversion = activeConversions.get(conversionId);
        if (conversion) {
          conversion.status = 'completed';
          conversion.progress = 100;
          conversion.outputSize = result.outputSize;
          conversion.duration = result.duration;
        }
        fs.unlink(inputPath, () => {});
      })
      .catch((error) => {
        const conversion = activeConversions.get(conversionId);
        if (conversion) {
          conversion.status = 'error';
          conversion.error = error.message;
        }
        fs.unlink(inputPath, () => {});
        fs.unlink(palettePath, () => {});
      });

    return {
      conversionId,
      originalName: file.originalname,
      originalSize: file.size
    };
  });

  res.json({ conversions });
});

// Cleanup old files periodically (every hour)
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  
  [outputDir, tempDir].forEach(dir => {
    fs.readdir(dir, (err, files) => {
      if (err) return;
      files.forEach(file => {
        const filePath = path.join(dir, file);
        fs.stat(filePath, (err, stats) => {
          if (err) return;
          if (stats.mtimeMs < oneHourAgo) {
            fs.unlink(filePath, () => {});
          }
        });
      });
    });
  });
}, 60 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
