import { supabase } from "./supabase";
import { notifyByPush } from "./push-client";

// "requested" is a player's ask, not yet agreed by the medical team. It exists
// so that nothing is emailed to either side until a doctor or physio has
// actually confirmed the slot — see confirmBooking below.
export type BookingStatus = "requested" | "scheduled" | "completed" | "cancelled" | "no-show";

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
  requested_at: string | null;
  confirmed_at: string | null;
  confirmed_by: string | null;
  decline_reason: string | null;
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
  // Player requests come in as "requested"; staff-made bookings go straight to
  // "scheduled" because the person who would confirm is the one booking.
  status?: BookingStatus;
};

// Treatment slots run on a 5-minute grid. Applied both as the native input
// step and by snapping the value on change, because browsers disagree about
// how strictly they enforce `step` on a time input — Safari in particular will
// happily hand back 09:07.
export const BOOKING_STEP_MINUTES = 5;

export function snapToBookingInterval(hhmm: string, stepMinutes = BOOKING_STEP_MINUTES): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return hhmm;
  const hours = Number(match[1]);
  const mins = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(mins)) return hhmm;

  const snapped = Math.round(mins / stepMinutes) * stepMinutes;
  // Rounding 58 up to 60 rolls into the next hour, and 23:58 wraps to 00:00
  // rather than producing an invalid 24:00.
  const carry = Math.floor(snapped / 60);
  const finalMins = snapped % 60;
  const finalHours = (hours + carry) % 24;
  return `${String(finalHours).padStart(2, "0")}:${String(finalMins).padStart(2, "0")}`;
}

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
      status: input.status ?? "scheduled",
      requested_at: input.status === "requested" ? new Date().toISOString() : null,
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

// Confirming is what turns a request into a real appointment: it records who
// agreed it, attaches the confirming clinician so the invite has somewhere to
// go, and only then does the caller send the emails.
export async function confirmBooking(
  id: string,
  doctor: { name: string; email: string },
  confirmedBy: string
): Promise<DbTreatmentBooking> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("treatment_bookings")
    .update({
      status: "scheduled",
      doctor_name: doctor.name || null,
      doctor_email: doctor.email || null,
      confirmed_at: now,
      confirmed_by: confirmedBy || null,
      decline_reason: null,
      updated_at: now,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;

  // The player asked and has been waiting — tell them, on whatever device
  // they've enabled notifications on.
  const booking = data as DbTreatmentBooking;
  void notifyByPush({
    playerId: booking.player_id,
    title: "Treatment confirmed",
    body: `${booking.treatment_type} — ${new Date(booking.start_time).toLocaleString("en-GB", {
      weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    })}`,
    url: "/portal",
    tag: `treatment-${booking.id}`,
  });
  return booking;
}

// Declining keeps the row rather than deleting it, so the player can see their
// request was answered and why.
export async function declineBooking(id: string, reason: string): Promise<DbTreatmentBooking> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("treatment_bookings")
    .update({ status: "cancelled", decline_reason: reason.trim() || null, updated_at: now })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;

  const booking = data as DbTreatmentBooking;
  void notifyByPush({
    playerId: booking.player_id,
    title: "Treatment request declined",
    body: reason.trim() || "Speak to the medical team to rearrange.",
    url: "/portal",
    tag: `treatment-${booking.id}`,
  });
  return booking;
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
