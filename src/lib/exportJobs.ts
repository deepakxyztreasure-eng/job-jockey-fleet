import * as XLSX from "xlsx";
import { format } from "date-fns";

const headers = [
  "Date",
  "Product",
  "Invoice Number",
  "Customer Name",
  "Driver",
  "Status",
  "Priority",
  "Payment Status",
  "Start Time",
  "End Time",
  "Pickup",
  "Dropoff",
  "Price",
  "Quantity of Product",
];

function formatDate(j: any): string {
  if (j.scheduled_date) {
    try {
      return format(new Date(j.scheduled_date), "yyyy-MM-dd");
    } catch { /* noop */ }
  }
  if (j.start_time) {
    try {
      return format(new Date(j.start_time), "yyyy-MM-dd");
    } catch { /* noop */ }
  }
  if (j.created_at) {
    try {
      return format(new Date(j.created_at), "yyyy-MM-dd");
    } catch { /* noop */ }
  }
  return "";
}

function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return "";
  try {
    return format(new Date(dateStr), "yyyy-MM-dd HH:mm");
  } catch {
    return dateStr;
  }
}

function formatQuantity(j: any): string {
  if (j.quantity == null || j.quantity === "") return "";
  const unit = j.quantity_unit ? ` ${j.quantity_unit}` : "";
  return `${j.quantity}${unit}`;
}

function toRows(jobs: any[]): (string | number)[][] {
  const rows: (string | number)[][] = [];

  jobs.forEach((j) => {
    const dateStr = formatDate(j);
    const invoiceStr = j.invoice_number ?? "";
    const customerStr = j.customer_name ?? "";
    const driverStr = j.drivers?.full_name ?? "Unassigned";
    const statusStr = j.status ?? "";
    const priorityStr = j.priority ?? "";
    const paymentStatusStr = j.payment_status ?? "";
    const startTimeStr = formatDateTime(j.start_time);
    const endTimeStr = formatDateTime(j.end_time || j.verified_at);
    const pickupStr = j.store_locations?.name ?? j.pickup_address ?? "";
    const dropoffStr = j.delivery_address ?? "";
    const priceVal = j.price != null ? j.price : (j.cod_amount != null ? j.cod_amount : "");
    const quantityStr = formatQuantity(j);

    const rawTitle = (j.title ?? "").trim();
    const productLines = rawTitle.includes("\n")
      ? rawTitle.split("\n").map((s: string) => s.trim()).filter(Boolean)
      : [rawTitle];

    productLines.forEach((productName: string) => {
      rows.push([
        dateStr,
        productName,
        invoiceStr,
        customerStr,
        driverStr,
        statusStr,
        priorityStr,
        paymentStatusStr,
        startTimeStr,
        endTimeStr,
        pickupStr,
        dropoffStr,
        priceVal,
        quantityStr,
      ]);
    });
  });

  return rows;
}

export function exportJobsCSV(jobs: any[]) {
  const rows = [headers, ...toRows(jobs)];
  const csv = rows
    .map((r) =>
      r
        .map((c) => {
          const s = String(c ?? "");
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(",")
    )
    .join("\n");
  download(csv, `jobs-export-${Date.now()}.csv`, "text/csv");
}

export function exportJobsXLSX(jobs: any[]) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...toRows(jobs)]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Jobs");
  XLSX.writeFile(wb, `jobs-export-${Date.now()}.xlsx`);
}

function download(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
