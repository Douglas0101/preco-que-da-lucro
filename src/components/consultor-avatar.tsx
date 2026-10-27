import { cn } from "@/lib/utils";

/**
 * Monograma do consultor. É decorativo (`aria-hidden`): quem nomeia o controle
 * é o launcher/título ao redor, nunca a letra.
 */
function ConsultorAvatar({
  className,
  statusBorderClassName = "border-popover",
}: Readonly<{ className?: string; statusBorderClassName?: string }>) {
  return (
    <span
      aria-hidden="true"
      data-slot="consultor-avatar"
      className={cn(
        "relative grid size-9 shrink-0 place-items-center rounded-full bg-primary font-heading text-sm font-semibold text-primary-foreground",
        className,
      )}
    >
      S
      <span
        className={cn(
          "absolute -end-0.5 -bottom-0.5 size-2.5 rounded-full border-2 bg-success",
          statusBorderClassName,
        )}
      />
    </span>
  );
}

export { ConsultorAvatar };
