import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCep, formatCpfOrCnpj } from "@shared/brDocs";
import { BR_STATES, emptyCompanyRegistry, type CompanyRegistry } from "@shared/registryFields";

const defaultClass = "mt-1 border-white/15 bg-slate-950/60 text-white";

export function CompanyRegistryForm({
  value,
  onChange,
  disabled,
  inputClassName = defaultClass,
}: {
  value: CompanyRegistry;
  onChange?: (next: CompanyRegistry) => void;
  disabled?: boolean;
  inputClassName?: string;
}) {
  const v = { ...emptyCompanyRegistry(), ...value };
  const set = (patch: Partial<CompanyRegistry>) => onChange?.({ ...v, ...patch });
  const readOnly = disabled || !onChange;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="md:col-span-2">
        <Label>Razão social</Label>
        <Input value={v.legalName} onChange={(e) => set({ legalName: e.target.value })} className={inputClassName} disabled={readOnly} />
      </div>
      <div>
        <Label>Nome fantasia</Label>
        <Input value={v.tradeName} onChange={(e) => set({ tradeName: e.target.value })} className={inputClassName} disabled={readOnly} />
      </div>
      <div>
        <Label>CNPJ ou CPF (MEI)</Label>
        <Input value={v.taxDocument ? formatCpfOrCnpj(v.taxDocument) : v.taxDocument} onChange={(e) => set({ taxDocument: e.target.value })} placeholder="00.000.000/0001-00" className={inputClassName} disabled={readOnly} inputMode="numeric" />
      </div>
      <div>
        <Label>Inscrição estadual</Label>
        <Input value={v.stateRegistration} onChange={(e) => set({ stateRegistration: e.target.value })} className={inputClassName} disabled={readOnly} />
      </div>
      <div>
        <Label>Unidade / estabelecimento</Label>
        <Input value={v.establishment} onChange={(e) => set({ establishment: e.target.value })} placeholder="Ex.: Matriz" className={inputClassName} disabled={readOnly} />
      </div>
      <div>
        <Label>CEP</Label>
        <Input value={v.addressZip ? formatCep(v.addressZip) : v.addressZip} onChange={(e) => set({ addressZip: e.target.value })} placeholder="00000-000" className={inputClassName} disabled={readOnly} inputMode="numeric" />
      </div>
      <div className="md:col-span-2">
        <Label>Logradouro</Label>
        <Input value={v.addressStreet} onChange={(e) => set({ addressStreet: e.target.value })} className={inputClassName} disabled={readOnly} />
      </div>
      <div>
        <Label>Número</Label>
        <Input value={v.addressNumber} onChange={(e) => set({ addressNumber: e.target.value })} className={inputClassName} disabled={readOnly} />
      </div>
      <div>
        <Label>Complemento</Label>
        <Input value={v.addressComplement} onChange={(e) => set({ addressComplement: e.target.value })} className={inputClassName} disabled={readOnly} />
      </div>
      <div>
        <Label>Bairro</Label>
        <Input value={v.addressDistrict} onChange={(e) => set({ addressDistrict: e.target.value })} className={inputClassName} disabled={readOnly} />
      </div>
      <div>
        <Label>Cidade</Label>
        <Input value={v.addressCity} onChange={(e) => set({ addressCity: e.target.value })} className={inputClassName} disabled={readOnly} />
      </div>
      <div>
        <Label>UF</Label>
        <select value={v.addressState} onChange={(e) => set({ addressState: e.target.value })} disabled={readOnly} className={`${inputClassName} h-10 w-full rounded-md border px-3 text-sm`}>
          <option value="">Selecione</option>
          {BR_STATES.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
        </select>
      </div>
      <div>
        <Label>Telefone de contato</Label>
        <Input value={v.contactPhone} onChange={(e) => set({ contactPhone: e.target.value })} className={inputClassName} disabled={readOnly} />
      </div>
      <div>
        <Label>E-mail de contato</Label>
        <Input type="email" value={v.contactEmail} onChange={(e) => set({ contactEmail: e.target.value })} className={inputClassName} disabled={readOnly} />
      </div>
    </div>
  );
}
