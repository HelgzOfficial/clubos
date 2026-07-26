import { supabase } from "./supabase";

export type DbTrainingPlan = {
  id: string;
  plan_date: string; // YYYY-MM-DD
  file_name: string;
  file_path: string;
  file_type: string;
  uploaded_at: string;
};

function fileTypeOf(file: File): string {
  return file.name.split(".").pop()?.toLowerCase() || "other";
}

export async function fetchTrainingPlans(planDate: string): Promise<DbTrainingPlan[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("training_plans")
    .select("*")
    .eq("plan_date", planDate)
    .order("uploaded_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DbTrainingPlan[];
}

export async function uploadTrainingPlan(planDate: string, file: File): Promise<DbTrainingPlan> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const path = `${planDate}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
  const { error: uploadError } = await supabase.storage.from("training-plans").upload(path, file);
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("training_plans")
    .insert({ plan_date: planDate, file_name: file.name, file_path: path, file_type: fileTypeOf(file) })
    .select()
    .single();
  if (error) throw error;
  return data as DbTrainingPlan;
}

export async function getTrainingPlanDownloadUrl(filePath: string): Promise<string> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.storage.from("training-plans").createSignedUrl(filePath, 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteTrainingPlan(id: string, filePath: string) {
  if (!supabase) throw new Error("Supabase is not configured.");
  await supabase.storage.from("training-plans").remove([filePath]);
  const { error } = await supabase.from("training_plans").delete().eq("id", id);
  if (error) throw error;
}
