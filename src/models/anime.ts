export interface ImageResource {
  jpg: {
    image_url: string;
    small_image_url?: string;
    large_image_url?: string;
  };
  webp?: {
    image_url: string;
    small_image_url?: string;
    large_image_url?: string;
  };
}

export interface MalUrl {
  mal_id: number;
  type: string;
  name: string;
  url: string;
}

export interface Title {
  type: string;
  title: string;
}

export interface DateRange {
  from: string | null;
  to: string | null;
  prop: {
    from: { day: number | null; month: number | null; year: number | null };
    to: { day: number | null; month: number | null; year: number | null };
  };
  string: string;
}

export interface PersonMeta {
  mal_id: number;
  url: string;
  images: { jpg: { image_url: string } };
  name: string;
}

export interface AnimeMeta {
  mal_id: number;
  url: string;
  images: ImageResource;
  title: string;
}

export interface Relation {
  relation: string;
  entry: MalUrl[];
}

export interface Anime {
  mal_id: number;
  url: string;
  images: ImageResource;
  trailer: {
    youtube_id: string | null;
    url: string | null;
    embed_url: string | null;
    images: {
      image_url: string | null;
      small_image_url: string | null;
      medium_image_url: string | null;
      large_image_url: string | null;
      maximum_image_url: string | null;
    };
  };
  approved: boolean;
  titles: Title[];
  title: string;
  title_english: string | null;
  title_japanese: string | null;
  title_synonyms: string[];
  type: string | null;
  source: string | null;
  episodes: number | null;
  status: string | null;
  airing: boolean;
  aired: DateRange;
  duration: string | null;
  rating: string | null;
  score: number | null;
  scored_by: number | null;
  rank: number | null;
  popularity: number | null;
  members: number | null;
  favorites: number | null;
  synopsis: string | null;
  background: string | null;
  season: string | null;
  year: number | null;
  continuing?: boolean;
  broadcast: {
    day: string | null;
    time: string | null;
    timezone: string | null;
    string: string | null;
  };
  producers: MalUrl[];
  licensors: MalUrl[];
  studios: MalUrl[];
  genres: MalUrl[];
  explicit_genres: MalUrl[];
  themes: MalUrl[];
  demographics: MalUrl[];
  relations?: Relation[];
  theme?: {
    openings: string[];
    endings: string[];
  };
  external?: { name: string; url: string }[];
  streaming?: { name: string; url: string }[];
}
