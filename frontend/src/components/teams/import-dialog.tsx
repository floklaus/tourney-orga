"use client";

import { useState, type ChangeEvent } from "react";
import { api } from "@/lib/api";
import type { ImportMode, ImportResult } from "@/lib/types";
import { Alert, ErrorAlert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SelectField, TextAreaField } from "@/components/ui/field";

const T = {
  title: "Import teams from CSV",
  columns: "Columns: name,contactName,email,ccEmails,graduationYear — separate multiple CC emails with “;”. An empty graduationYear keeps the current value.",
  file: "CSV file",
  paste: "Or paste CSV",
  mode: "Existing team names",
  preview: "Check (dry run)",
  commit: "Import",
};

export function ImportDialog({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: (r: ImportResult) => void }) {
  return (
    <Dialog open={open} onClose={onClose} title={T.title} size="lg" description={T.columns}>
      <ImportForm onClose={onClose} onImported={onImported} />
    </Dialog>
  );
}

function ImportForm({ onClose, onImported }: { onClose: () => void; onImported: (r: ImportResult) => void }) {
  const [csv, setCsv] = useState("");
  const [mode, setMode] = useState<ImportMode>("create");
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState<"preview" | "commit" | null>(null);
  const [error, setError] = useState<unknown>(null);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setCsv(await file.text());
    setPreview(null);
  }

  async function run(dryRun: boolean) {
    setBusy(dryRun ? "preview" : "commit");
    setError(null);
    try {
      const result = await api.post<ImportResult>("/teams/import", { csv, mode, dryRun });
      if (dryRun) setPreview(result);
      else onImported(result);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  }

  const canCommit = preview !== null && preview.errors.length === 0 && preview.created + preview.updated > 0;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="csv-file" className="block text-sm font-medium text-slate-800">
          {T.file}
        </label>
        <input id="csv-file" type="file" accept=".csv,text/csv" onChange={handleFile} className="block text-sm text-slate-800" />
      </div>
      <TextAreaField
        label={T.paste}
        rows={6}
        className="font-mono"
        value={csv}
        onChange={(e) => {
          setCsv(e.target.value);
          setPreview(null);
        }}
        placeholder={"name,contactName,email,ccEmails,graduationYear\nFC Example,Jane Doe,jane@example.org,coach@example.org,2031"}
      />
      <SelectField
        label={T.mode}
        value={mode}
        onChange={(e) => {
          setMode(e.target.value as ImportMode);
          setPreview(null);
        }}
      >
        <option value="create">Report as error (create new teams only)</option>
        <option value="upsert">Update existing teams (update or create)</option>
      </SelectField>

      <ErrorAlert error={error} />
      {preview && <ImportPreview result={preview} />}

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="secondary" onClick={() => run(true)} loading={busy === "preview"} disabled={!csv.trim() || busy !== null}>
          {T.preview}
        </Button>
        <Button onClick={() => run(false)} loading={busy === "commit"} disabled={!canCommit || busy !== null}>
          {T.commit}
        </Button>
      </div>
    </div>
  );
}

function ImportPreview({ result }: { result: ImportResult }) {
  if (result.errors.length > 0) {
    return (
      <Alert tone="error" title={`${result.errors.length} row(s) have errors. Fix them and check again.`}>
        <ul className="max-h-40 list-disc space-y-0.5 overflow-y-auto pl-5">
          {result.errors.map((e, i) => (
            <li key={i}>
              Row {e.row}: {e.message}
            </li>
          ))}
        </ul>
      </Alert>
    );
  }
  return (
    <Alert tone="success" title="Ready to import">
      {result.created} team(s) will be created and {result.updated} updated.
    </Alert>
  );
}
