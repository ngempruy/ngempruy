import Link from "next/link";

export default function NotFound() {
  return (
    <div className="bg-base-200 flex h-full flex-1 items-center justify-center">
      <div className="text-center">
        <h1 className="m-0 mb-1 text-6xl font-bold">404</h1>
        <h2 className="m-0 text-2xl font-semibold">Page Not Found</h2>
        <p className="text-base-content/70 m-0 mb-4">The page you&apos;re looking for doesn&apos;t exist.</p>
        <Link href="/" className="btn btn-primary">
          Go Home
        </Link>
      </div>
    </div>
  );
}
