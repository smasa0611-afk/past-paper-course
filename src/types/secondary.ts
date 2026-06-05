export type SecondaryTargetKey = "todai" | "kyodai" | "nagoya" | "hamamatsu_medical";

export type SecondaryEnrollment = {
  studentId: string;
  targetKey: SecondaryTargetKey;
  targetName: string;
  subscribed: boolean;
  note?: string;
};

export type SecondaryVideoCourse = {
  targetKey: SecondaryTargetKey;
  category: string;
  title: string;
  teacher: string;
};
