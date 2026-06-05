export type VideoSkill =
  | "reading"
  | "listening"
  | "math_ia"
  | "math_iibc"
  | "japanese_modern_takeuchi"
  | "japanese_modern_kikuma"
  | "japanese_modern_shibata"
  | "japanese_classical_sekijima"
  | "japanese_kanbun_sekijima"
  | "japanese_classical_wada"
  | "world_history"
  | "world_history_new_trends"
  | "japanese_history"
  | "geography"
  | "geography_practice"
  | "physics"
  | "physics_basic"
  | "chemistry"
  | "chemistry_basic"
  | "biology"
  | "biology_basic"
  | "earth_science_basic"
  | "information_i"
  | "politics_economics"
  | "public_civics"
  | "ethics"
  | "secondary_todai"
  | "secondary_kyodai"
  | "secondary_nagoya"
  | "secondary_hamamatsu_medical";

export type VideoProvider = "iframe";

export type VideoLesson = {
  id: string;
  subject: string;
  skill: VideoSkill;
  examType?: string;
  courseName: string;
  teacher: string;
  chapter: string;
  sectionNo: string;
  sectionTitle: string;
  lessonNo: number | null;
  title: string;
  duration: string;
  sequence: number;
  provider: VideoProvider;
  videoId?: string;
  videoUrl?: string;
  materialPdfUrl?: string | null;
  quizId?: string;
  hasQuiz?: boolean;
};

export type VideoLessonListItem = Omit<VideoLesson, "videoId" | "videoUrl">;

export type VideoProgress = {
  userId: string;
  lessonId: string;
  watched: boolean;
  watchedAt: string;
  watchCount: number;
};
