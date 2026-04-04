export interface ConversionStatus {
  conversionId: string;
  progress: number;
  status: 'processing' | 'completed' | 'error';
  originalName: string;
  originalSize: number;
  outputSize?: number;
  duration?: number;
  downloadUrl?: string;
  sizeReduction?: string;
  error?: string;
}

export interface FfmpegStatus {
  installed: boolean;
  version?: string;
  message?: string;
  instructions?: {
    macos: string;
    linux: string;
    windows: string;
  };
}

export interface ConversionOptions {
  fps: number;
  width: number;
}

export interface FileWithPreview extends File {
  preview?: string;
}
