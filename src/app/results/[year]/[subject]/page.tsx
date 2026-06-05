"use client";

import ScoreAnalysisPage from "@/components/common-test/ScoreAnalysisPage";

export default function CommonTestScoreAnalysisRoute(props: {
  params: Promise<{ year: string; subject: string }>;
}) {
  return <ScoreAnalysisPage params={props.params} />;
}
