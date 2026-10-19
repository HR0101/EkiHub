import Image from "next/image";
import { useId } from "react";

const ILLUSTRATOR_ICONS = [
  "terminal",
  "mobile",
  "retro",
  "clay",
  "neumo",
  "glass",
  "violet",
] as const;

/** Y2K keeps its original drawing. Other designs use Illustrator SVG exports. */
export function ThemeArtwork() {
  const id = useId().replace(/:/g, "");
  return (
    <div className="theme-art" aria-hidden="true">
      <svg
        className="theme-art__scene theme-art__scene--y2k"
        viewBox="0 0 320 210"
        width="320"
        height="210"
        fill="none"
        focusable="false"
      >
        <defs>
          <linearGradient
            id={`${id}-chrome`}
            x1="100"
            y1="20"
            x2="210"
            y2="190"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#fff" />
            <stop offset=".25" stopColor="#adb7d0" />
            <stop offset=".48" stopColor="#fafaff" />
            <stop offset=".53" stopColor="#737b9e" />
            <stop offset=".8" stopColor="#e6eaff" />
            <stop offset="1" stopColor="#8a76c1" />
          </linearGradient>
        </defs>
        <g>
          <ellipse
            cx="160"
            cy="105"
            rx="143"
            ry="43"
            stroke="#7f62af"
            strokeWidth="2"
            transform="rotate(-22 160 105)"
          />
          <circle
            cx="160"
            cy="105"
            r="62"
            fill={`url(#${id}-chrome)`}
            stroke="#fff"
            strokeWidth="2"
          />
          <ellipse
            cx="160"
            cy="105"
            rx="145"
            ry="44"
            stroke={`url(#${id}-chrome)`}
            strokeWidth="10"
            transform="rotate(24 160 105)"
          />
          <circle
            cx="63"
            cy="65"
            r="10"
            fill="#c8acf2"
            stroke="#fff"
            strokeWidth="2"
          />
          <circle cx="269" cy="149" r="7" fill="#7762a2" />
          <path
            d="M251 21v34m-17-17h34M52 156v24m-12-12h24"
            stroke="#fff"
            strokeWidth="3"
          />
        </g>
      </svg>
      {ILLUSTRATOR_ICONS.map((theme) => (
        <Image
          key={theme}
          className={`theme-art__scene theme-art__scene--${theme}`}
          src={`/theme-icons/${theme}.svg`}
          alt=""
          width={320}
          height={210}
          unoptimized
        />
      ))}
    </div>
  );
}
