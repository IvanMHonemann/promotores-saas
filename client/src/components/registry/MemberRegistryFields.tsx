import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCpf, formatPis } from "@shared/brDocs";
import { emptyMemberRegistry, type MemberRegistry } from "@shared/registryFields";

const defaultClass = "mt-1 border-white/15 bg-slate-950/60 text-white";

export function MemberRegistryFields({
  value,
  onChange,
  disabled,
  inputClassName = defaultClass,
}: {
  value: MemberRegistry;
  onChange?: (next: MemberRegistry) => void;
  disabled?: boolean;
  inputClassName?: string;
}) {
  const v = { ...emptyMemberRegistry(), ...value };
  const set = (patch: Partial<MemberRegistry>) => onChange?.({ ...v, ...patch });
  const readOnly = disabled || !onChange;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <Label>CPF</Label>
        <Input value={v.cpf ? formatCpf(v.cpf) : v.cpf} onChange={(e) => set({ cpf: e.target.value })} placeholder="000.000.000-00" className={inputClassName} disabled={readOnly} inputMode="numeric" />
      </div>
      <div>
        <Label>PIS / NIS</Label>
        <Input value={v.pis ? formatPis(v.pis) : v.pis} onChange={(e) => set({ pis: e.target.value })} placeholder="000.00000.00-0" className={inputClassName} disabled={readOnly} inputMode="numeric" />
      </div>
      <div>
        <Label>RG</Label>
        <Input value={v.rg} onChange={(e) => set({ rg: e.target.value })} className={inputClassName} disabled={readOnly} />
      </div>
      <div>
        <Label>Data de nascimento</Label>
        <Input type="date" value={v.birthDate} onChange={(e) => set({ birthDate: e.target.value })} className={inputClassName} disabled={readOnly} />
      </div>
      <div>
        <Label>Cargo / função</Label>
        <Input value={v.jobTitle} onChange={(e) => set({ jobTitle: e.target.value })} className={inputClassName} disabled={readOnly} />
      </div>
      <div>
        <Label>Data de admissão</Label>
        <Input type="date" value={v.admissionDate} onChange={(e) => set({ admissionDate: e.target.value })} className={inputClassName} disabled={readOnly} />
      </div>
      <div className="sm:col-span-2">
        <Label>Telefone</Label>
        <Input value={v.phone} onChange={(e) => set({ phone: e.target.value })} className={inputClassName} disabled={readOnly} />
      </div>
    </div>
  );
}

export function registryFromMember(member: Partial<Record<keyof MemberRegistry, string | null | undefined>> | null | undefined): MemberRegistry {
  return {
    ...emptyMemberRegistry(),
    cpf: String(member?.cpf ?? ""),
    pis: String(member?.pis ?? ""),
    rg: String(member?.rg ?? ""),
    birthDate: String(member?.birthDate ?? ""),
    jobTitle: String(member?.jobTitle ?? ""),
    admissionDate: String(member?.admissionDate ?? ""),
    phone: String(member?.phone ?? ""),
  };
}
