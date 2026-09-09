"use client";
export default function ErrorPage({ reset }: { reset: () => void }) { return <main><h1>Terjadi kesalahan</h1><button onClick={reset}>Coba lagi</button></main>; }
