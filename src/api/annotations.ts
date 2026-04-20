import type Database from "better-sqlite3";

export interface AnnotationRecord {
  id: number;
  date: string;
  kind: string;
  label: string;
  created_at: string;
  updated_at: string;
}

export interface AnnotationInput {
  date: string;
  kind: string;
  label: string;
}

export function listAnnotations(db: Database.Database): AnnotationRecord[] {
  return db.prepare(
    `
      SELECT id, date, kind, label, created_at, updated_at
      FROM annotations
      ORDER BY date DESC, created_at DESC
    `
  ).all() as AnnotationRecord[];
}

export function createAnnotation(db: Database.Database, input: AnnotationInput): AnnotationRecord {
  const normalized = normalizeInput(input);
  const result = db.prepare(
    `
      INSERT INTO annotations (date, kind, label)
      VALUES (?, ?, ?)
    `
  ).run(normalized.date, normalized.kind, normalized.label);

  return getAnnotation(db, Number(result.lastInsertRowid));
}

export function updateAnnotation(
  db: Database.Database,
  id: number,
  input: Partial<AnnotationInput>
): AnnotationRecord {
  const existing = getOptionalAnnotation(db, id);
  if (!existing) {
    throw new Error("Annotation not found");
  }

  const normalized = normalizeInput({
    date: input.date ?? existing.date,
    kind: input.kind ?? existing.kind,
    label: input.label ?? existing.label
  });

  db.prepare(
    `
      UPDATE annotations
      SET date = ?, kind = ?, label = ?, updated_at = datetime('now')
      WHERE id = ?
    `
  ).run(normalized.date, normalized.kind, normalized.label, id);

  return getAnnotation(db, id);
}

export function deleteAnnotation(db: Database.Database, id: number): { ok: true } {
  const result = db.prepare("DELETE FROM annotations WHERE id = ?").run(id);
  if (!result.changes) {
    throw new Error("Annotation not found");
  }
  return { ok: true };
}

function getAnnotation(db: Database.Database, id: number): AnnotationRecord {
  const annotation = getOptionalAnnotation(db, id);
  if (!annotation) {
    throw new Error("Annotation not found");
  }
  return annotation;
}

function getOptionalAnnotation(db: Database.Database, id: number): AnnotationRecord | null {
  return (
    (db.prepare(
      `
        SELECT id, date, kind, label, created_at, updated_at
        FROM annotations
        WHERE id = ?
        LIMIT 1
      `
    ).get(id) as AnnotationRecord | undefined) ?? null
  );
}

function normalizeInput(input: AnnotationInput): AnnotationInput {
  const date = typeof input.date === "string" ? input.date.trim() : "";
  const kind = typeof input.kind === "string" ? input.kind.trim().toLowerCase() : "";
  const label = typeof input.label === "string" ? input.label.trim() : "";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Annotation date must be in YYYY-MM-DD format");
  }
  if (!kind) {
    throw new Error("Annotation kind is required");
  }
  if (!label) {
    throw new Error("Annotation label is required");
  }

  return { date, kind, label };
}
