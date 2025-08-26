"use client";

import dynamic from "next/dynamic";
import { EditPageSkeleton } from "@/components/edit-skeleton";

const ClipEditor = dynamic(() => import("@/components/editor"), {
  ssr: false,
  loading: () => <EditPageSkeleton />,
});

export default ClipEditor;
