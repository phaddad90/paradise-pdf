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
  error?: string;
  debug_info?: string;
}

export interface PageBoxes {
  page_number: number;
  media_box: string | null;
  crop_box: string | null;
  bleed_box: string | null;
  trim_box: string | null;
  art_box: string | null;
}

export interface PageMetadata {
  page_number: number;
  is_landscape: boolean;
}

export type PageAction =
  | { type: "existing"; page_number: number }
  | { type: "blank" };

export interface PdfPage {
  id: string; // Front-end only unique ID
  type: "existing" | "blank";
  page_number?: number;
  preview?: string; // Data URL or path
}

export interface StatusMessage {
  type: "success" | "error" | "info";
  text: string;
}

export interface CompressionSettings {
  image_quality: number;
  max_resolution_dpi: number;
  reduce_color_complexity: boolean;
  clip_invisible: boolean;
  force_recompression: boolean;
  remove_unused_fonts: boolean;
  convert_to_cff: boolean;
  merge_font_programs: boolean;
  remove_annotations: boolean;
  flatten_form_fields: boolean;
  remove_metadata: boolean;
  remove_thumbnails: boolean;
  remove_application_data: boolean;
  remove_structure_tree: boolean;
}

export interface CompressionResult {
  original_size: number;
  compressed_size: number;
  success: boolean;
}
export interface PdfDiagnosticResult {
  header: string;
  trailer: string;
  file_size: number;
}

export interface PdfProperties {
  version: string;
  page_count: number;
  page_size: string;
  metadata: { [key: string]: string };
  created: string;
  modified: string;
  encrypted: boolean;
  producer: string;
  creator: string;
  fonts: string[];
  image_dpi: number[];
  doc_dpi: number;
}
