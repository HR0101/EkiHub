/** An abstract rail diagram: starting stations converge on one meeting point. */
export function MeetingJourney() {
  return (
    <div className="meeting-journey" aria-hidden="true">
      <svg viewBox="0 0 320 144" fill="none" focusable="false">
        <path className="journey-grid" d="M0 32h320M0 64h320M0 96h320M0 128h320M32 0v144M64 0v144M96 0v144M128 0v144M160 0v144M192 0v144M224 0v144M256 0v144M288 0v144" />
        <g className="journey-rails">
          <path d="M40 36h44q20 0 32 18l44 42" />
          <path d="M280 36h-44q-20 0-32 18l-44 42" />
          <path d="M40 120h68q22 0 36-14l16-10" />
        </g>
        <g className="journey-routes" pathLength="1">
          <path pathLength="1" d="M40 36h44q20 0 32 18l44 42" />
          <path pathLength="1" d="M280 36h-44q-20 0-32 18l-44 42" />
          <path pathLength="1" d="M40 120h68q22 0 36-14l16-10" />
        </g>
        {[[40, 36], [280, 36], [40, 120]].map(([x, y], index) => (
          <g className={`journey-origin journey-origin--${index}`} key={index}>
            <circle cx={x} cy={y} r="12" />
            <text x={x} y={y! + 4} textAnchor="middle">{index + 1}</text>
          </g>
        ))}
        <g transform="translate(160 96)">
          <circle className="journey-arrival" r="28" />
          <g className="journey-pin">
            <path className="journey-pin__shadow" d="M4 8S-20-12-20-28a24 24 0 1 1 48 0C28-12 4 8 4 8Z" />
            <path className="journey-pin__body" d="M0 4S-24-16-24-32a24 24 0 1 1 48 0C24-16 0 4 0 4Z" />
            <circle cx="0" cy="-32" r="9" />
            <path d="m-4-32 3 3 6-7" />
          </g>
        </g>
      </svg>
    </div>
  );
}
