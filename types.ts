
export interface ThumbnailData {
  id: string; // For React key prop
  url: string; // base64 data URL
  altText: string;
}

export interface ArtisticStyle {
  id: string; // e.g., 'cinematic', 'pixel-art'
  name: string; // e.g., 'Cinematic', 'Pixel Art'
}
