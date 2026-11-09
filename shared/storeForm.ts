export type StoreFormValues = { name: string; city: string; state: string; address: string };
export type StorePayload = { name: string; city: string; state?: string; address?: string };

/** Validação do cadastro de loja (mesma regra em /lojas e em Roteiros). */
export function validateStoreForm(form: StoreFormValues): { ok: true; payload: StorePayload } | { ok: false; message: string } {
  const name = form.name.trim();
  const city = form.city.trim();
  const state = form.state.trim().toUpperCase();
  if (name.length < 2) return { ok: false, message: "Informe o nome da loja." };
  if (city.length < 2) return { ok: false, message: "Informe a cidade." };
  if (state && state.length !== 2) return { ok: false, message: "Use a sigla do estado com 2 letras (ex.: SP)." };
  return { ok: true, payload: { name, city, state: state || undefined, address: form.address.trim() || undefined } };
}
