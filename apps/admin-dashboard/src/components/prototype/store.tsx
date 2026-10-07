"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence } from "motion/react";
import {
  ORDERS,
  type ChartMetric,
  type ChartPeriod,
  type Order,
  type OrderStatus,
} from "./data";
import { OrderDetailDialog } from "./orders";
import { ProtoButton, ProtoDialog, Toast } from "./ui";

/* -------------------------------------------------------------------------- */
/* Shared prototype state                                                      */
/*                                                                            */
/* The prototype shell (sidebar, header, bottom nav) persists across routes,   */
/* so the state that several pages share lives here: the mutable order list,   */
/* the global search query, the chart controls, and the toast queue.           */
/* -------------------------------------------------------------------------- */

export type StatusFilter = OrderStatus | "Semua";

export type PrototypeStore = {
  orders: Order[];
  query: string;
  setQuery: (value: string) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (value: StatusFilter) => void;
  chartMetric: ChartMetric;
  setChartMetric: (value: ChartMetric) => void;
  chartPeriod: ChartPeriod;
  setChartPeriod: (value: ChartPeriod) => void;
  isLoading: boolean;
  notify: (message: string) => void;
  openOrder: (order: Order) => void;
  verifyPayment: (order: Order) => void;
  changeStatus: (order: Order, status: OrderStatus) => void;
  requestCancel: (order: Order) => void;
};

const PrototypeContext = createContext<PrototypeStore | null>(null);

export function usePrototype(): PrototypeStore {
  const store = useContext(PrototypeContext);
  if (store === null) {
    throw new Error("usePrototype harus dipakai di dalam PrototypeProvider.");
  }
  return store;
}

export function PrototypeProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>(ORDERS);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("Semua");
  const [chartMetric, setChartMetric] = useState<ChartMetric>("income");
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>("30h");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const toastTimer = useRef<number | null>(null);

  // One short skeleton pass on first paint so the loading states are visible.
  useEffect(() => {
    const timer = window.setTimeout(() => setIsLoading(false), 900);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => {
      setToast("");
      toastTimer.current = null;
    }, 2600);
  }, []);

  const openOrder = useCallback((order: Order) => {
    setSelectedOrderId(order.id);
  }, []);

  const verifyPayment = useCallback(
    (order: Order) => {
      setOrders((previous) =>
        previous.map((row): Order => {
          if (row.id !== order.id) return row;
          const advanced: OrderStatus =
            row.status === "Baru" || row.status === "Menunggu Data"
              ? "Diproses"
              : row.status;
          return { ...row, payment: "Lunas", status: advanced };
        }),
      );
      notify(`Pembayaran ${order.id} berhasil diverifikasi`);
    },
    [notify],
  );

  const changeStatus = useCallback(
    (order: Order, status: OrderStatus) => {
      setOrders((previous) =>
        previous.map((row): Order =>
          row.id === order.id ? { ...row, status } : row,
        ),
      );
      notify(`Status ${order.id} diubah menjadi ${status}`);
    },
    [notify],
  );

  const requestCancel = useCallback((order: Order) => {
    setCancelTargetId(order.id);
  }, []);

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId) ?? null,
    [orders, selectedOrderId],
  );

  const cancelTarget = useMemo(
    () => orders.find((order) => order.id === cancelTargetId) ?? null,
    [orders, cancelTargetId],
  );

  const handleConfirmCancel = useCallback(() => {
    if (cancelTarget === null) return;
    const { id } = cancelTarget;
    setOrders((previous) =>
      previous.map((row): Order =>
        row.id === id ? { ...row, status: "Dibatalkan" } : row,
      ),
    );
    setCancelTargetId(null);
    setSelectedOrderId(null);
    notify(`Pesanan ${id} dibatalkan`);
  }, [cancelTarget, notify]);

  const store: PrototypeStore = {
    orders,
    query,
    setQuery,
    statusFilter,
    setStatusFilter,
    chartMetric,
    setChartMetric,
    chartPeriod,
    setChartPeriod,
    isLoading,
    notify,
    openOrder,
    verifyPayment,
    changeStatus,
    requestCancel,
  };

  return (
    <PrototypeContext.Provider value={store}>
      {children}

      {/* Dialogs and toasts are global: any page can trigger them. */}
      <OrderDetailDialog
        order={selectedOrder}
        onClose={() => setSelectedOrderId(null)}
        onPreview={(order) => notify(`Preview undangan ${order.event} dibuka`)}
        onContact={(order) => notify(`Pesan untuk ${order.customer} disiapkan`)}
        onVerifyPayment={verifyPayment}
        onChangeStatus={changeStatus}
        onRequestCancel={requestCancel}
      />

      <ProtoDialog
        open={cancelTarget !== null}
        onClose={() => setCancelTargetId(null)}
        title="Batalkan pesanan?"
        description={
          cancelTarget
            ? `${cancelTarget.id} · ${cancelTarget.customer} · ${cancelTarget.event}`
            : undefined
        }
        footer={
          <div className="flex flex-col gap-2 sm:flex-row">
            <ProtoButton
              className="flex-1"
              onClick={() => setCancelTargetId(null)}
            >
              Pertahankan pesanan
            </ProtoButton>
            <ProtoButton
              className="flex-1"
              variant="danger"
              onClick={handleConfirmCancel}
            >
              Ya, batalkan
            </ProtoButton>
          </div>
        }
      >
        {cancelTarget ? (
          <div className="space-y-3 text-sm text-[var(--p-ink-soft)]">
            <p>
              Pesanan akan ditandai{" "}
              <strong className="font-semibold text-[var(--p-ink)]">
                Dibatalkan
              </strong>{" "}
              dan undangan tidak akan diproses lebih lanjut.
            </p>
            <p className="rounded-2xl border border-[var(--p-line)] bg-[var(--p-canvas)] p-3 text-xs">
              Tindakan ini tidak mengembalikan pembayaran yang sudah lunas.
              Proses pengembalian dana dilakukan manual dari halaman Pembayaran.
            </p>
          </div>
        ) : null}
      </ProtoDialog>

      <AnimatePresence>
        {toast ? <Toast message={toast} /> : null}
      </AnimatePresence>
    </PrototypeContext.Provider>
  );
}
