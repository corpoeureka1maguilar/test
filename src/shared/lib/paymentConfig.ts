// generic-partial-payment: tope de piernas de pago por venta (gift card + N
// cobros VPOS sucesivos). La gift card cuenta como 1 pierna. v1: constante;
// mover a config store si operaciones lo pide (el state model soporta N sin
// cambios — ver design.md Open Questions).
export const MAX_PAYMENT_LEGS = 4
