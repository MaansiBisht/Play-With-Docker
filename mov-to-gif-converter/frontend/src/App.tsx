import { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Upload,
  Film,
  Download,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Settings,
  X,
  FileVideo,
  Sparkles,
} from 'lucide-react';
import { checkFfmpeg, uploadAndConvert, uploadBatch, getProgress, getDownloadUrl } from './api';
import { ConversionStatus, FfmpegStatus, ConversionOptions, FileWithPreview } from './types';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function App() {
  const [ffmpegStatus, setFfmpegStatus] = useState<FfmpegStatus | null>(null);
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [conversions, setConversions] = useState<ConversionStatus[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [options, setOptions] = useState<ConversionOptions>({
    fps: 15,
    width: 900,
  });

  useEffect(() => {
    checkFfmpeg().then(setFfmpegStatus).catch(console.error);
  }, []);

  useEffect(() => {
    const activeConversions = conversions.filter((c) => c.status === 'processing');
    if (activeConversions.length === 0) return;

    const interval = setInterval(async () => {
      const updates = await Promise.all(
        activeConversions.map((c) => getProgress(c.conversionId))
      );

      setConversions((prev) =>
        prev.map((c) => {
          const update = updates.find((u) => u.conversionId === c.conversionId);
          return update || c;
        })
      );

      const allDone = updates.every((u) => u.status !== 'processing');
      if (allDone) {
        setIsConverting(false);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [conversions]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const movFiles = acceptedFiles.filter(
      (f) => f.name.toLowerCase().endsWith('.mov')
    ) as FileWithPreview[];

    movFiles.forEach((file) => {
      file.preview = URL.createObjectURL(file);
    });

    setFiles((prev) => [...prev, ...movFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/quicktime': ['.mov'],
    },
    multiple: true,
  });

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const newFiles = [...prev];
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview!);
      }
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const startConversion = async () => {
    if (files.length === 0) return;

    setIsConverting(true);
    setConversions([]);

    try {
      if (files.length === 1) {
        const result = await uploadAndConvert(files[0], options);
        setConversions([
          {
            conversionId: result.conversionId,
            progress: 0,
            status: 'processing',
            originalName: result.originalName,
            originalSize: result.originalSize,
          },
        ]);
      } else {
        const result = await uploadBatch(files, options);
        setConversions(
          result.conversions.map((c) => ({
            conversionId: c.conversionId,
            progress: 0,
            status: 'processing',
            originalName: c.originalName,
            originalSize: c.originalSize,
          }))
        );
      }
      setFiles([]);
    } catch (error) {
      console.error('Conversion error:', error);
      setIsConverting(false);
    }
  };

  const clearCompleted = () => {
    setConversions((prev) => prev.filter((c) => c.status === 'processing'));
  };

  if (ffmpegStatus && !ffmpegStatus.installed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-lg w-full border border-white/20">
          <div className="flex items-center gap-3 text-red-400 mb-4">
            <AlertCircle className="w-8 h-8" />
            <h1 className="text-2xl font-bold">FFmpeg Not Found</h1>
          </div>
          <p className="text-gray-300 mb-6">
            FFmpeg is required to convert videos. Please install it using one of the following methods:
          </p>
          <div className="space-y-4">
            <div className="bg-black/30 rounded-lg p-4">
              <p className="text-purple-400 font-medium mb-2">macOS (Homebrew)</p>
              <code className="text-green-400 text-sm">{ffmpegStatus.instructions?.macos}</code>
            </div>
            <div className="bg-black/30 rounded-lg p-4">
              <p className="text-purple-400 font-medium mb-2">Linux (Ubuntu/Debian)</p>
              <code className="text-green-400 text-sm">{ffmpegStatus.instructions?.linux}</code>
            </div>
            <div className="bg-black/30 rounded-lg p-4">
              <p className="text-purple-400 font-medium mb-2">Windows</p>
              <code className="text-green-400 text-sm break-all">{ffmpegStatus.instructions?.windows}</code>
            </div>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 rounded-lg transition-colors"
          >
            Check Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Film className="w-10 h-10 text-purple-400" />
            <h1 className="text-4xl font-bold text-white">MOV to GIF</h1>
            <Sparkles className="w-10 h-10 text-purple-400" />
          </div>
          <p className="text-gray-400">
            Convert macOS screen recordings to optimized GIFs
          </p>
          {ffmpegStatus?.version && (
            <p className="text-xs text-gray-500 mt-1">
              FFmpeg {ffmpegStatus.version}
            </p>
          )}
        </div>

        {/* Settings Panel */}
        <div className="mb-6">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <Settings className="w-5 h-5" />
            <span>Conversion Settings</span>
          </button>

          {showSettings && (
            <div className="mt-4 bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    FPS (frames per second)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="30"
                    value={options.fps}
                    onChange={(e) =>
                      setOptions({ ...options, fps: parseInt(e.target.value) || 15 })
                    }
                    className="w-full bg-black/30 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Lower = smaller file, less smooth</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Width (pixels)
                  </label>
                  <input
                    type="number"
                    min="200"
                    max="1920"
                    step="100"
                    value={options.width}
                    onChange={(e) =>
                      setOptions({ ...options, width: parseInt(e.target.value) || 900 })
                    }
                    className="w-full bg-black/30 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Height scales automatically</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Drop Zone */}
        <div
          {...getRootProps()}
          className={`
            relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer
            transition-all duration-300 ease-out
            ${
              isDragActive
                ? 'border-purple-400 bg-purple-500/20 scale-[1.02]'
                : 'border-white/20 bg-white/5 hover:border-purple-400/50 hover:bg-white/10'
            }
          `}
        >
          <input {...getInputProps()} />
          <Upload
            className={`w-16 h-16 mx-auto mb-4 transition-colors ${
              isDragActive ? 'text-purple-400' : 'text-gray-400'
            }`}
          />
          <p className="text-xl font-medium text-white mb-2">
            {isDragActive ? 'Drop your files here' : 'Drag & drop .mov files'}
          </p>
          <p className="text-gray-400">or click to browse</p>
        </div>

        {/* Selected Files */}
        {files.length > 0 && (
          <div className="mt-6 space-y-3">
            <h3 className="text-lg font-medium text-white">Selected Files</h3>
            {files.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-4 bg-white/5 backdrop-blur-lg rounded-xl p-4 border border-white/10"
              >
                <FileVideo className="w-10 h-10 text-purple-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{file.name}</p>
                  <p className="text-sm text-gray-400">{formatBytes(file.size)}</p>
                </div>
                <button
                  onClick={() => removeFile(index)}
                  className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ))}

            <button
              onClick={startConversion}
              disabled={isConverting}
              className="w-full mt-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-4 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {isConverting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Converting...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Convert {files.length} {files.length === 1 ? 'File' : 'Files'}
                </>
              )}
            </button>
          </div>
        )}

        {/* Conversions */}
        {conversions.length > 0 && (
          <div className="mt-8 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-white">Conversions</h3>
              {conversions.some((c) => c.status !== 'processing') && (
                <button
                  onClick={clearCompleted}
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Clear completed
                </button>
              )}
            </div>

            {conversions.map((conversion) => (
              <div
                key={conversion.conversionId}
                className="bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    {conversion.status === 'processing' && (
                      <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                    )}
                    {conversion.status === 'completed' && (
                      <CheckCircle2 className="w-8 h-8 text-green-400" />
                    )}
                    {conversion.status === 'error' && (
                      <AlertCircle className="w-8 h-8 text-red-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">
                      {conversion.originalName}
                    </p>

                    {conversion.status === 'processing' && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-sm text-gray-400 mb-1">
                          <span>Converting...</span>
                          <span>{Math.round(conversion.progress)}%</span>
                        </div>
                        <div className="h-2 bg-black/30 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                            style={{ width: `${conversion.progress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {conversion.status === 'completed' && (
                      <div className="mt-2 space-y-2">
                        <div className="flex flex-wrap gap-4 text-sm">
                          <span className="text-gray-400">
                            Original: <span className="text-white">{formatBytes(conversion.originalSize)}</span>
                          </span>
                          <span className="text-gray-400">
                            GIF: <span className="text-white">{formatBytes(conversion.outputSize || 0)}</span>
                          </span>
                          {conversion.sizeReduction && parseFloat(conversion.sizeReduction) > 0 && (
                            <span className="text-green-400">
                              {conversion.sizeReduction}% smaller
                            </span>
                          )}
                          {conversion.duration && (
                            <span className="text-gray-400">
                              Time: <span className="text-white">{conversion.duration.toFixed(1)}s</span>
                            </span>
                          )}
                        </div>

                        {conversion.downloadUrl && (
                          <div className="mt-4">
                            <img
                              src={conversion.downloadUrl}
                              alt="Generated GIF"
                              className="max-w-full max-h-64 rounded-lg border border-white/10"
                            />
                          </div>
                        )}

                        <a
                          href={getDownloadUrl(conversion.conversionId)}
                          download
                          className="inline-flex items-center gap-2 mt-3 bg-green-600 hover:bg-green-700 text-white font-medium px-4 py-2 rounded-lg transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          Download GIF
                        </a>
                      </div>
                    )}

                    {conversion.status === 'error' && (
                      <p className="mt-2 text-red-400 text-sm">
                        {conversion.error || 'Conversion failed'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <footer className="mt-12 text-center text-gray-500 text-sm">
          <p>Uses FFmpeg with optimized palette generation for high-quality GIFs</p>
        </footer>
      </div>
    </div>
  );
}

export default App;
