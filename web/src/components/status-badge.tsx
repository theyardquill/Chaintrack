import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL, TXN_LABEL, type PackageStatus, type TxnStatus } from "@/lib/types";

const STYLES: Record<PackageStatus, string> = {
  Registered: "bg-muted text-foreground hover:bg-muted",
  InTransit: "bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/60 dark:text-blue-200",
  OutForDelivery: "bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/60 dark:text-amber-200",
  Delivered: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/60 dark:text-emerald-200",
  Failed: "bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-900/60 dark:text-red-200",
  Cancelled: "bg-zinc-200 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300",
};

const TXN_STYLES: Record<TxnStatus, string> = {
  Pending: "bg-zinc-200 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300",
  InEscrow: "bg-sky-100 text-sky-700 hover:bg-sky-100 dark:bg-sky-900/60 dark:text-sky-200",
  Paid: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/60 dark:text-emerald-200",
  Refunded: "bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/60 dark:text-amber-200",
  Cancelled: "bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-900/60 dark:text-red-200",
};

export function StatusBadge({ status }: { status: PackageStatus }) {
  return <Badge className={STYLES[status]}>{STATUS_LABEL[status]}</Badge>;
}

export function TxnBadge({ status }: { status: TxnStatus }) {
  return <Badge className={TXN_STYLES[status]}>{TXN_LABEL[status]}</Badge>;
}