import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { barberService } from "./barberService";
import type { Barber, BarberScheduleEntry } from "./barberTypes";
import { appointmentService } from "../appointments/appointmentService";
import type { Appointment } from "../appointments/appointmentTypes";
import { CalendarDays, LayoutList, CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";

type ScheduleView = "lista" | "dia" | "calendario";

const DAY_NAMES  = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
const DAY_SHORT  = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
const MONTHS_ES  = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
const WEEKDAY_ORDER = [1,2,3,4,5,6,0]; // Lun → Dom

const pad = (n: number) => String(n).padStart(2,"0");
const fmt = (h: number, m: number) => `${pad(h)}:${pad(m)}`;

/* ── Calendar geometry ──────────────────────────────────────── */
const CAL_START   = 7;
const CAL_END     = 22;
const SLOT_H      = 40;
const TOTAL_SLOTS = (CAL_END - CAL_START) * 2;

const toTop    = (h: number, m: number) => ((h - CAL_START) * 60 + m) / 30 * SLOT_H;
const toHeight = (sh: number, sm: number, eh: number, em: number) =>
  ((eh * 60 + em) - (sh * 60 + sm)) / 30 * SLOT_H;

/* ── Appointment status colors ──────────────────────────────── */
const APPT_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  Pendiente:  { bg: "rgba(245,158,11,0.25)",  border: "rgba(245,158,11,0.50)",  text: "#f59e0b" },
  Completada: { bg: "rgba(16,185,129,0.20)",  border: "rgba(16,185,129,0.40)",  text: "#34d399" },
  Cancelada:  { bg: "rgba(239,68,68,0.15)",   border: "rgba(239,68,68,0.30)",   text: "#f87171" },
};

/* ── Date helpers ───────────────────────────────────────────── */
const getMonday = (weekOffset: number) => {
  const now  = new Date();
  const dow  = now.getDay(); // 0=Dom
  const diff = dow === 0 ? -6 : 1 - dow;
  const mon  = new Date(now);
  mon.setDate(now.getDate() + diff + weekOffset * 7);
  mon.setHours(0, 0, 0, 0);
  return mon;
};

// day: 0=Dom…6=Sáb → offset from Monday
const DOW_TO_OFFSET: Record<number, number> = { 1:0, 2:1, 3:2, 4:3, 5:4, 6:5, 0:6 };

const dateStrOf = (base: Date, dayOfWeek: number) => {
  const d = new Date(base);
  d.setDate(base.getDate() + DOW_TO_OFFSET[dayOfWeek]);
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
};

const apptsByDate = (appts: Appointment[], dateStr: string) =>
  appts.filter(a => a.appointmentDate.startsWith(dateStr))
       .sort((a,b) => a.appointmentDate.localeCompare(b.appointmentDate));

/* ── Break badge ─────────────────────────────────────────────── */
const BreakBadge: React.FC<{ entry: BarberScheduleEntry }> = ({ entry }) => {
  if (entry.breakStartHour == null || entry.breakEndHour == null) return null;
  return (
    <span style={{
      display:"inline-flex", alignSelf:"flex-start",
      fontSize:10, fontWeight:600, padding:"2px 8px", borderRadius:99,
      background:"color-mix(in srgb, var(--color-secondary) 13%, transparent)",
      color:"color-mix(in srgb, var(--color-secondary) 85%, white)",
      border:"1px solid color-mix(in srgb, var(--color-secondary) 22%, transparent)",
    }}>
      {fmt(entry.breakStartHour, entry.breakStartMinute ?? 0)}
      {" – "}
      {fmt(entry.breakEndHour, entry.breakEndMinute ?? 0)}
      {" · Descanso"}
    </span>
  );
};

/* ── ApptMiniList: compact appointment list per day ─────────── */
const ApptMiniList: React.FC<{ appts: Appointment[] }> = ({ appts }) => {
  if (appts.length === 0) return null;
  return (
    <div style={{ marginTop:10, display:"flex", flexDirection:"column", gap:4 }}>
      <p style={{ fontSize:9, fontWeight:700, color:"var(--color-text-muted)", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:2 }}>
        Citas — {appts.length}
      </p>
      {appts.map(a => {
        const d  = new Date(a.appointmentDate);
        const sc = APPT_COLORS[a.status] ?? APPT_COLORS["Pendiente"];
        return (
          <div key={a.id} style={{
            display:"flex", alignItems:"center", gap:6,
            padding:"5px 8px", borderRadius:7,
            background: sc.bg, border:`1px solid ${sc.border}`,
          }}>
            <span style={{ fontSize:11, fontWeight:700, color:sc.text, fontVariantNumeric:"tabular-nums", fontFamily:"monospace", flexShrink:0 }}>
              {pad(d.getUTCHours())}:{pad(d.getUTCMinutes())}
            </span>
            <span style={{ fontSize:11, color:"var(--color-text)", fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {a.customerName}
            </span>
          </div>
        );
      })}
    </div>
  );
};

/* ── Main ───────────────────────────────────────────────────── */
export const BarberSchedule: React.FC = () => {
  const { user } = useAuth();
  const [barber,   setBarber]   = useState<Barber | null>(null);
  const [schedule, setSchedule] = useState<BarberScheduleEntry[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState<string | null>(null);
  const [view,    setView]      = useState<ScheduleView>("lista");
  const [weekOffset, setWeekOffset] = useState(0); // 0=esta semana, 1=próxima

  useEffect(() => {
    const load = async () => {
      try {
        const barbers  = await barberService.getAll();
        const myBarber = barbers.find(b => b.userId === user?.id);
        if (!myBarber) {
          setError("No se encontró tu perfil de barbero vinculado a esta cuenta.");
          return;
        }
        setBarber(myBarber);
        const [sched, appts] = await Promise.all([
          barberService.getSchedule(myBarber.id),
          appointmentService.getWeek(),
        ]);
        setSchedule(sched);
        setAppointments(appts);
      } catch {
        setError("Error al cargar el horario. Intenta recargar la página.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.id]);

  const todayDay = new Date().getDay();
  const now      = new Date();
  const nowTop   = toTop(now.getHours(), now.getMinutes());
  const nowVisible = now.getHours() >= CAL_START && now.getHours() < CAL_END;

  // Monday of each week
  const thisMonday = useMemo(() => getMonday(weekOffset), [weekOffset]);
  const todayStr   = useMemo(() => {
    const t = new Date();
    return `${t.getFullYear()}-${pad(t.getMonth()+1)}-${pad(t.getDate())}`;
  }, []);

  /* ── Loading ─────────────────────────────────────────────── */
  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:240 }}>
      <div className="animate-spin" style={{
        width:34, height:34, borderRadius:"50%",
        border:"2px solid transparent",
        borderTopColor:"var(--color-primary)",
        borderBottomColor:"var(--color-primary)",
      }} />
    </div>
  );

  /* ── Error ───────────────────────────────────────────────── */
  if (error) return (
    <div style={{ borderRadius:12, padding:"16px 20px", fontSize:13, background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.22)", color:"#f87171" }}>
      {error}
    </div>
  );

  /* ── MODO A: Lista ───────────────────────────────────────── */
  const renderLista = () => {
    // Count appointments per weekday across the 14-day window
    const countPerDay: Record<number, number> = {};
    for (const dow of WEEKDAY_ORDER) {
      // Check both this week and next week occurrences
      const d0 = dateStrOf(getMonday(0), dow);
      const d1 = dateStrOf(getMonday(1), dow);
      countPerDay[dow] = appointments.filter(a =>
        a.appointmentDate.startsWith(d0) || a.appointmentDate.startsWith(d1)
      ).length;
    }

    return (
      <div style={{
        borderRadius:16, overflow:"hidden",
        background:"var(--color-glass-surface)",
        border:"1px solid var(--color-glass-border)",
              }}>
        {WEEKDAY_ORDER.map((day, idx) => {
          const entry   = schedule.find(s => s.dayOfWeek === day);
          const isToday = todayDay === day;
          const count   = countPerDay[day] ?? 0;
          return (
            <div
              key={day}
              className="fade-up schedule-list-row"
              style={{
                display:"flex", alignItems:"center", justifyContent:"space-between",
                padding:"15px 20px",
                borderTop: idx > 0 ? "1px solid var(--color-glass-border)" : "none",
                background: isToday ? "color-mix(in srgb, var(--color-primary) 6%, transparent)" : "transparent",
                animationDelay:`${idx * 35}ms`,
              }}
            >
              {/* Left: name + badges */}
              <div className="schedule-list-info" style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                <span style={{
                  fontSize:14, fontWeight: isToday ? 700 : 500,
                  color: isToday ? "var(--color-primary)" : "var(--color-text)",
                  width:100,
                }}>
                  {DAY_NAMES[day]}
                </span>
                {isToday && (
                  <span style={{
                    fontSize:9, fontWeight:700, padding:"2px 8px", borderRadius:99,
                    background:"var(--color-primary)", color:"#000",
                    textTransform:"uppercase", letterSpacing:"0.08em",
                    whiteSpace:"nowrap",
                  }}>
                    hoy
                  </span>
                )}
                {count > 0 && (
                  <span style={{
                    fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:99,
                    background:"rgba(245,158,11,0.18)",
                    color:"#f59e0b",
                    border:"1px solid rgba(245,158,11,0.30)",
                    whiteSpace:"nowrap",
                  }}>
                    {count} cita{count > 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {/* Right: hours */}
              {entry ? (
                <div className="schedule-list-hours" style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4 }}>
                  <span style={{
                    fontSize:13, fontWeight:600, letterSpacing:"-0.01em",
                    color:"var(--color-text)",
                    fontVariantNumeric:"tabular-nums", fontFamily:"monospace",
                    whiteSpace:"nowrap",
                  }}>
                    {fmt(entry.startHour, entry.startMinute)} — {fmt(entry.endHour, entry.endMinute)}
                  </span>
                  <BreakBadge entry={entry} />
                </div>
              ) : (
                <span className="schedule-list-hours" style={{ fontSize:13, color:"var(--color-text-muted)", fontStyle:"italic" }}>
                  Día libre
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  /* ── MODO B: Por día ─────────────────────────────────────── */
  const renderPorDia = () => (
    <div className="schedule-day-grid" style={{ display:"grid", gridTemplateColumns:"repeat(2, 1fr)", gap:12 }}>
      {WEEKDAY_ORDER.map((day, idx) => {
        const entry   = schedule.find(s => s.dayOfWeek === day);
        const isToday = todayDay === day;

        // Appointments for this weekday across both weeks in the 14-day window
        const d0   = dateStrOf(getMonday(0), day);
        const d1   = dateStrOf(getMonday(1), day);
        const appts0 = apptsByDate(appointments, d0);
        const appts1 = apptsByDate(appointments, d1);

        // Format display dates for the week headers
        const fmt0 = (() => { const dd = new Date(d0+"T12:00:00"); return `${dd.getDate()} ${MONTHS_ES[dd.getMonth()]}`; })();
        const fmt1 = (() => { const dd = new Date(d1+"T12:00:00"); return `${dd.getDate()} ${MONTHS_ES[dd.getMonth()]}`; })();

        return (
          <div
            key={day}
            className="fade-up"
            style={{
              borderRadius:14, padding:"18px 20px",
              background: isToday
                ? "color-mix(in srgb, var(--color-primary) 8%, var(--color-glass-surface))"
                : "var(--color-glass-surface)",
              border:`1px solid ${isToday
                ? "color-mix(in srgb, var(--color-primary) 30%, transparent)"
                : "var(--color-glass-border)"}`,
                            opacity: entry ? 1 : 0.48,
              animationDelay:`${idx * 35}ms`,
            }}
          >
            {/* Header */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
              <span style={{
                fontSize:13, fontWeight:700, letterSpacing:"-0.01em",
                color: isToday ? "var(--color-primary)" : "var(--color-text)",
              }}>
                {DAY_NAMES[day]}
              </span>
              {isToday && (
                <span style={{
                  fontSize:9, fontWeight:700, padding:"2px 8px", borderRadius:99,
                  background:"var(--color-primary)", color:"#000",
                  textTransform:"uppercase", letterSpacing:"0.08em",
                }}>
                  hoy
                </span>
              )}
            </div>

            {/* Work hours */}
            {entry ? (
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                <div style={{ display:"flex", alignItems:"baseline", gap:5 }}>
                  <span style={{
                    fontSize:22, fontWeight:800, color:"var(--color-text)",
                    fontVariantNumeric:"tabular-nums", letterSpacing:"-0.02em", lineHeight:1,
                  }}>
                    {fmt(entry.startHour, entry.startMinute)}
                  </span>
                  <span style={{ fontSize:12, color:"var(--color-text-muted)", fontWeight:500 }}>→</span>
                  <span style={{
                    fontSize:22, fontWeight:800, color:"var(--color-text)",
                    fontVariantNumeric:"tabular-nums", letterSpacing:"-0.02em", lineHeight:1,
                  }}>
                    {fmt(entry.endHour, entry.endMinute)}
                  </span>
                </div>
                <BreakBadge entry={entry} />
              </div>
            ) : (
              <p style={{ fontSize:13, color:"var(--color-text-muted)", fontStyle:"italic" }}>Día libre</p>
            )}

            {/* Appointments: esta semana */}
            {appts0.length > 0 && (
              <div style={{ marginTop:12, paddingTop:12, borderTop:"1px solid var(--color-glass-border)" }}>
                <p style={{ fontSize:9, fontWeight:700, color:"var(--color-text-muted)", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 }}>
                  {fmt0} — {appts0.length} cita{appts0.length > 1 ? "s" : ""}
                </p>
                <ApptMiniList appts={appts0} />
              </div>
            )}

            {/* Appointments: próxima semana */}
            {appts1.length > 0 && (
              <div style={{ marginTop: appts0.length > 0 ? 10 : 12, paddingTop:12, borderTop:"1px solid var(--color-glass-border)" }}>
                <p style={{ fontSize:9, fontWeight:700, color:"var(--color-text-muted)", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:6 }}>
                  {fmt1} — {appts1.length} cita{appts1.length > 1 ? "s" : ""}
                </p>
                <ApptMiniList appts={appts1} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  /* ── MODO C: Calendario semanal ──────────────────────────── */
  const renderCalendario = () => {
    const hourLabels: number[] = [];
    for (let h = CAL_START; h <= CAL_END; h++) hourLabels.push(h);

    const weekLabel = weekOffset === 0 ? "Esta semana" : "Próxima semana";

    return (
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        {/* Week navigation */}
        <div style={{
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"10px 16px", borderRadius:12,
          background:"var(--color-glass-surface)",
          border:"1px solid var(--color-glass-border)",
                  }}>
          <button
            onClick={() => setWeekOffset(0)}
            disabled={weekOffset === 0}
            style={{
              display:"flex", alignItems:"center", gap:4,
              padding:"5px 10px", borderRadius:7, border:"none", cursor: weekOffset === 0 ? "default" : "pointer",
              background: weekOffset === 0 ? "color-mix(in srgb, var(--color-primary) 12%, transparent)" : "transparent",
              color: weekOffset === 0 ? "var(--color-primary)" : "var(--color-text-muted)",
              fontSize:11, fontWeight:600, transition:"all 150ms ease",
            }}
          >
            <ChevronLeft size={13} />
            Esta semana
          </button>
          <span style={{ fontSize:12, fontWeight:600, color:"var(--color-text)" }}>
            {weekLabel}
          </span>
          <button
            onClick={() => setWeekOffset(1)}
            disabled={weekOffset === 1}
            style={{
              display:"flex", alignItems:"center", gap:4,
              padding:"5px 10px", borderRadius:7, border:"none", cursor: weekOffset === 1 ? "default" : "pointer",
              background: weekOffset === 1 ? "color-mix(in srgb, var(--color-primary) 12%, transparent)" : "transparent",
              color: weekOffset === 1 ? "var(--color-primary)" : "var(--color-text-muted)",
              fontSize:11, fontWeight:600, transition:"all 150ms ease",
            }}
          >
            Próxima semana
            <ChevronRight size={13} />
          </button>
        </div>

        {/* Calendar grid */}
        <div style={{
          borderRadius:16, overflow:"hidden",
          background:"var(--color-glass-surface)",
          border:"1px solid var(--color-glass-border)",
                  }}>
        <div className="schedule-calendar-scroll">
          <div className="schedule-calendar-inner">
          {/* Column headers */}
          <div style={{
            display:"grid", gridTemplateColumns:"48px repeat(7, 1fr)",
            borderBottom:"1px solid var(--color-glass-border)",
          }}>
            <div />
            {WEEKDAY_ORDER.map(day => {
              const colDate   = new Date(thisMonday);
              colDate.setDate(thisMonday.getDate() + DOW_TO_OFFSET[day]);
              const colStr    = `${colDate.getFullYear()}-${pad(colDate.getMonth()+1)}-${pad(colDate.getDate())}`;
              const isToday   = colStr === todayStr;
              const dayAppts  = apptsByDate(appointments, colStr);
              const hasPending = dayAppts.some(a => a.status === "Pendiente");
              return (
                <div key={day} style={{
                  padding:"10px 4px 8px",
                  borderLeft:"1px solid var(--color-glass-border)",
                  textAlign:"center",
                  background: isToday ? "color-mix(in srgb, var(--color-primary) 7%, transparent)" : "transparent",
                }}>
                  <p style={{
                    fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em",
                    color: isToday ? "var(--color-primary)" : "var(--color-text-muted)",
                  }}>
                    {DAY_SHORT[day]}
                  </p>
                  <p style={{
                    fontSize:12, fontWeight:700, color: isToday ? "var(--color-primary)" : "var(--color-text)",
                    marginTop:2, fontVariantNumeric:"tabular-nums",
                  }}>
                    {colDate.getDate()}
                  </p>
                  {/* Appointment count — punto en escritorio, etiqueta "Citas: N" en celular */}
                  {dayAppts.length > 0 && (
                    <>
                      <div className="schedule-cal-count-dot" style={{
                        display:"inline-flex", alignItems:"center", justifyContent:"center",
                        marginTop:3,
                        width:14, height:14, borderRadius:"50%",
                        background: hasPending ? "rgba(245,158,11,0.25)" : "rgba(16,185,129,0.20)",
                        fontSize:8, fontWeight:700,
                        color: hasPending ? "#f59e0b" : "#34d399",
                      }}>
                        {dayAppts.length}
                      </div>
                      <div className="schedule-cal-count-label" style={{
                        alignItems:"center", justifyContent:"center",
                        marginTop:3, padding:"2px 7px", borderRadius:9999,
                        background: hasPending ? "rgba(245,158,11,0.18)" : "rgba(16,185,129,0.15)",
                        fontSize:9, fontWeight:700, whiteSpace:"nowrap",
                        color: hasPending ? "#f59e0b" : "#34d399",
                      }}>
                        Citas: {dayAppts.length}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Scrollable body */}
          <div style={{ overflowY:"auto", maxHeight:560 }}>
            <div style={{
              display:"grid", gridTemplateColumns:"48px repeat(7, 1fr)",
              position:"relative", height: TOTAL_SLOTS * SLOT_H,
            }}>
              {/* Time axis */}
              <div style={{ position:"relative" }}>
                {hourLabels.map((h, i) => (
                  <div key={h} style={{
                    position:"absolute", top: i * 2 * SLOT_H - 8, right:6,
                    fontSize:9, fontWeight:600, color:"var(--color-text-muted)",
                    fontVariantNumeric:"tabular-nums", fontFamily:"monospace",
                    userSelect:"none",
                  }}>
                    {pad(h)}:00
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {WEEKDAY_ORDER.map(day => {
                const entry    = schedule.find(s => s.dayOfWeek === day);
                const colDate  = new Date(thisMonday);
                colDate.setDate(thisMonday.getDate() + DOW_TO_OFFSET[day]);
                const colStr   = `${colDate.getFullYear()}-${pad(colDate.getMonth()+1)}-${pad(colDate.getDate())}`;
                const isToday  = colStr === todayStr;
                const hasWork  = !!entry;
                const hasBreak = entry && entry.breakStartHour != null && entry.breakEndHour != null;
                const dayAppts = apptsByDate(appointments, colStr);

                const workTop    = hasWork ? toTop(entry!.startHour, entry!.startMinute) : 0;
                const workHeight = hasWork ? toHeight(entry!.startHour, entry!.startMinute, entry!.endHour, entry!.endMinute) : 0;
                const breakTop    = hasBreak ? toTop(entry!.breakStartHour!, entry!.breakStartMinute ?? 0) : 0;
                const breakHeight = hasBreak ? toHeight(entry!.breakStartHour!, entry!.breakStartMinute ?? 0, entry!.breakEndHour!, entry!.breakEndMinute ?? 0) : 0;

                return (
                  <div key={day} style={{
                    position:"relative",
                    borderLeft:"1px solid var(--color-glass-border)",
                    background: isToday ? "color-mix(in srgb, var(--color-primary) 3%, transparent)" : "transparent",
                  }}>
                    {/* Grid lines */}
                    {hourLabels.map((_, i) => (
                      <div key={i} style={{ position:"absolute", top: i * 2 * SLOT_H, left:0, right:0, borderTop:"1px solid var(--color-glass-border)", opacity:0.30 }} />
                    ))}
                    {hourLabels.slice(0,-1).map((_, i) => (
                      <div key={`h${i}`} style={{ position:"absolute", top:(i*2+1)*SLOT_H, left:0, right:0, borderTop:"1px dashed var(--color-glass-border)", opacity:0.12 }} />
                    ))}

                    {/* Work block */}
                    {hasWork && (
                      <div style={{
                        position:"absolute", top:workTop, height:workHeight, left:3, right:3,
                        borderRadius:6,
                        background:"color-mix(in srgb, var(--color-primary) 18%, transparent)",
                        border:"1px solid color-mix(in srgb, var(--color-primary) 32%, transparent)",
                      }}>
                        <span style={{ position:"absolute", top:4, left:5, fontSize:8, fontWeight:700, color:"color-mix(in srgb, var(--color-primary) 70%, transparent)", fontVariantNumeric:"tabular-nums" }}>
                          {fmt(entry!.startHour, entry!.startMinute)}
                        </span>
                      </div>
                    )}

                    {/* Break block */}
                    {hasBreak && breakHeight > 0 && (
                      <div style={{
                        position:"absolute", top:breakTop, height:breakHeight, left:3, right:3,
                        borderRadius:4,
                        background:"color-mix(in srgb, var(--color-secondary) 26%, transparent)",
                        border:"1px solid color-mix(in srgb, var(--color-secondary) 36%, transparent)",
                        display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden",
                      }}>
                        {breakHeight > 18 && (
                          <span style={{ fontSize:7, fontWeight:700, color:"color-mix(in srgb, var(--color-secondary) 85%, white)", textTransform:"uppercase", letterSpacing:"0.04em" }}>
                            Descanso
                          </span>
                        )}
                      </div>
                    )}

                    {/* Appointment blocks */}
                    {dayAppts.map(appt => {
                      const d       = new Date(appt.appointmentDate);
                      const h       = d.getUTCHours();
                      const m       = d.getUTCMinutes();
                      if (h < CAL_START || h >= CAL_END) return null;
                      const dur     = appt.service?.durationMinutes ?? 30;
                      const endMins = h * 60 + m + dur;
                      const eH      = Math.min(Math.floor(endMins / 60), CAL_END);
                      const eM      = endMins % 60;
                      const top     = toTop(h, m);
                      const height  = Math.max(toHeight(h, m, eH, eM), SLOT_H * 0.5);
                      const sc      = APPT_COLORS[appt.status] ?? APPT_COLORS["Pendiente"];
                      return (
                        <div
                          key={appt.id}
                          title={`${appt.customerName} — ${appt.service?.name ?? ""}`}
                          style={{
                            position:"absolute", top, height, left:4, right:4,
                            borderRadius:5,
                            background: sc.bg,
                            border:`1px solid ${sc.border}`,
                            overflow:"hidden", zIndex:5,
                            padding:"3px 5px",
                          }}
                        >
                          <p style={{ fontSize:8, fontWeight:700, color:sc.text, fontVariantNumeric:"tabular-nums", margin:0, lineHeight:1.3 }}>
                            {pad(h)}:{pad(m)}
                          </p>
                          {height > 28 && (
                            <p style={{ fontSize:8, fontWeight:600, color:"var(--color-text)", margin:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", lineHeight:1.3 }}>
                              {appt.customerName}
                            </p>
                          )}
                        </div>
                      );
                    })}

                    {/* Current time line */}
                    {isToday && nowVisible && (
                      <div style={{ position:"absolute", top:nowTop, left:0, right:0, zIndex:10, pointerEvents:"none" }}>
                        <div style={{ width:"100%", borderTop:"2px solid #ef4444", position:"relative" }}>
                          <div style={{ position:"absolute", left:-3, top:-4, width:7, height:7, borderRadius:"50%", background:"#ef4444" }} />
                        </div>
                      </div>
                    )}

                    {/* Day off */}
                    {!hasWork && (
                      <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                        <span style={{ fontSize:9, fontWeight:600, color:"var(--color-text-muted)", textTransform:"uppercase", letterSpacing:"0.05em", writingMode:"vertical-rl", transform:"rotate(180deg)", opacity:0.35 }}>
                          libre
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          </div>{/* end schedule-calendar-inner */}
        </div>
        </div>
      </div>
    );
  };

  /* ── Toggle views ────────────────────────────────────────── */
  const VIEWS: { id: ScheduleView; label: string; icon: React.ReactNode }[] = [
    { id:"lista",      label:"Lista",      icon:<LayoutList size={12} /> },
    { id:"dia",        label:"Por día",    icon:<CalendarDays size={12} /> },
    { id:"calendario", label:"Calendario", icon:<CalendarRange size={12} /> },
  ];

  return (
    <div className="fade-up" style={{ maxWidth:860 }}>

      {/* ── Header ──────────────────────────────────────────── */}
      <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", gap:16, marginBottom:24, flexWrap:"wrap" }}>
        <div>
          <h1 style={{ color:"var(--color-text)", fontSize:30, fontWeight:800, letterSpacing:"-0.03em", lineHeight:1, fontFamily:"Inter, sans-serif" }}>
            Mi Horario
          </h1>
          {barber && (
            <p style={{ color:"var(--color-text-muted)", fontSize:13, marginTop:5 }}>
              {barber.name}{barber.specialty ? ` · ${barber.specialty}` : ""}
            </p>
          )}
        </div>

        {/* View toggle */}
        <div style={{ display:"inline-flex", gap:2, padding:3, borderRadius:10, background:"var(--color-glass-surface)", border:"1px solid var(--color-glass-border)", flexShrink:0 }}>
          {VIEWS.map(v => {
            const isActive = view === v.id;
            return (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                style={{
                  display:"flex", alignItems:"center", gap:5,
                  padding:"5px 12px", borderRadius:7, fontSize:11, fontWeight:600, cursor:"pointer",
                  border:"none", transition:"all 150ms ease",
                  background: isActive
                    ? "linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 72%, #000))"
                    : "transparent",
                  color: isActive ? "#000" : "var(--color-text-muted)",
                  boxShadow: isActive ? "0 2px 8px color-mix(in srgb, var(--color-primary) 38%, transparent)" : "none",
                }}
              >
                {v.icon}
                {v.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────── */}
      {view === "lista"      && renderLista()}
      {view === "dia"        && renderPorDia()}
      {view === "calendario" && renderCalendario()}

      <p style={{ textAlign:"center", fontSize:11, color:"var(--color-text-muted)", marginTop:16 }}>
        El horario solo puede ser modificado por el administrador de la barbería.
      </p>
    </div>
  );
};