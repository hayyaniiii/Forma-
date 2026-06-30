export default function Logo({ size = 32 }) {
  return (
    <div className="flex items-center gap-2.5 no-drag">
      <img src="/screen-removebg-preview.png" alt="Forma Logo" className="object-contain rounded-md shadow-sm" style={{ width: size, height: size }} />
      <span
        className="font-medium tracking-wide text-discord-text"
        style={{ fontSize: size * 0.45 }}
      >
        Forma
      </span>
    </div>
  );
}
