import { supabase } from "./supabase";

export type BookingStatus = "scheduled" | "completed" | "cancelled" | "no-show";

export type DbTreatmentBooking = {
  id: string;
  player_id: string;
  injury_id: string | null;
  start_time: string;
  end_time: string;
  treatment_type: string;
  notes: string | null;
  status: BookingStatus;
  created_at: string;
  updated_at: string;
};

export type TreatmentBookingInput = {
  playerId: string;
  injuryId: string | null;
  startTime: string;
  endTime: string;
  treatmentType: string;
  notes: string;
};

export const TREATMENT_TYPE_OPTIONS = [
  "Physio session",
  "Massage / soft tissue",
  "Strength & conditioning rehab",
  "Assessment",
  "Pitch-side treatment",
  "Other",
];

export async function fetchBookings(): Promise<DbTreatmentBooking[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("treatment_bookings").select("*").order("start_time", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DbTreatmentBooking[];
}

export async function createBooking(input: TreatmentBookingInput): Promise<DbTreatmentBooking> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase
    .from("treatment_bookings")
    .insert({
      player_id: input.playerId,
      injury_id: input.injuryId,
      start_time: input.startTime,
      end_time: input.endTime,
      treatment_type: input.treatmentType,
      notes: input.notes || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as DbTreatmentBooking;
}

export async function updateBookingStatus(id: string, status: BookingStatus): Promise<DbTreatmentBooking> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase
    .from("treatment_bookings")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as DbTreatmentBooking;
}

export async function deleteBooking(id: string) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { error } = await supabase.from("treatment_bookings").delete().eq("id", id);
  if (error) throw error;
}
