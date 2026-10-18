/**
 * Upload limits shared by the import UI and the server.
 *
 * Vercel functions accept request bodies up to 4.5 MB, and uploads go
 * through a Server Action, so files must stay under that (multipart
 * encoding adds overhead, hence 4 MB). Larger sources need direct-to-storage
 * uploads (e.g. Vercel Blob) instead.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const MAX_UPLOAD_LABEL_AR = "٤ ميجابايت";

/** Legacy .doc is not supported: the extractor (mammoth) only reads .docx. */
export const ALLOWED_UPLOAD_EXTENSIONS = [".pdf", ".docx", ".txt", ".md", ".json"];
