import { PersonMeta } from "./anime";
import { AnimeMeta } from "./anime";
import { MangaMeta } from "./manga";

export interface CharacterMeta {
  mal_id: number;
  url: string;
  images: {
    jpg: { image_url: string };
    webp?: { image_url: string; small_image_url?: string };
  };
  name: string;
}

export interface CharacterImages {
  jpg: { image_url: string | null };
  webp?: { image_url: string | null; small_image_url?: string | null };
}

export interface Character {
  mal_id: number;
  url: string;
  images: CharacterImages;
  name: string;
  name_kanji: string | null;
  nicknames: string[];
  favorites: number;
  about: string | null;
}

export interface CharacterAnimeEntry {
  role: string;
  anime: AnimeMeta;
}

export interface CharacterMangaEntry {
  role: string;
  manga: MangaMeta;
}

export interface CharacterVoiceEntry {
  language: string;
  person: PersonMeta;
}

export interface CharacterFull extends Character {
  anime: CharacterAnimeEntry[];
  manga: CharacterMangaEntry[];
  voices: CharacterVoiceEntry[];
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
