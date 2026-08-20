import { useState } from "react";
import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { Download, FileJson, FileSpreadsheet, Archive, Images } from "lucide-react";

const TABLES = [
  "profiles",
  "user_roles",
  "drivers",
  "jobs",
  "store_locations",
  "job_titles",
  "driver_sessions",
  "driver_checklist_logs",
  "driver_locations",
  "notifications",
  "lead_submissions",
] as const;

type TableName = (typeof TABLES)[number];

const BUCKET = "job-proofs";

function stamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

function toCSV(rows: any[]): string {
  if (!rows.length) return "";
  const cols: string[] = Array.from(
    rows.reduce((s: Set<string>, r) => { Object.keys(r).forEach((k) => s.add(k)); return s; }, new Set<string>())
  );
  const esc = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

async function fetchTable(table: TableName): Promise<any[]> {
  const out: any[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase.from(table as any).select("*").range(from, from + page - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < page) break;
  }
  return out;
}

// Recursively list every object in the bucket, keeping the folder structure.
async function listAllFiles(prefix = ""): Promise<string[]> {
  const paths: string[] = [];
  const limit = 100;
  for (let offset = 0; ; offset += limit) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    for (const item of data) {
      const full = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null && !item.metadata) paths.push(...(await listAllFiles(full)));
      else paths.push(full);
    }
    if (data.length < limit) break;
  }
  return paths;
}

export default function Backup() {
  const [selected, setSelected] = useState<TableName[]>([...TABLES]);
  const [includeImages, setIncludeImages] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [note, setNote] = useState("");

  const toggle = (t: TableName) =>
    setSelected((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]));

  const loadAll = async () => {
    const result: Record<string, any[]> = {};
    let done = 0;
    for (const t of selected) {
      setNote(`Reading ${t}…`);
      result[t] = await fetchTable(t);
      done += 1;
      setProgress(Math.round((done / selected.length) * 100));
    }
    return result;
  };

  const run = async (mode: "json" | "csv" | "zip") => {
    if (!selected.length) {
      toast({ title: "Select at least one table", variant: "destructive" });
      return;
    }
    setBusy(mode);
    setProgress(0);
    setNote("");
    try {
      const data = await loadAll();
      const ts = stamp();

      if (mode === "json") {
        saveBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), `jodha-backup-${ts}.json`);
      } else if (mode === "csv") {
        const zip = new JSZip();
        for (const [t, rows] of Object.entries(data)) zip.file(`csv/${t}.csv`, toCSV(rows));
        saveBlob(await zip.generateAsync({ type: "blob" }), `jodha-backup-csv-${ts}.zip`);
      } else {
        const zip = new JSZip();
        zip.file(
          "manifest.json",
          JSON.stringify(
            { created_at: new Date().toISOString(), tables: Object.fromEntries(Object.entries(data).map(([t, r]) => [t, r.length])), images_included: includeImages, bucket: BUCKET },
            null,
            2
          )
        );
        for (const [t, rows] of Object.entries(data)) {
          zip.file(`json/${t}.json`, JSON.stringify(rows, null, 2));
          zip.file(`csv/${t}.csv`, toCSV(rows));
        }

        if (includeImages) {
          setNote("Listing storage files…");
          const files = await listAllFiles();
          let i = 0;
          for (const path of files) {
            i += 1;
            setNote(`Downloading image ${i}/${files.length}`);
            setProgress(Math.round((i / Math.max(files.length, 1)) * 100));
            const { data: blob, error } = await supabase.storage.from(BUCKET).download(path);
            if (error || !blob) continue;
            // keep identical bucket path so restore maps 1:1 to DB URLs
            zip.file(`storage/${BUCKET}/${path}`, blob);
          }
        }

        setNote("Compressing…");
        saveBlob(await zip.generateAsync({ type: "blob" }), `jodha-full-backup-${ts}.zip`);
      }
      toast({ title: "Backup ready", description: "Your download has started." });
    } catch (e: any) {
      toast({ title: "Backup failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
      setProgress(0);
      setNote("");
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold">Backup &amp; Export</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Download a complete copy of your database and proof images.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tables</CardTitle>
          <CardDescription>Choose what to include in the export.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {TABLES.map((t) => (
            <label key={t} className="flex items-center gap-2 text-sm">
              <Checkbox checked={selected.includes(t)} onCheckedChange={() => toggle(t)} />
              <span className="truncate">{t}</span>
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Images</CardTitle>
          <CardDescription>
            Proof images are stored under <code>{BUCKET}/</code> and are exported with the exact same file names and
            folder structure, so they can be restored directly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={includeImages} onCheckedChange={(v) => setIncludeImages(!!v)} />
            <span className="flex items-center gap-1"><Images className="h-4 w-4" /> Include storage images in the full ZIP</span>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Download</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => run("json")} disabled={!!busy} variant="outline">
              <FileJson className="h-4 w-4 mr-2" /> {busy === "json" ? "Exporting…" : "JSON"}
            </Button>
            <Button onClick={() => run("csv")} disabled={!!busy} variant="outline">
              <FileSpreadsheet className="h-4 w-4 mr-2" /> {busy === "csv" ? "Exporting…" : "CSV (zip)"}
            </Button>
            <Button onClick={() => run("zip")} disabled={!!busy}>
              <Archive className="h-4 w-4 mr-2" /> {busy === "zip" ? "Exporting…" : "Full backup (ZIP)"}
            </Button>
          </div>
          {busy && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Download className="h-3 w-3" /> {note || "Working…"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
