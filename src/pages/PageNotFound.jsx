import { Link } from 'react-router-dom';

export default function PageNotFound() {
  return (
    <div className="py-24 text-center">
      <div className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">§ 404</div>
      <h1 className="mt-4 font-serif text-5xl">This page was <em className="font-light">never printed</em>.</h1>
      <p className="mt-4 font-mono text-xs text-muted-foreground">The edition you are looking for does not exist.</p>
      <Link to="/" className="mt-8 inline-block font-mono text-[11px] uppercase tracking-wider underline-offset-4 hover:underline">Back to the Overview →</Link>
    </div>
  );
}
