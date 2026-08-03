import Toast, { type ToastData } from './toast.tsx'

// Renders the active toasts in a fixed stack (bottom-right).
export default function ToastContainer({
  toasts,
  onClose,
}: {
  toasts: ToastData[]
  onClose: (id: string) => void
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-64"
    >
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onClose={onClose} />
      ))}
    </div>
  )
}
