/**
 * Constantes con los nombres de los eventos en tiempo real.
 * MANTENER SINCRONIZADO con Application/Common/Realtime/RealtimeEvents.cs
 */
export const RealtimeEvents = {
  Cliente: {
    Created: 'cliente:created',
    Updated: 'cliente:updated',
    Deleted: 'cliente:deleted'
  },
  Empresa: {
    Created: 'empresa:created',
    Updated: 'empresa:updated',
    Deleted: 'empresa:deleted'
  },
  Valera: {
    Created: 'valera:created',
    Updated: 'valera:updated',
    Deleted: 'valera:deleted'
  },
  Consumo: {
    Created: 'consumo:created',
    Updated: 'consumo:updated',
    Deleted: 'consumo:deleted'
  },
  Rol: {
    Created: 'rol:created',
    Updated: 'rol:updated',
    Deleted: 'rol:deleted'
  },
  Tenant: {
    Created: 'tenant:created',
    Updated: 'tenant:updated',
    Deleted: 'tenant:deleted'
  },
  Usuario: {
    Created: 'usuario:created',
    Updated: 'usuario:updated'
  }
} as const;

/** Tipo unión de todos los nombres de evento. */
export type RealtimeEventName =
  | typeof RealtimeEvents.Cliente[keyof typeof RealtimeEvents.Cliente]
  | typeof RealtimeEvents.Empresa[keyof typeof RealtimeEvents.Empresa]
  | typeof RealtimeEvents.Valera[keyof typeof RealtimeEvents.Valera]
  | typeof RealtimeEvents.Consumo[keyof typeof RealtimeEvents.Consumo]
  | typeof RealtimeEvents.Rol[keyof typeof RealtimeEvents.Rol]
  | typeof RealtimeEvents.Tenant[keyof typeof RealtimeEvents.Tenant]
  | typeof RealtimeEvents.Usuario[keyof typeof RealtimeEvents.Usuario];
