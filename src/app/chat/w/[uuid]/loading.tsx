export default function ChatSessionLoading() {
  return (
    <div
      className="chat-container-bg"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-secondary)',
      }}
      role="status"
      aria-live="polite"
    >
      Memuat sesi chat...
    </div>
  );
}
