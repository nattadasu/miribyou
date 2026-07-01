import { PersonMeta } from "./anime";

export interface CharacterMeta {
  mal_id: number;
  url: string;
  images: {
    jpg: { image_url: string };
    webp?: { image_url: string; small_image_url?: string };
  };
  name: string;
}

export interface AnimeCharacter {
  character: CharacterMeta;
  role: string;
  favorites: number;
  voice_actors: {
    person: PersonMeta;
    language: string;
  }[];
}

export interface MangaCharacter {
  character: CharacterMeta;
  role: string;
}
