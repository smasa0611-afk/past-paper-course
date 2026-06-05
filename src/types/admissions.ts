export type AdmissionRecord = {
  code: string;
  university: string;
  faculty: string;
  department: string;
  method: string;
  schedule: string;
  allotment: number;
  aRate: number;
  bRate: number;
  cRate: number;
  dRate: number;
  searchText: string;
};

export type StudentGoal = {
  id: string;
  studentId: string;
  admissionCode: string;
  university: string;
  faculty: string;
  department: string;
  method: string;
  schedule: string;
  bRate: number;
  createdAt: string;
};

export type UniversityDepartmentRecord = {
  id: string;
  sourceYear: number;
  source: string;
  sourceKind: string;
  installationType: string;
  universityCode: string;
  university: string;
  faculty: string;
  department: string;
  prefecture: string;
  city: string;
  durationYears: number | null;
  admissionCapacity: number | null;
  postalCode: string;
  address: string;
  phone: string;
  searchText: string;
};
