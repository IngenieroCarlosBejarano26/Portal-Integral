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
    Updated: 'usuario:updated',
    /** El rol del usuario cambió. Payload: `{ usuarioId, oldRolId, newRolId }`.
     *  Solo el usuario afectado debe refrescar su JWT. */
    RolChanged: 'usuario:rol-changed',
    /** El usuario fue desactivado/eliminado. Payload: `{ usuarioId }`.
     *  Solo el usuario afectado debe cerrar sesión. */
    Deactivated: 'usuario:deactivated'
  },
  Permiso: {
    Updated: 'permiso:updated',
    /** Los permisos asignados a un rol cambiaron. Payload: `{ rolId: string }`.
     *  Los clientes con ese rol deben llamar `authService.refreshToken()`. */
    RolPermissionsChanged: 'rol:permissions-changed'
  },
  PagoWompi: {
    /** Webhook de Wompi confirmo el pago. El plan se activo automaticamente. */
    Approved: 'pago-wompi:approved',
    /** Webhook de Wompi marco el pago como rechazado/anulado/error. */
    Declined: 'pago-wompi:declined'
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
  | typeof RealtimeEvents.Usuario[keyof typeof RealtimeEvents.Usuario]
  | typeof RealtimeEvents.Permiso[keyof typeof RealtimeEvents.Permiso]
  | typeof RealtimeEvents.PagoWompi[keyof typeof RealtimeEvents.PagoWompi];
