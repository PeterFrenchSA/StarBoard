export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
      <h1 className="mb-2 text-3xl font-black">You are offline</h1>
      <p className="text-slate-600">
        StarBoard will sync activity when your connection is back. Your cached dashboard shell is still available.
      </p>
    </main>
  );
}
