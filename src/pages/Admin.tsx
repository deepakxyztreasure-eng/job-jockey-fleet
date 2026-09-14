import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Shield, Settings2, FileText, Banknote, Edit3 } from "lucide-react";

interface MemberRow { id: string; full_name: string|null; email: string|null; phone: string|null }

export default function Admin() {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Settings state
  const [directEdit, setDirectEdit] = useState(true);
  const [directInvoiceComp, setDirectInvoiceComp] = useState(true);
  const [requireCashApproval, setRequireCashApproval] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch feature flags / app settings
      const { data: settings } = await supabase.from("app_settings").select("key, value");
      if (settings) {
        const parseBool = (v: any) => {
          if (typeof v === "boolean") return v;
          if (typeof v === "string") return v.toLowerCase() === "true" || v === "1";
          if (typeof v === "number") return v === 1;
          return Boolean(v);
        };
        settings.forEach((s: any) => {
          if (s.key === "allow_direct_job_edit") setDirectEdit(parseBool(s.value));
          if (s.key === "allow_direct_invoice_completion") setDirectInvoiceComp(parseBool(s.value));
          if (s.key === "require_cash_job_approval") setRequireCashApproval(parseBool(s.value));
        });
      }

      // 2. Fetch member profiles
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "member");
      const ids = (roles ?? []).map((r: any) => r.user_id);
      if (ids.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, full_name, email, phone").in("id", ids);
        setMembers((profiles ?? []) as MemberRow[]);
      } else {
        setMembers([]);
      }
    } catch (e: any) {
      console.error("Error loading settings:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const updateSetting = async (key: string, value: boolean, label: string) => {
    setSavingKey(key);
    try {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key, value: value as any, updated_at: new Date().toISOString() }, { onConflict: "key" });

      if (error) {
        toast.error(`Failed to update ${label}: ${error.message}`);
        loadData();
      } else {
        toast.success(`${label} updated to ${value ? "Enabled" : "Disabled"}`);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" /> SuperAdmin Settings & Feature Flags
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure system-wide feature flags, job approval rules, and manage Staff Admin permissions.
        </p>
      </div>

      {/* Feature Flags Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" /> Feature Flags & Approval Rules
          </CardTitle>
          <CardDescription>
            Enable or disable permissions globally for Staff Admins (`member` role) and Dispatch Admins.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-2 divide-y">
          {/* Feature 1: Direct Job Edit */}
          <div className="flex items-center justify-between pt-4 first:pt-0 gap-4">
            <div className="space-y-1 max-w-2xl">
              <div className="flex items-center gap-2 font-medium">
                <Edit3 className="h-4 w-4 text-priority" /> Direct Job Editing for Staff Admins
              </div>
              <p className="text-xs text-muted-foreground">
                When <strong>Enabled</strong>, Staff Admins (`member`) can edit job details directly without routing through the SuperAdmin approval queue (`pending_edit`).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={directEdit}
                disabled={savingKey === "allow_direct_job_edit"}
                onCheckedChange={(val) => {
                  setDirectEdit(val);
                  updateSetting("allow_direct_job_edit", val, "Direct Job Editing");
                }}
              />
              <span className="text-xs font-semibold min-w-[50px]">
                {directEdit ? "Enabled" : "Disabled"}
              </span>
            </div>
          </div>

          {/* Feature 2: Invoice Job Direct Completion */}
          <div className="flex items-center justify-between pt-4 gap-4">
            <div className="space-y-1 max-w-2xl">
              <div className="flex items-center gap-2 font-medium">
                <FileText className="h-4 w-4 text-success" /> Direct Completion for Invoice Jobs
              </div>
              <p className="text-xs text-muted-foreground">
                When <strong>Enabled</strong>, Staff Admins can verify and complete jobs that have an <strong>Invoice Number</strong> directly.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={directInvoiceComp}
                disabled={savingKey === "allow_direct_invoice_completion"}
                onCheckedChange={(val) => {
                  setDirectInvoiceComp(val);
                  updateSetting("allow_direct_invoice_completion", val, "Invoice Job Direct Completion");
                }}
              />
              <span className="text-xs font-semibold min-w-[50px]">
                {directInvoiceComp ? "Enabled" : "Disabled"}
              </span>
            </div>
          </div>

          {/* Feature 3: Cash Job Approval */}
          <div className="flex items-center justify-between pt-4 gap-4">
            <div className="space-y-1 max-w-2xl">
              <div className="flex items-center gap-2 font-medium">
                <Banknote className="h-4 w-4 text-warning" /> SuperAdmin Approval Required for Cash (COD) Jobs
              </div>
              <p className="text-xs text-muted-foreground">
                When <strong>Enabled</strong>, Cash jobs (`payment_kind = COD`) strictly require SuperAdmin approval before being marked as Completed.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={requireCashApproval}
                disabled={savingKey === "require_cash_job_approval"}
                onCheckedChange={(val) => {
                  setRequireCashApproval(val);
                  updateSetting("require_cash_job_approval", val, "SuperAdmin Cash Approval Requirement");
                }}
              />
              <span className="text-xs font-semibold min-w-[50px]">
                {requireCashApproval ? "Enabled" : "Disabled"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Staff Admins List Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Staff Admins (`member` Role)</CardTitle>
          <CardDescription>Active Staff Admin users who manage daily operations.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {members.map((r) => (
                <tr key={r.id}>
                  <td className="font-medium">{r.full_name || "—"}</td>
                  <td className="text-muted-foreground">{r.email || "—"}</td>
                  <td className="text-muted-foreground">{r.phone || "—"}</td>
                  <td>
                    <Badge variant="secondary">Staff Admin (`member`)</Badge>
                  </td>
                </tr>
              ))}
              {!loading && members.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-muted-foreground py-8">
                    No Staff Admins found
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={4} className="text-center text-muted-foreground py-8">
                    Loading settings & staff list…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
