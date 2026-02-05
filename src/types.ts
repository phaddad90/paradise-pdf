export interface FileEntry {
  path: string;
  name: string;
}

export interface PreviewResult {
  preview_names: string[];
  placeholder_found: boolean;
  overwrite_warnings: string[];
}

export interface RenameResult {
  renamed: number;
  failed: { path: string; error: string }[];
}

export interface SplitPreviewItem {
  output_name: string;
  page_range: string;
}

export interface SplitPreviewResult {
  source_name: string;
  page_count: number;
  parts: SplitPreviewItem[];
}
