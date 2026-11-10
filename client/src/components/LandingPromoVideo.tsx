import { Pause, Play, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import poster from "@/assets/promo/gondup-promo-poster.webp";
import promoMp4 from "@/assets/promo/gondup-promo.mp4";
import promoWebm from "@/assets/promo/gondup-promo.webm";

/**
 * Vídeo de demonstração da landing: mudo, em loop, e só baixa quando
 * a seção entra perto da tela. Com "reduzir movimento" no sistema,
 * fica só o pôster até a pessoa tocar em Reproduzir.
 */
export default function LandingPromoVideo() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [inView, setInView] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [manualPaused, setManualPaused] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: "80px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (inView && !reducedMotion) setLoaded(true);
  }, [inView, reducedMotion]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !loaded) return;
    video.load();
  }, [loaded]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !loaded) return;
    if (inView && !reducedMotion && !manualPaused) {
      void video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [inView, loaded, reducedMotion, manualPaused]);

  const togglePlayback = () => {
    if (playing) {
      videoRef.current?.pause();
      setManualPaused(true);
      return;
    }
    setReducedMotion(false);
    setManualPaused(false);
    setLoaded(true);
  };

  return (
    <section
      id="video"
      className="relative z-10 mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20"
    >
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-300">
        Na prática
      </p>
      <h2 className="mt-3 max-w-3xl text-3xl font-black tracking-tight text-white sm:text-5xl">
        Veja o GondUp em ação
      </h2>
      <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
        Um passeio rápido pelo app no celular: ponto, evidências, validades e o
        que cada perfil vê.
      </p>

      <div className="mx-auto mt-10 mb-24 w-full max-w-[20rem] sm:mb-0 sm:max-w-[22rem]">
        <div
          ref={wrapRef}
          className="relative overflow-hidden rounded-[1.8rem] border border-white/10 bg-slate-950 shadow-2xl shadow-teal-950/40 aspect-[9/16]"
        >
          <img
            src={poster}
            alt="Prévia do vídeo do GondUp: celular com a tela Controle da equipe em campo"
            width={720}
            height={1280}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-cover"
            muted
            loop
            playsInline
            preload="none"
            // Sem atributo poster: alguns navegadores baixam o pôster na hora, mesmo com preload=none.
            aria-label="Vídeo demonstrativo do GondUp, sem áudio"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          >
            {loaded ? (
              <>
                <source src={promoWebm} type="video/webm" />
                <source src={promoMp4} type="video/mp4" />
              </>
            ) : null}
          </video>

          <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-slate-950/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-200 backdrop-blur-sm">
            <VolumeX className="h-3 w-3 text-teal-300" aria-hidden />
            Sem áudio
          </span>

          <button
            type="button"
            onClick={togglePlayback}
            className={
              playing
                ? "absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-slate-950/70 text-white backdrop-blur-sm transition hover:bg-slate-950/90"
                : "absolute inset-0 flex items-center justify-center bg-slate-950/20 text-white transition hover:bg-slate-950/30"
            }
            aria-label={playing ? "Pausar vídeo" : "Reproduzir vídeo"}
          >
            {playing ? (
              <Pause className="h-4 w-4" fill="currentColor" />
            ) : (
              <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-slate-950/70 text-white backdrop-blur-sm">
                <Play className="h-6 w-6 translate-x-0.5" fill="currentColor" />
              </span>
            )}
          </button>
        </div>
        <p className="mt-3 text-center text-xs text-slate-400">
          Vídeo ilustrativo, em loop e sem áudio · cerca de 50 segundos
        </p>
      </div>
    </section>
  );
}
