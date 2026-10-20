// Project configuration. The anon key is PUBLIC by design – security comes from RLS (supabase/schema.sql).
export const SUPABASE_URL = "https://ljmkcszysfrwimruekpv.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_5gM2V4MdemFFr24eqg2tOQ_M95C1Vub";

export const SECTIONS = ["A", "B", "C", "D", "E"];        // theory groups
export const SUBGROUPS_PER_SECTION = 3;                    // practical groups: A1..A3
// Scan lock: true = scanning only allowed during a timetable slot (or a manual session).
// Set to false while testing / during setup.
export const ENFORCE_SCHEDULE = false;
// Scan lock: true = scanning only allowed during a timetable slot (or a manual session).
// Set to false while testing / during setup.
export const ENFORCE_SCHEDULE = false;
export const PRE_OPEN_MIN = 20;                            // scanning opens N minutes before a lecture
export const DEFAULT_GRACE_MIN = 10;                       // late after start + grace
export const STATUS = { PRESENT: "حاضر", LATE: "متأخر", EXCUSED: "عذر" };
export const TYPE = { THEORY: "نظري", PRACTICAL: "عملي" };
