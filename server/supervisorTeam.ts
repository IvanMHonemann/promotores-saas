import { TRPCError } from "@trpc/server";

export const SUPERVISOR_PROMOTER_ONLY_MESSAGE = "O supervisor só pode cadastrar e editar promotores.";

/** Impede o supervisor de criar, promover ou alterar administrador ou outro supervisor. */
export function assertSupervisorPromoterOnly(actorRole: string | null | undefined, targetRole: string | null | undefined) {
  if (actorRole !== "supervisor") return;
  if (targetRole !== "promoter") {
    throw new TRPCError({ code: "FORBIDDEN", message: SUPERVISOR_PROMOTER_ONLY_MESSAGE });
  }
}
