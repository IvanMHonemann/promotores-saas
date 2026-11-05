import { reverseGeocode } from "@/lib/geocode";
import { useEffect, useState } from "react";

export type Coordinates = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

export function getCurrentPosition(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!window.isSecureContext) {
      reject(new Error("O registro com GPS exige uma conexão segura HTTPS."));
      return;
    }
    if (!navigator.geolocation) {
      reject(new Error("Este navegador não oferece GPS."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      }),
      (error) => {
        const message = error.code === error.PERMISSION_DENIED
          ? "A localização foi bloqueada. Nas permissões do site, permita Localização e tente novamente."
          : error.code === error.POSITION_UNAVAILABLE
            ? "O aparelho não conseguiu determinar a localização. Ative o GPS e tente em um local aberto."
            : error.code === error.TIMEOUT
              ? "A localização demorou para responder. Ative o GPS e tente novamente."
              : "Não foi possível obter a localização. Confira as permissões do GPS e tente novamente.";
        reject(new Error(message));
      },
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 },
    );
  });
}

export function LocationLabel({ latitude, longitude }: { latitude: number | null; longitude: number | null }) {
  const [label, setLabel] = useState("Consultando endereço...");

  useEffect(() => {
    if (latitude == null || longitude == null) {
      setLabel("Localização não informada");
      return;
    }

    let alive = true;
    void reverseGeocode(latitude, longitude).then((address) => { if (alive) setLabel(address || "Endereço não identificado"); });
    return () => { alive = false; };
  }, [latitude, longitude]);

  return <span>{label}</span>;
}
