// Archivos de calendario (.ics) para llevar citas y avisos al calendario del móvil: las alarmas funcionan sin internet.
const dos = n => String(n).padStart(2, '0');
const esc = s => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const fechaHora = (f, h) => f.replace(/-/g, '') + 'T' + (h || '09:00').replace(':', '') + '00';
const sumaMin = (f, h, min) => { const [a, m, d] = f.split('-').map(Number), [hh, mm] = (h || '09:00').split(':').map(Number); const t = new Date(a, m - 1, d, hh, mm + min); return `${t.getFullYear()}${dos(t.getMonth() + 1)}${dos(t.getDate())}T${dos(t.getHours())}${dos(t.getMinutes())}00`; };

// minutos de antelación → «TRIGGER» de la alarma
const trigger = min => min % 1440 === 0 ? `-P${min / 1440}D` : min % 60 === 0 ? `-PT${min / 60}H` : `-PT${min}M`;

export function eventoCita(c) {
  const avisos = (c.avisos && c.avisos.length ? c.avisos : [1440, 120]).map(min => `BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:${esc(c.con || 'Cita')}\r\nTRIGGER:${trigger(min)}\r\nEND:VALARM`).join('\r\n');
  return ['BEGIN:VEVENT', `UID:cita-${c.id}@dieta-app`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    `DTSTART:${fechaHora(c.fecha, c.hora)}`, `DTEND:${sumaMin(c.fecha, c.hora, 45)}`, `SUMMARY:${esc('Cita: ' + (c.con || 'médico'))}`,
    ...(c.lugar ? [`LOCATION:${esc(c.lugar)}`] : []), ...(c.nota ? [`DESCRIPTION:${esc(c.nota)}`] : []), avisos, 'END:VEVENT'].join('\r\n');
}
export const calendario = (eventos, nombre = 'Dieta y salud') => ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Dieta App//ES', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${esc(nombre)}`, ...eventos, 'END:VCALENDAR'].join('\r\n') + '\r\n';

export function descargar(nombreArchivo, texto) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([texto], { type: 'text/calendar;charset=utf-8' })); a.download = nombreArchivo;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// Evento que se repite cada día a una hora, con alarma al empezar (para avisos de agua, comidas, ejercicio…).
export function eventoDiario({ id, titulo, hora, minutos = 5, desc = '', desde }) {
  const hoyIso = desde || new Date().toISOString().slice(0, 10);
  return ['BEGIN:VEVENT', `UID:${id}@dieta-app`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    `DTSTART:${fechaHora(hoyIso, hora)}`, `DTEND:${sumaMin(hoyIso, hora, minutos)}`, 'RRULE:FREQ=DAILY', `SUMMARY:${esc(titulo)}`, ...(desc ? [`DESCRIPTION:${esc(desc)}`] : []),
    `BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:${esc(titulo)}\r\nTRIGGER:PT0M\r\nEND:VALARM`, 'END:VEVENT'].join('\r\n');
}
