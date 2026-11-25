import * as XLSX from '@e965/xlsx';

const missing = 'No disponible';
const value = (item) => item == null || item === '' ? missing : item;
const periods = { day: 'Hoy (Día)', week: 'Esta Semana', month: 'Este Mes', year: 'Este Año' };
const messageStatuses = { no_leido: 'No leído', leido: 'Leído', aplicado: 'Aplicado', archivado: 'Archivado', eliminado: 'Eliminado' };
const fleetStatuses = { con_falla: 'Con falla', en_servicio_tecnico: 'En revisión', reparado: 'Operativo', fuera_de_servicio: 'Fuera de servicio' };

const messages = {
  name: 'Mensajes y Reclamos',
  headers: ['Fecha/hora', 'Tipo', 'Nombre', 'Correo', 'Teléfono', 'Contenido completo', 'Estado', 'Notas internas'],
  rows: (report) => (report.messages || []).map((item) => [
    item.created_at, item.type === 'reclamo' ? 'Reclamo' : 'Mensaje', item.name, item.email,
    value(item.telephone), item.message, messageStatuses[item.status] || item.status, value(item.admin_notes)
  ])
};

const sheets = {
  summary: {
    name: 'Resumen KPIs',
    headers: ['Indicador', 'Valor'],
    rows: ({ period, metrics }) => [
      ['Período', periods[period] || period], ['Monto total de ventas', metrics.totalSales],
      ['Boletos vendidos', metrics.ticketsSold], ['Viajes realizados', metrics.completedTrips],
      ['Cancelaciones', metrics.cancellations], ['Monto cancelado', metrics.cancelledAmount],
      ['Reclamos recibidos', metrics.complaints], ['Mensajes de contacto', metrics.messages],
      ['Cuentas nuevas', metrics.newUsers], ['Buses con problemas', metrics.openFleetEvents]
    ]
  },
  sales: {
    name: 'Ventas y Pasajes',
    headers: ['Código de compra', 'Fecha/hora de emisión', 'Nombre comprador', 'Correo comprador', 'Nombre pasajero',
      'RUT pasajero', 'Origen', 'Destino', 'Fecha de viaje', 'Hora de viaje', 'N° Asiento', 'Clase',
      'Precio unitario', 'Descuento aplicado (%)', 'Total pagado por boleto', 'Estado', 'Total de compra'],
    rows: (report) => report.purchases.flatMap((sale) => sale.tickets.map((ticket) => [
      sale.sale_code, sale.created_at, value(sale.buyer_name), value(sale.buyer_email), ticket.passenger_name,
      value(ticket.passenger_rut), value(ticket.origin), ticket.destination, ticket.schedule_date,
      ticket.departure_time, ticket.seat_number, value(ticket.seat_class), value(ticket.original_price),
      value(ticket.discount_percent), ticket.price_paid, ticket.status, sale.total_amount
    ])),
    currencyColumns: [12, 14, 16]
  },
  cancellations: {
    name: 'Cancelaciones',
    headers: ['Código de venta', 'Fecha cancelación', 'Origen', 'Destino', 'Pasajero', 'RUT', 'Asiento',
      'Monto anulado', 'Motivo', 'Usuario que canceló'],
    rows: (report) => report.cancellations.map((ticket) => [
      value(ticket.sale_code), ticket.cancelled_at, value(ticket.origin), ticket.destination,
      ticket.passenger_name, value(ticket.passenger_rut), ticket.seat_number, ticket.price_paid,
      value(ticket.cancel_reason), value(ticket.cancelled_by)
    ]),
    currencyColumns: [7]
  },
  fleet: {
    name: 'Flota y Mantención',
    headers: ['Fecha', 'Bus/Patente', 'Problema detectado', 'Estado', 'Responsable', 'Notas'],
    rows: (report) => report.fleetEvents.map((event) => [
      event.reported_at, event.vehicle, event.description, fleetStatuses[event.status] || event.status, value(event.responsible), value(event.admin_notes)
    ])
  },
  messages,
  activity: {
    name: 'Historial de Sucesos',
    headers: ['Fecha', 'Tipo', 'Detalle', 'Responsable'],
    rows: (report) => report.activity.map((event) => [event.created_at, event.type, event.description, event.actor])
  }
};

function appendSheet(workbook, definition, report) {
  const rows = definition.rows(report);
  const sheet = XLSX.utils.aoa_to_sheet([definition.headers, ...rows]);
  sheet['!cols'] = definition.headers.map((header) => ({ wch: Math.min(Math.max(header.length + 2, 14), 30) }));
  for (const column of definition.currencyColumns || []) {
    for (let row = 1; row <= rows.length; row += 1) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: column })];
      if (cell && cell.t === 'n') cell.z = '"$"#,##0';
    }
  }
  XLSX.utils.book_append_sheet(workbook, sheet, definition.name);
}

export function createReportWorkbook(report, filter = 'all') {
  const keys = filter === 'all' ? Object.keys(sheets) : [filter];
  if (keys.some((key) => !sheets[key])) throw new Error('El filtro de exportación no es válido.');
  const workbook = XLSX.utils.book_new();
  keys.forEach((key) => appendSheet(workbook, sheets[key], report));
  workbook.Props = { Title: 'Reportes de operación', Subject: `Período: ${periods[report.period] || report.period}` };
  return workbook;
}

export function createMessagesWorkbook(items) {
  const workbook = XLSX.utils.book_new();
  appendSheet(workbook, messages, { messages: items });
  return workbook;
}

export function exportMessagesToExcel(items) {
  XLSX.writeFile(createMessagesWorkbook(items), 'mensajes-y-reclamos.xlsx');
}

export function exportReportToExcel(report, filter = 'all') {
  const date = new Date();
  const stamp = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  XLSX.writeFile(createReportWorkbook(report, filter), `reportes-${report.period}-${stamp}.xlsx`);
}
