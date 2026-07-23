// =====================================================================
// Content Manifest — registry of source JSON files to import
// To add a new file: drop it in /upload and add an entry here.
// =====================================================================

export interface SourceManifestEntry {
  slug: string;
  path: string;
}

export const SOURCE_MANIFEST: SourceManifestEntry[] = [
  { slug: "question_set_1", path: "upload/question_set_1.json" },
  { slug: "question_set_2", path: "upload/question_set_2.json" },
  // Future files:
  // { slug: "question_set_3", path: "upload/question_set_3.json" },
];
