// Apps Script ligado a la planilla. Solo LEE; no modifica nada.
// Columnas esperadas: A Fecha, B Detalle, C Categoría, D Monto, E Quien, F Ciclo
function doGet() {
  try {
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    const tz = Session.getScriptTimeZone();
    const vals = sh.getDataRange().getValues().slice(1); // sin encabezado
    const rows = vals
      .filter(r => r.some(c => c !== '' && c !== null))
      .map((r, i) => ({
        row: i + 2,
        fecha: r[0] instanceof Date ? Utilities.formatDate(r[0], tz, 'yyyy-MM-dd') : String(r[0] ?? ''),
        detalle: String(r[1] ?? ''),
        categoria: String(r[2] ?? ''),
        monto: typeof r[3] === 'number' ? r[3] : String(r[3] ?? ''),
        quien: String(r[4] ?? ''),
        ciclo: String(r[5] ?? '')
      }));
    return out({ version: 1, generatedAt: new Date().toISOString(), rows });
  } catch (e) { return out({ error: String(e) }); }
}
function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}



https://script.google.com/macros/s/AKfycbxmHJgjHmWhXfuMpz8GabaHRWTtJ-yLejOErvZ3Lk8DxLHO7ReFXkx0mC2zvvBxo1EO/exec

https://script.google.com/macros/s/AKfycbxmHJgjHmWhXfuMpz8GabaHRWTtJ-yLejOErvZ3Lk8DxLHO7ReFXkx0mC2zvvBxo1EO/exec

https://script.google.com/macros/s/AKfycbxmHJgjHmWhXfuMpz8GabaHRWTtJ-yLejOErvZ3Lk8DxLHO7ReFXkx0mC2zvvBxo1EO/exec
