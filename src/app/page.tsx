"use client";

import { MainLayout } from "@/components/layout/MainLayout";
import { TaskView } from "@/components/views/TaskView";

export default function HomePage() {
  return (
    <MainLayout>
      <TaskView />
    </MainLayout>
  );
}
