import { splitMessageLinks } from "@shared/platformAnnouncements";

export function AnnouncementMessage({ text, className }: { text: string; className?: string }) {
  const parts = splitMessageLinks(text);
  return (
    <p className={`whitespace-pre-wrap break-words ${className ?? ""}`}>
      {parts.map((part, index) => (
        part.type === "link" ? (
          <a
            key={`${part.href}-${index}`}
            href={part.href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-teal-200 underline decoration-teal-200/60 underline-offset-2 hover:text-teal-100"
          >
            {part.value}
          </a>
        ) : (
          <span key={index}>{part.value}</span>
        )
      ))}
    </p>
  );
}
