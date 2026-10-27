/**
 * Regras de lojas compartilhadas entre o frontend e o backend (funções puras, sem dependências).
 * O backend é quem decide; o frontend usa as mesmas regras só para esconder o que o usuário não pode usar.
 */

/** Nome exibido para fotos registradas sem loja. */
export const NO_STORE_LABEL = "Sem loja vinculada";
/** Segmento de URL da galeria de fotos sem loja (/lojas/sem-loja). */
export const NO_STORE_ROUTE_KEY = "sem-loja";

/** Somente administradores e supervisores da empresa cadastram lojas. */
export function canManageStores(role: string | null | undefined): boolean {
  return role === "company_admin" || role === "supervisor";
}

/** Remove repetidos e valores inválidos, mantendo a ordem informada. */
export function normalizeStoreIds(ids: ReadonlyArray<number> | null | undefined): number[] {
  const seen = new Set<number>();
  for (const id of ids ?? []) {
    if (Number.isInteger(id) && id > 0) seen.add(id);
  }
  return [...seen];
}

export type StoreAssignmentPlan =
  /** Não mexe nos vínculos. */
  | { mode: "keep"; storeIds: [] }
  /** Só acrescenta (lojas do roteiro semanal de quem não informou a lista de lojas). */
  | { mode: "add"; storeIds: number[] }
  /** Substitui a lista inteira (adiciona as novas e remove as que saíram). */
  | { mode: "replace"; storeIds: number[] };

/**
 * Decide o que fazer com os vínculos promotor ↔ loja ao salvar um promotor.
 *  - `explicit` undefined: o formulário não enviou a lista (ex.: módulo de campo desligado) → não remove nada;
 *  - `explicit` definido (inclusive vazio): é a lista completa do promotor;
 *  - lojas usadas no roteiro semanal também precisam estar vinculadas, senão o promotor não as acessaria.
 */
export function planStoreAssignments(explicit: ReadonlyArray<number> | undefined, weeklyStoreIds: ReadonlyArray<number> = []): StoreAssignmentPlan {
  const weekly = normalizeStoreIds(weeklyStoreIds);
  if (explicit === undefined) {
    return weekly.length ? { mode: "add", storeIds: weekly } : { mode: "keep", storeIds: [] };
  }
  return { mode: "replace", storeIds: normalizeStoreIds([...explicit, ...weekly]) };
}
