import axios from 'axios';
import { ConversionStatus, FfmpegStatus, ConversionOptions } from './types';

const API_BASE = '/api';

export async function checkFfmpeg(): Promise<FfmpegStatus> {
  const response = await axios.get(`${API_BASE}/ffmpeg-check`);
  return response.data;
}

export async function uploadAndConvert(
  file: File,
  options: ConversionOptions
): Promise<{ conversionId: string; originalName: string; originalSize: number }> {
  const formData = new FormData();
  formData.append('video', file);
  formData.append('fps', options.fps.toString());
  formData.append('width', options.width.toString());

  const response = await axios.post(`${API_BASE}/convert`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
}

export async function uploadBatch(
  files: File[],
  options: ConversionOptions
): Promise<{ conversions: Array<{ conversionId: string; originalName: string; originalSize: number }> }> {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('videos', file);
  });
  formData.append('fps', options.fps.toString());
  formData.append('width', options.width.toString());

  const response = await axios.post(`${API_BASE}/convert-batch`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
}

export async function getProgress(conversionId: string): Promise<ConversionStatus> {
  const response = await axios.get(`${API_BASE}/progress/${conversionId}`);
  return { conversionId, ...response.data };
}

export function getDownloadUrl(conversionId: string): string {
  return `${API_BASE}/download/${conversionId}`;
}
