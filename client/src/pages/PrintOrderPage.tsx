import React from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { ServiceOrderDocument } from "@/components/ServiceOrderDocument";
import { Loader2 } from "lucide-react";

export default function PrintOrderPage() {
  const [match, params] = useRoute("/os/:id");
  const orderId = params?.id ? parseInt(params.id, 10) : null;

  const orderQuery = trpc.orders.byId.useQuery(
    { id: orderId! },
    { enabled: !!orderId }
  );

  if (orderQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <Loader2 className="w-8 h-8 animate-spin text-red-600" />
      </div>
    );
  }

  if (!orderQuery.data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-700">
        Ordem de Serviço não encontrada.
      </div>
    );
  }

  return (
    <ServiceOrderDocument
      order={orderQuery.data}
      client={orderQuery.data.client}
      items={orderQuery.data.items}
      onBack={() => {
        if (window.history.length > 1) window.history.back();
        else window.location.href = "/";
      }}
    />
  );
}
