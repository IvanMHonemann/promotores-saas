import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, MessageCircle } from "lucide-react";
import { jsPDF } from "jspdf";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface ServiceOrderDocumentProps {
  order: any;
  client: any;
  items: any[];
  onBack?: () => void;
  /** Nome da empresa que emite a OS (opcional; se omitido, busca via assinatura) */
  issuerCompanyName?: string;
}

export function ServiceOrderDocument({
  order,
  client,
  items = [],
  onBack,
  issuerCompanyName,
}: ServiceOrderDocumentProps) {
  const componentRef = useRef<HTMLDivElement>(null);
  const mine = trpc.billing.mySubscription.useQuery(undefined, {
    enabled: !issuerCompanyName,
    retry: false,
  });
  const companyLabel =
    (issuerCompanyName ||
      (mine.data as any)?.company?.name ||
      order?.companyName ||
      order?.issuerCompanyName ||
      "").toString().trim() || "Empresa";

  const handlePrint = () => {
    window.print();
  };

  const handleShareWhatsApp = async () => {
    if (!componentRef.current) return;

    try {
      toast.info("Gerando o PDF da Ordem de Serviço...");
      const pdf = new jsPDF("p", "mm", "a4");
      const margin = 12;
      const pageWidth = 210;
      const pageHeight = 297;
      const contentWidth = pageWidth - margin * 2;
      let y = 14;
      const lineHeight = 4.5;
      const ensureSpace = (height: number) => {
        if (y + height > pageHeight - margin) {
          pdf.addPage();
          y = margin;
        }
      };
      const text = (value: unknown) => String(value ?? "—");
      const money = (value: unknown) => value === undefined || value === null || value === "" ? "" : `R$ ${Number(value).toFixed(2)}`;
      const section = (title: string) => {
        // Reserve espaço entre a faixa do título e o primeiro campo para que
        // o texto nunca seja desenhado sobre a borda ou sobre o cabeçalho.
        ensureSpace(12);
        pdf.setFillColor(226, 232, 240);
        pdf.rect(margin, y, contentWidth, 8, "F");
        pdf.setDrawColor(30, 41, 59);
        pdf.rect(margin, y, contentWidth, 8);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8.5);
        pdf.text(title, pageWidth / 2, y + 5.3, { align: "center" });
        y += 11;
      };
      const row = (label: string, value: string, x = margin + 3, width = contentWidth - 6) => {
        const lines = pdf.splitTextToSize(value, width - 42);
        ensureSpace(Math.max(1, lines.length) * lineHeight + 1);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        pdf.text(label, x, y);
        pdf.setFont("helvetica", "normal");
        pdf.text(lines, x + 42, y);
        y += Math.max(1, lines.length) * lineHeight + 1;
      };
      const paragraph = (label: string, value: string) => {
        const lines = pdf.splitTextToSize(value, contentWidth - 48);
        ensureSpace(Math.max(1, lines.length) * lineHeight + 3);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        pdf.text(label, margin + 3, y);
        pdf.setFont("helvetica", "normal");
        pdf.text(lines, margin + 48, y);
        y += Math.max(1, lines.length) * lineHeight + 2;
      };

      pdf.setDrawColor(15, 23, 42);
      pdf.setLineWidth(0.6);
      pdf.setFont("helvetica", "bold");
      const headerName = companyLabel.length > 28 ? companyLabel.slice(0, 28) + "…" : companyLabel;
      pdf.setFontSize(headerName.length > 18 ? 14 : 18);
      pdf.text(headerName, margin, y + 7);
      pdf.setFontSize(9);
      pdf.text("ORDEM DE SERVIÇO / MANUTENÇÃO", margin, y + 13);
      pdf.setFontSize(15);
      pdf.text("ORDEM DE SERVIÇO", pageWidth - margin, y + 7, { align: "right" });
      pdf.setFontSize(9);
      pdf.text(`Nº: ${String(order?.orderNumber || 1001).padStart(5, "0")}`, pageWidth - margin, y + 13, { align: "right" });
      pdf.text(`DATA: ${formatDateBR(order?.orderDate)}`, pageWidth - margin, y + 18, { align: "right" });
      y += 24;
      pdf.line(margin, y, pageWidth - margin, y);
      y += 4;

      section("DADOS DO CLIENTE");
      row("EMPRESA:", text(client?.companyName));
      row("ENDEREÇO:", text(client?.address));
      row("CIDADE:", `${text(client?.city)}   CEP: ${text(client?.cep)}`);
      row("CNPJ:", `${text(client?.cnpj)}   FONE: ${text(client?.phone)}`);
      row("RESPONSÁVEL:", text(order?.responsibleName || client?.contactName));
      row("CPF:", `${text(order?.responsibleCpf || client?.cpf)}   NASC.: ${text(order?.responsibleBirthDate || client?.birthDate)}`);
      y += 3;

      section("SERVIÇOS PRESTADOS");
      const tableTop = y;
      const col = [margin, margin + 93, margin + 116, margin + 151, pageWidth - margin];
      pdf.rect(margin, y, contentWidth, 8);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      ["DESCRIÇÃO", "QTD.", "VALOR UNID.", "VALOR TOTAL"].forEach((label, i) => pdf.text(label, col[i] + (i === 0 ? 3 : (col[i + 1] - col[i]) / 2), y + 5, { align: i === 0 ? "left" : "center" }));
      y += 8;
      displayItems.forEach((item) => {
        const descriptionLines = item.description ? pdf.splitTextToSize(text(item.description), 84) : [""];
        const rowHeight = Math.max(7, descriptionLines.length * 4 + 3);
        ensureSpace(rowHeight);
        pdf.rect(margin, y, contentWidth, rowHeight);
        pdf.setFont("helvetica", "normal");
        pdf.text(descriptionLines, margin + 3, y + 4);
        pdf.text(text(item.quantity), col[1] + 11, y + 4, { align: "center" });
        pdf.text(money(item.unitPrice), col[2] + 17, y + 4, { align: "right" });
        pdf.text(money(item.totalPrice), col[3] + 27, y + 4, { align: "right" });
        col.slice(1, -1).forEach((x) => pdf.line(x, y, x, y + rowHeight));
        y += rowHeight;
      });
      pdf.line(col[1], tableTop, col[1], y);
      pdf.line(col[2], tableTop, col[2], y);
      pdf.line(col[3], tableTop, col[3], y);
      y += 5;

      section("STATUS E VENCIMENTOS");
      row("CRIADA POR:", text(order?.createdByName || "Usuário não registrado (OS antiga)"));
      row("TROCADO E ENTREGUE:", `${text(order?.replacedAndDelivered)}    DEIXOU RESERVA: ${text(order?.leftReserve)}`);
      row("VENCIMENTO DO EXTINTOR:", formatDateBR(order?.extinguisherExpiration));
      row("VENCIMENTO DO ALVARÁ:", formatDateBR(order?.licenseExpiration));
      y += 3;

      section("OBSERVAÇÕES");
      paragraph("OBSERVAÇÕES:", text(order?.observations || "Nenhuma observação registrada."));
      y += 2;

      section("FORMA DE PAGAMENTO");
      row("VALOR TOTAL:", money(order?.totalAmount));
      row("FORMA DE PAGAMENTO:", text(order?.paymentMethod));
      if (showsInstallmentDetails) {
        row("NÚMERO DE PARCELAS:", text(order?.installmentsCount || 1));
        row("DATAS:", text(order?.installmentDates));
      }
      y += 13;
      ensureSpace(28);
      pdf.line(margin, y, margin + 78, y);
      pdf.line(pageWidth - margin - 78, y, pageWidth - margin, y);
      pdf.setFontSize(8);
      const signName = companyLabel.length > 32 ? companyLabel.slice(0, 32) + "…" : companyLabel;
      pdf.text(signName, margin + 39, y + 5, { align: "center" });
      pdf.text("PROPRIETÁRIO OU RESPONSÁVEL", pageWidth - margin - 39, y + 5, { align: "center" });
      pdf.text(`CPF: ${text(order?.responsibleCpf || client?.cpf)}`, pageWidth - margin - 78, y + 10);
      pdf.text(`DATA NASC.: ${text(order?.responsibleBirthDate || client?.birthDate)}`, pageWidth - margin - 78, y + 15);

      // Rodapé com a marca Extinfy
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
      pdf.setTextColor(100, 116, 139);
      pdf.text("Extinfy — Gestão de Extintores  •  Documento gerado pelo sistema", pageWidth / 2, pageHeight - 8, { align: "center" });
      pdf.setTextColor(0, 0, 0);

      const orderNumber = String(order?.orderNumber || order?.id || "ordem").padStart(5, "0");
      const fileName = `ordem-servico-${orderNumber}.pdf`;
      const file = new File([pdf.output("blob")], fileName, { type: "application/pdf" });
      const shareData = {
        title: `Ordem de Serviço ${orderNumber}`,
        text: "Segue a Ordem de Serviço em PDF.",
        files: [file],
      };

      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (isMobile) {
        if (!navigator.share) {
          toast.error("Este navegador não oferece compartilhamento direto de arquivos. Abra o site no Chrome ou Safari atualizado.");
          return;
        }
        try {
          await navigator.share(shareData);
          toast.success("Selecione o WhatsApp para enviar a Ordem de Serviço.");
        } catch (shareError) {
          if ((shareError as DOMException)?.name !== "AbortError") {
            console.error("Falha no compartilhamento nativo do PDF:", shareError);
            toast.error("O celular não aceitou compartilhar o PDF. Tente pelo Chrome ou Safari atualizado.");
          }
        }
        return;
      }

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share(shareData);
          toast.success("PDF pronto para ser enviado. Selecione o WhatsApp na tela de compartilhamento.");
          return;
        } catch (shareError) {
          if ((shareError as DOMException)?.name === "AbortError") return;
          console.warn("O navegador não aceitou compartilhar o PDF como anexo; usando fallback.", shareError);
        }
      }

      // No PC, os navegadores bloqueiam anexar automaticamente um arquivo local ao WhatsApp Web.
      // Por isso, baixamos o PDF real e abrimos o WhatsApp Web para o usuário anexá-lo na conversa.
      const downloadUrl = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
      window.open("https://web.whatsapp.com/", "_blank", "noopener,noreferrer");
      toast.success("PDF baixado e WhatsApp Web aberto. Anexe o arquivo PDF na conversa do cliente.");
    } catch (error) {
      if ((error as DOMException)?.name !== "AbortError") {
        console.error("Falha ao gerar PDF:", error);
        toast.error("Não foi possível gerar o PDF. Tente novamente.");
      }
    }
  };

  // Formata data YYYY-MM-DD para DD / MM / AAAA
  const formatDateBR = (dateStr?: string | Date | null) => {
    if (!dateStr) return "__ / __ / ____";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr.toString();
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day} / ${month} / ${year}`;
  };

  // Preencher até pelo menos 7 linhas de serviços prestados para bater com o layout original
  const rowsNeeded = Math.max(7, items.length);
  const displayItems = [...items];
  while (displayItems.length < rowsNeeded) {
    displayItems.push({
      id: `empty-${displayItems.length}`,
      description: "",
      quantity: "",
      unitPrice: "",
      totalPrice: "",
    });
  }

  const isReplacedYes = order?.replacedAndDelivered?.toUpperCase() === "SIM";
  const isReplacedNo = order?.replacedAndDelivered?.toUpperCase() === "NÃO";
  const isReserveYes = order?.leftReserve?.toUpperCase() === "SIM";
  const isReserveNo = order?.leftReserve?.toUpperCase() === "NÃO";

  const isAVista = order?.paymentMethod?.toUpperCase().includes("VISTA");
  const isPix = order?.paymentMethod?.toUpperCase().includes("PIX");
  const isCredito = order?.paymentMethod?.toUpperCase().includes("CRÉDITO") || order?.paymentMethod?.toUpperCase().includes("CREDITO");
  const isParcelado = order?.paymentMethod?.toUpperCase().includes("PARCELADO");
  const isBoleto = order?.paymentMethod?.toUpperCase().includes("BOLETO");
  const showsInstallmentDetails = isCredito || isParcelado || isBoleto;

  return (
    <div className="flex flex-col items-center py-3 sm:py-6 px-2 sm:px-4 bg-slate-100 min-h-screen overflow-x-hidden">
      {/* Barra de Ações Superior (Oculta na Impressão) */}
      <div className="w-full max-w-4xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4 sm:mb-6 px-1 sm:px-4 print:hidden">
        {onBack && (
          <Button variant="outline" onClick={onBack} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>
        )}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <Button
            onClick={handleShareWhatsApp}
            variant="outline"
            className="border-green-600 text-green-700 hover:bg-green-50 gap-2 font-semibold"
          >
            <MessageCircle className="w-4 h-4" />
            Compartilhar arquivo PDF no WhatsApp
          </Button>
          <Button
            onClick={handlePrint}
            className="bg-red-700 hover:bg-red-800 text-white gap-2 font-semibold shadow-md"
          >
            <Printer className="w-4 h-4" />
            Imprimir / Salvar em PDF
          </Button>
        </div>
      </div>

      {/* DOCUMENTO IMPRESSO (Página A4 Exata) */}
      <div
        ref={componentRef}
        className="w-[calc(100vw-16px)] sm:w-[210mm] max-w-[210mm] min-h-0 sm:min-h-[297mm] overflow-hidden bg-white p-3 sm:p-[10mm] text-slate-900 shadow-xl border border-slate-300 print:shadow-none print:border-none print:p-0 print:w-full print:m-0 flex flex-col justify-between"
        style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
      >
        <div>
          {/* CABEÇALHO */}
          <div className="flex justify-between items-start border-b-2 border-slate-800 pb-3 mb-3">
            <div className="flex items-center gap-4">
              <div className="w-10 sm:w-16 h-12 sm:h-18 flex items-center justify-center">
                <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-red-700 text-white flex items-center justify-center text-xl sm:text-2xl font-black">
                  ✓
                </div>
              </div>
              <div className="border-l-2 border-slate-700 pl-3 min-w-0">
                <h1 className="text-base sm:text-xl font-black tracking-tight text-slate-900 leading-tight break-words">
                  {companyLabel}
                </h1>
                <p className="text-xs font-bold tracking-wider text-slate-800 uppercase mt-1">
                  Ordem de serviço / Manutenção
                </p>
              </div>
            </div>

            <div className="text-right">
              <h2 className="text-sm sm:text-lg font-black tracking-wide text-slate-900">
                ORDEM DE SERVIÇO
              </h2>
              <div className="text-sm font-bold mt-1 text-slate-800">
                Nº: <span className="font-mono text-base">{String(order?.orderNumber || 1001).padStart(5, '0')}</span>
              </div>
            <div className="text-xs font-semibold mt-1">
                DATA: <span className="font-bold underline decoration-slate-400">{formatDateBR(order?.orderDate)}</span>
              </div>
              <div className="text-[10px] font-semibold mt-1 text-slate-600">
                CRIADA POR: <span className="font-bold">{order?.createdByName || "Usuário não registrado (OS antiga)"}</span>
              </div>
            </div>
          </div>

          {/* DADOS DO CLIENTE */}
          <div className="border-2 border-slate-800 mb-3 text-[10px] sm:text-xs">
            <div className="bg-slate-200 text-center font-bold py-1 border-b-2 border-slate-800 tracking-wider">
              DADOS DO CLIENTE
            </div>

            <div className="p-2 space-y-1.5 font-medium leading-tight">
              <div className="flex border-b border-slate-300 pb-1">
                <span className="font-bold w-24">EMPRESA:</span>
                <span className="min-w-0 flex-1 break-words font-semibold text-slate-950 uppercase">{client?.companyName || "—"}</span>
              </div>

              <div className="flex border-b border-slate-300 pb-1">
                <span className="font-bold w-24">ENDEREÇO:</span>
                <span className="min-w-0 flex-1 break-words text-slate-900">{client?.address || "—"}</span>
              </div>

              <div className="flex flex-col gap-1 border-b border-slate-300 pb-1 sm:flex-row">
                <div className="flex-1 flex">
                  <span className="font-bold w-24">CIDADE:</span>
                  <span className="font-semibold text-slate-950 uppercase">{client?.city || "—"}</span>
                </div>
                <div className="flex w-full justify-start sm:w-48 sm:justify-end">
                  <span className="font-bold mr-2">CEP:</span>
                  <span>{client?.cep || "—"}</span>
                </div>
              </div>

              <div className="flex flex-col gap-1 border-b border-slate-300 pb-1 sm:flex-row">
                <div className="flex-1 flex">
                  <span className="font-bold w-24">CNPJ:</span>
                  <span className="font-mono">{client?.cnpj || "—"}</span>
                </div>
                <div className="flex w-full justify-start sm:w-56 sm:justify-end">
                  <span className="font-bold mr-2">FONE:</span>
                  <span className="font-mono">{client?.phone || "—"}</span>
                </div>
              </div>

              <div className="flex flex-col gap-1 border-b border-slate-300 pb-1 sm:flex-row">
                <span className="w-full font-bold sm:w-64">NOME DO PROPRITARIO OU RESPONSAVEL:</span>
                <span className="min-w-0 flex-1 break-words text-slate-950 uppercase font-semibold">
                  {order?.responsibleName || client?.contactName || "—"}
                </span>
              </div>

              <div className="flex flex-col gap-1 sm:flex-row">
                <div className="flex-1 flex">
                  <span className="font-bold w-24">CPF:</span>
                  <span className="font-mono">{order?.responsibleCpf || client?.cpf || "—"}</span>
                </div>
                <div className="flex w-full justify-start sm:w-64 sm:justify-end">
                  <span className="font-bold mr-2">DATA DE NASCIMENTO:</span>
                  <span>{order?.responsibleBirthDate || client?.birthDate || "—"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* SERVIÇOS PRESTADOS */}
          <div className="border-2 border-slate-800 mb-3 text-[10px] sm:text-xs">
            <div className="bg-slate-200 text-center font-bold py-1 border-b-2 border-slate-800 tracking-wider">
              SERVIÇOS PRESTADO
            </div>

            <table className="w-full table-fixed text-left border-collapse text-[10px] sm:text-xs">
              <thead>
                <tr className="border-b-2 border-slate-800 font-bold bg-slate-100 text-center">
                  <th className="p-1.5 border-r-2 border-slate-800 w-[55%] text-left pl-3">DESCRIÇÃO</th>
                  <th className="p-1.5 border-r-2 border-slate-800 w-[12%]">QTD.</th>
                  <th className="p-1.5 border-r-2 border-slate-800 w-[16%]">VALOR UNID</th>
                  <th className="p-1.5 w-[17%]">VALOR TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {displayItems.map((item, idx) => (
                  <tr
                    key={item.id || idx}
                    className="h-auto min-h-[26px] align-top border-b border-slate-400 text-slate-900"
                  >
                    <td className="min-w-0 break-words whitespace-normal p-1.5 align-top border-r-2 border-slate-800 pl-3 font-medium">
                      {item.description}
                    </td>
                    <td className="p-1.5 align-top border-r-2 border-slate-800 text-center font-semibold">
                      {item.quantity}
                    </td>
                    <td className="p-1.5 align-top border-r-2 border-slate-800 text-right pr-2 font-mono">
                      {item.unitPrice ? `R$ ${Number(item.unitPrice).toFixed(2)}` : ""}
                    </td>
                    <td className="p-1.5 align-top text-right pr-2 font-mono font-semibold">
                      {item.totalPrice ? `R$ ${Number(item.totalPrice).toFixed(2)}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* CAMPOS DE STATUS DA ENTREGA & VENCIMENTOS */}
          <div className="border-2 border-slate-800 mb-3 p-2 text-[10px] sm:text-xs space-y-1.5 font-bold">
            <div className="bg-slate-200 border-b-2 border-slate-800 py-1 text-center font-bold tracking-wider">STATUS E VENCIMENTOS</div>
            <div className="flex flex-wrap items-center gap-y-1">
              <span className="w-full sm:w-52">TROCADO E ENTREGUE:</span>
              <span className="mr-6">
                (&nbsp;{isReplacedYes ? "X" : "\u00A0\u00A0"}&nbsp;) SIM
              </span>
              <span>
                (&nbsp;{isReplacedNo ? "X" : "\u00A0\u00A0"}&nbsp;) NÃO
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-y-1">
              <span className="w-full sm:w-52">DEIXOU RESERVA:</span>
              <span className="mr-6">
                (&nbsp;{isReserveYes ? "X" : "\u00A0\u00A0"}&nbsp;) SIM
              </span>
              <span className="mr-8">
                (&nbsp;{isReserveNo ? "X" : "\u00A0\u00A0"}&nbsp;) NÃO
              </span>
              <div className="w-full sm:flex-1 flex items-center">
                <span className="mr-2">QUAIS:</span>
                <span className="flex-1 border-b border-slate-700 font-normal px-2">
                  {order?.reserveDetails || ""}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-y-1">
              <span className="w-full sm:w-52">VENCIMENTO DO EXTINTOR:</span>
              <span className="flex-1 border-b border-slate-700 font-semibold px-2 text-red-700">
                {order?.extinguisherExpiration || ""}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-y-1">
              <span className="w-full sm:w-52">VENCIMENTO DO ALVARÁ:</span>
              <span className="flex-1 border-b border-slate-700 font-semibold px-2">
                {order?.licenseExpiration || ""}
              </span>
            </div>
          </div>

          {/* OBSERVAÇÕES */}
          <div className="mb-3 border-2 border-slate-800 text-[10px] sm:text-xs">
            <div className="bg-slate-200 border-b-2 border-slate-800 py-1 text-center font-bold tracking-wider">OBSERVAÇÕES</div>
            <div className="min-h-[42px] whitespace-pre-wrap break-words p-2 leading-relaxed text-slate-900">
              {order?.observations || "Nenhuma observação registrada."}
            </div>
          </div>

          {/* FORMA DE PAGAMENTO */}
          <div className="border-2 border-slate-800 mb-4 text-[10px] sm:text-xs">
            <div className="bg-slate-200 text-center font-bold py-1 border-b-2 border-slate-800 tracking-wider">
              FORMA DE PAGAMENTO
            </div>

            <div className="p-2 space-y-1.5 font-bold">
              <div className="flex items-center text-sm">
                <span className="w-32">VALOR TOTAL:</span>
                <span className="bg-amber-300 px-2 py-0.5 rounded text-black font-black text-base font-mono">
                  R$ {Number(order?.totalAmount || 0).toFixed(2)}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-y-1 pt-1">
                <span className="w-full sm:w-48">FORMA DE PAGAMENTO:</span>
                <span className="mr-6">
                  (&nbsp;{isAVista ? "X" : "\u00A0\u00A0"}&nbsp;) À VISTA
                </span>
                <span className="mr-6">
                  (&nbsp;{isPix ? "X" : "\u00A0\u00A0"}&nbsp;) PIX
                </span>
                <span className="mr-6">
                  (&nbsp;{isCredito ? "X" : "\u00A0\u00A0"}&nbsp;) CRÉDITO
                </span>
                <span className="mr-6">
                  (&nbsp;{isParcelado ? "X" : "\u00A0\u00A0"}&nbsp;) PARCELADO
                </span>
                <span>
                  (&nbsp;{isBoleto ? "X" : "\u00A0\u00A0"}&nbsp;) BOLETO
                </span>
              </div>

              {showsInstallmentDetails && <>
                <div className="flex flex-wrap items-center gap-y-1">
                  <span className="w-full sm:w-48">NÚMEROS DE PARCELAS:</span>
                  <span className="border-b border-slate-700 px-2 font-normal sm:min-w-[60px]">
                    {order?.installmentsCount || 1}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-y-1">
                  <span className="w-full sm:w-48">DATAS:</span>
                  <span className="flex-1 border-b border-slate-700 px-2 font-normal">
                    {order?.installmentDates || ""}
                  </span>
                </div>
              </>}
            </div>
          </div>

          {/* ÁREA DE ASSINATURAS */}
          <div className="grid grid-cols-2 gap-8 pt-8 pb-4 text-xs text-center font-bold">
            <div>
              <div className="border-t-2 border-slate-800 pt-1.5 uppercase break-words">
                {companyLabel}
              </div>
            </div>

            <div className="text-left font-mono text-[11px] leading-tight">
              <div className="border-t-2 border-slate-800 pt-1.5 font-bold font-sans">
                PROPRIETARIO OU RESPONSAVEL
              </div>
              <div className="mt-1">
                CPF: <span className="font-normal">{order?.responsibleCpf || client?.cpf || "______________________"}</span>
              </div>
              <div className="mt-0.5">
                DATA NASC: <span className="font-normal">{order?.responsibleBirthDate || client?.birthDate || "____ / ____ / ________"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* RODAPÉ — marca Extinfy */}
        <div className="border-t-2 border-slate-800 pt-2 text-[9px] sm:text-[10.5px] leading-relaxed text-slate-700 text-center">
          <div className="font-bold text-slate-900">Extinfy — Gestão de Extintores</div>
          <div>Documento gerado pelo sistema • Controle de manutenção e validade</div>
        </div>

      </div>

      {/* ESTILOS DE IMPRESSÃO CSS */}
      <style>{`
        @media print {
          body {
            background-color: white !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          @page {
            size: A4 portrait;
            margin: 8mm 10mm;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
