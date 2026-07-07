export default function ComingSoonView({ board }) {
  return (
    <div className="coming-soon-view">
      <div className="icon">{board?.navIcon || '🔜'}</div>
      <h2>{board?.label}</h2>
      <p>The {board?.label} is being built and will connect to the Appraisal and Estimate boards.</p>
    </div>
  );
}
