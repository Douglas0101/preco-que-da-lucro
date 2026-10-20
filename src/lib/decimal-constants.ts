import Decimal from "decimal.js";

/**
 * Constantes compartilhadas do motor financeiro (DT-04).
 *
 * `Decimal` é imutável em todas as operações públicas: métodos como `plus`,
 * `mul` e `div` devolvem novas instâncias e nunca mutam o receiver. Reutilizar
 * `0` e `1` elimina alocações repetidas nos laços de margem, ponto de
 * equilíbrio e impostos — e `Object.freeze` impede que um chamador futuro
 * trate-as como acumuladores mutáveis.
 */
export const DECIMAL_ZERO = Object.freeze(new Decimal(0));
export const DECIMAL_ONE = Object.freeze(new Decimal(1));
