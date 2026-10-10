import { getDb, createClient, createExtinguisher, createServiceOrder } from "./db";

async function runSeed() {
  console.log("Iniciando seed de dados demonstrativos...");
  const db = await getDb();
  if (!db) {
    console.error("Banco não conectado!");
    return;
  }

  const accountId = 1;

  const client1Id = await createClient({
    accountId,
    companyName: "Padaria e Confeitaria Central",
    cnpj: "18.345.982/0001-44",
    address: "Av. 20 de Setembro, 1250, Centro",
    city: "Sapiranga",
    cep: "93800-000",
    phone: "(51) 3599-1234",
    contactName: "Marcos Antônio da Silva",
    cpf: "452.871.900-22",
    birthDate: "14/08/1978",
    notes: "Atendimento preferencial pela manhã",
  });

  const d1 = new Date();
  d1.setDate(d1.getDate() + 12);
  const d2 = new Date();
  d2.setFullYear(d2.getFullYear() + 1);

  await createExtinguisher({
    accountId,
    clientId: client1Id,
    typeModel: "PQS ABC 4kg",
    capacity: "4kg",
    serialNumber: "INM-008741",
    locationInBuilding: "Área de Atendimento / Caixa",
    expirationDate: d1.toISOString().split("T")[0] as any,
    lastInspectionDate: new Date().toISOString().split("T")[0] as any,
  }, accountId);

  await createExtinguisher({
    accountId,
    clientId: client1Id,
    typeModel: "AP 10L (Água)",
    capacity: "10L",
    serialNumber: "INM-009122",
    locationInBuilding: "Cozinha Industrial / Fornos",
    expirationDate: d2.toISOString().split("T")[0] as any,
    lastInspectionDate: new Date().toISOString().split("T")[0] as any,
  }, accountId);

  const client2Id = await createClient({
    accountId,
    companyName: "Metalúrgica Vale dos Sinos",
    cnpj: "09.123.456/0001-89",
    address: "Rua Bento Gonçalves, 3400, Pátria Nova",
    city: "Novo Hamburgo",
    cep: "93510-001",
    phone: "(51) 99876-5432",
    contactName: "Cláudio Roberto Vargas",
    cpf: "312.980.110-54",
    birthDate: "05/11/1965",
  });

  const dExpired = new Date();
  dExpired.setDate(dExpired.getDate() - 5);

  await createExtinguisher({
    accountId,
    clientId: client2Id,
    typeModel: "CO2 6kg",
    capacity: "6kg",
    serialNumber: "INM-003319",
    locationInBuilding: "Quadro de Comando Elétrico",
    expirationDate: dExpired.toISOString().split("T")[0] as any,
    lastInspectionDate: "2025-09-18" as any,
  }, accountId);

  await createExtinguisher({
    accountId,
    clientId: client2Id,
    typeModel: "PQS ABC 6kg",
    capacity: "6kg",
    serialNumber: "INM-004410",
    locationInBuilding: "Galpão de Solda",
    expirationDate: d1.toISOString().split("T")[0] as any,
    lastInspectionDate: new Date().toISOString().split("T")[0] as any,
  }, accountId);

  const client3Id = await createClient({
    accountId,
    companyName: "Auto Peças Progresso",
    cnpj: "33.789.012/0001-11",
    address: "Av. Brasil, 890, Bairro Paulista",
    city: "Campo Bom",
    cep: "93700-000",
    phone: "(51) 3597-9000",
    contactName: "Renata de Souza",
    cpf: "789.231.550-01",
    birthDate: "22/03/1984",
  });

  const dWarning = new Date();
  dWarning.setDate(dWarning.getDate() + 25);

  await createExtinguisher({
    accountId,
    clientId: client3Id,
    typeModel: "PQS BC 4kg",
    capacity: "4kg",
    serialNumber: "INM-007721",
    locationInBuilding: "Oficina Mecânica",
    expirationDate: dWarning.toISOString().split("T")[0] as any,
    lastInspectionDate: new Date().toISOString().split("T")[0] as any,
  }, accountId);

  await createServiceOrder(
    {
      accountId,
      orderNumber: 1001,
      orderDate: new Date().toISOString().split("T")[0] as any,
      clientId: client1Id,
      replacedAndDelivered: "SIM",
      leftReserve: "NÃO",
      reserveDetails: "",
      extinguisherExpiration: "09/2027",
      licenseExpiration: "12/2026",
      totalAmount: "195.00" as any,
      paymentMethod: "A VISTA",
      installmentsCount: 1,
      installmentDates: "À vista no ato",
      responsibleName: "Marcos Antônio da Silva",
      responsibleCpf: "452.871.900-22",
      responsibleBirthDate: "14/08/1978",
      observations: "Manutenção periódica conforme norma NBR 12962",
    },
    [
      { description: "Recarga Extintor PQS 4kg ABC", quantity: 2, unitPrice: "45.00" as any, totalPrice: "90.00" as any },
      { description: "Recarga Extintor AP 10L Água", quantity: 1, unitPrice: "40.00" as any, totalPrice: "40.00" as any },
      { description: "Teste Hidrostático e Troca de Válvula", quantity: 1, unitPrice: "65.00" as any, totalPrice: "65.00" as any },
    ],
    accountId,
  );

  console.log("Dados demonstrativos inseridos com sucesso!");
  process.exit(0);
}

runSeed().catch(console.error);
