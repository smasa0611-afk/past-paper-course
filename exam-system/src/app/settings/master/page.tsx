import { Suspense } from "react";
import MasterManagementLayout from "@/components/admin/masters/MasterManagementLayout";
import SystemAdminOnly from "@/components/SystemAdminOnly";

export default function MasterPage() {
  return (
    <SystemAdminOnly>
      <Suspense fallback={<div className="min-h-screen bg-slate-50 px-6 py-10 text-slate-700">読み込み中...</div>}>
        <MasterManagementLayout />
      </Suspense>
    </SystemAdminOnly>
  );
}
