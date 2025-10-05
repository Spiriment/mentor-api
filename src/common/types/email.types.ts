export interface EmailSection {
  type: "text" | "list" | "table" | "alert";
  title?: string;
}

export interface TextSection extends EmailSection {
  type: "text";
  content: string;
}

export interface ListSection extends EmailSection {
  type: "list";
  items: string[];
}

export interface TableSection extends EmailSection {
  type: "table";
  headers?: string[];
  rows: string[][];
}

export interface AlertSection extends EmailSection {
  type: "alert";
  level: "info" | "success" | "warning" | "error";
  content: string;
}

export type DynamicEmailSection =
  | TextSection
  | ListSection
  | TableSection
  | AlertSection;

export interface DynamicEmailData {
  title: string;
  sections: DynamicEmailSection[];
}

export interface DynamicEmailOptions {
  to: string;
  subject: string;
  data: DynamicEmailData;
}
