import type { Metadata } from "next";
import { Suspense } from "react";
import { ArticleDetail } from "@/components/content/content-pages";
import { PageLoading } from "@/components/ui/misc";

export const metadata: Metadata = { title: "News" };

export default function ArticlePage() {
  return (
    <Suspense fallback={<PageLoading label="Loading article" />}>
      <ArticleDetail />
    </Suspense>
  );
}
