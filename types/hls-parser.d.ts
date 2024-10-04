declare module 'hls-parser' {
  export interface Playlist {
    version?: number;
    targetDuration?: number;
    mediaSequence?: number;
    segments?: Segment[];
    keys?: Key[];
    playlists?: Playlist[];
    [key: string]: any; // Allow additional properties
  }

  export interface Segment {
    uri: string;
    duration?: number;
    title?: string;
    programDateTime?: string;
    key?: Key;
    [key: string]: any; // Allow additional properties
  }

  export interface Key {
    method?: string;
    uri?: string;
    iv?: string;
    keyFormat?: string;
    keyFormatVersions?: string;
    [key: string]: any; // Allow additional properties
  }

  export function parse(playlistText: string): Playlist;
  export function stringify(playlist: Playlist, type?: string): string;
  export const types: {
    MASTER_PLAYLIST: string;
    MEDIA_PLAYLIST: string;
  };
}