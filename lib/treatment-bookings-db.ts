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
  doctor_name: string | null;
  doctor_email: string | null;
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
  doctorName: string;
  doctorEmail: string;
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
      doctor_name: input.doctorName || null,
      doctor_email: input.doctorEmail || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as DbTreatmentBooking;
}

// Sends a real calendar invite (.ics attachment) for a booking to the player
// and the doctor who booked it, via the /api/send-treatment-invite route.
// Best-effort — a failure here should never undo the booking itself.
export async function sendTreatmentInvite(
  booking: DbTreatmentBooking,
  player: { name: string; email: string | null }
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/send-treatment-invite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        bookingId: booking.id,
        treatmentType: booking.treatment_type,
        startTime: booking.start_time,
        endTime: booking.end_time,
        notes: booking.notes,
        player: player.email ? { name: player.name, email: player.email } : undefined,
        doctor: booking.doctor_email ? { name: booking.doctor_name || "Doctor", email: booking.doctor_email } : undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || "Couldn't send the calendar invite." };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't send the calendar invite." };
  }
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
