import * as XLSX from "xlsx";
import { format } from "date-fns";

export type ExportRow = {
  title: string;
  invoice_number: string;
  driver?: string | null;
  status: string;
  priority: string;
  payment_status: string;
  scheduled_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  location?: string | null;
  price?: number | null;
};

const headers = ["Job Title","Invoice","Driver","Status","Priority","Payment","Scheduled Date","Start","End","Location","Price"];

function toRows(jobs: any[]): (string|number)[][] {
  return jobs.map((j) => [
    j.title ?? "",
    j.invoice_number ?? "",
    j.drivers?.full_name ?? "",
    j.status ?? "",
    j.priority ?? "",
    j.payment_status ?? "",
    j.scheduled_date ? format(new Date(j.scheduled_date), "yyyy-MM-dd") : "",
    j.start_time ? format(new Date(j.start_time), "yyyy-MM-dd HH:mm") : "",
    j.end_time ? format(new Date(j.end_time), "yyyy-MM-dd HH:mm") : "",
    j.store_locations?.name ?? "",
    j.price ?? "",
  ]);
}

export function exportJobsCSV(jobs: any[]) {
  const rows = [headers, ...toRows(jobs)];
  const csv = rows.map((r) => r.map((c) => {
    const s = String(c ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(",")).join("\n");
  download(csv, `jobs-${Date.now()}.csv`, "text/csv");
}

export function exportJobsXLSX(jobs: any[]) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...toRows(jobs)]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Jobs");
  XLSX.writeFile(wb, `jobs-${Date.now()}.xlsx`);
}

function download(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
