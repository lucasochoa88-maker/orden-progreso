export const API_URL = import.meta.env.VITE_API_URL || '';
// Para cambiar de moneda en el futuro: tocar solo esto.
export const CURRENCY = { code: 'ARS', locale: 'es-AR' };
// Datos de ejemplo: se usan solo si no hay VITE_API_URL
export const SAMPLE = [
 {fecha:'03/10/2026',detalle:'Helado',categoria:'Alimentos y Bebidas',monto:'$40.000,00',quien:'Nati',ciclo:'Ciclo Octubre 2026'},
 {fecha:'04/10/2026',detalle:'snack',categoria:'Alimentos y Bebidas',monto:'$6.000,00',quien:'Nati',ciclo:'Ciclo Octubre 2026'},
 {fecha:'05/10/2026',detalle:'Combustible',categoria:'Combustible',monto:'$35.000,00',quien:'Nati',ciclo:'Ciclo Octubre 2026'},
 {fecha:'05/10/2026',detalle:'Obra',categoria:'Obra',monto:'$88.000,00',quien:'Nati',ciclo:'Ciclo Octubre 2026'},
 {fecha:'05/10/2026',detalle:'Combustible',categoria:'Combustible',monto:'$40.000,00',quien:'Nati',ciclo:'Ciclo Octubre 2026'}];
