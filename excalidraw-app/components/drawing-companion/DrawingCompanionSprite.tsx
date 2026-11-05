import type { CompanionPose } from "./behavior";

export const DrawingCompanionSprite = ({
  pose,
}: {
  pose: CompanionPose;
}): React.JSX.Element => (
  <svg
    className="drawing-companion__sprite"
    viewBox="0 0 96 96"
    aria-hidden="true"
    focusable="false"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <g className="drawing-companion__body">
      <path
        className="drawing-companion__blob"
        d="M16 65C13 52 21 43 25 31C28 20 40 17 49 23C59 16 72 24 73 36C75 47 83 53 80 67C78 79 67 82 48 81C29 84 18 78 16 65Z"
      />
      {pose === "sleeping" ? (
        <g
          className="drawing-companion__eyes"
          stroke="var(--companion-ink)"
          strokeWidth="2.8"
        >
          <path d="M32 51Q36 55 40 51M55 51Q59 55 63 51" />
        </g>
      ) : (
        <g className="drawing-companion__eyes" fill="var(--companion-ink)">
          <ellipse cx="36" cy="50" rx="3" ry="4.5" />
          <ellipse cx="59" cy="50" rx="3" ry="4.5" />
          <circle cx="37" cy="48.5" r="0.9" fill="#fff" />
          <circle cx="60" cy="48.5" r="0.9" fill="#fff" />
        </g>
      )}
      <g fill="var(--companion-cheek)" opacity=".65">
        <ellipse cx="27" cy="58" rx="5" ry="2.3" />
        <ellipse cx="67" cy="58" rx="5" ry="2.3" />
      </g>
    </g>
    {pose === "drawing" && (
      <g stroke="var(--companion-ink)" strokeWidth="1.7">
        <path d="M24 74L58 71L67 88L29 89Z" fill="var(--companion-paper)" />
        <path
          d="M34 80L40 77L43 81L49 78L54 83"
          stroke="var(--companion-accent)"
        />
        <g className="drawing-companion__pencil">
          <path d="M53 78L65 52L71 55L59 81L53 84Z" fill="#ffd58a" />
          <path d="M53 78L53 84L59 81" fill="var(--companion-paper)" />
          <path
            d="M65 52L67 48Q68 46 71 48L73 49Q74 50 73 52L71 55"
            fill="#efb2c5"
          />
        </g>
      </g>
    )}
    {pose === "eating" && (
      <g
        className="drawing-companion__snack"
        stroke="var(--companion-ink)"
        strokeWidth="1.7"
      >
        <path
          d="M66 58C72 56 79 59 79 64C85 65 84 76 77 79C68 84 58 78 59 70C55 65 60 59 66 58Z"
          fill="#eec287"
        />
        <g fill="var(--companion-ink)" stroke="none">
          <circle cx="65" cy="67" r="1.7" />
          <circle cx="75" cy="73" r="1.7" />
          <circle cx="68" cy="76" r="1.5" />
        </g>
      </g>
    )}
    {pose === "drinking" && (
      <g
        className="drawing-companion__cup"
        stroke="var(--companion-ink)"
        strokeWidth="1.8"
      >
        <path d="M75 63H80Q87 63 85 69Q84 73 77 72" />
        <path d="M58 59H78L76 77Q68 82 60 77Z" fill="var(--companion-paper)" />
        <path d="M58 59Q68 56 78 59Q69 63 58 59Z" fill="#b78865" />
        <path
          d="M65 52Q61 48 65 44M72 52Q69 48 72 45"
          stroke="var(--companion-accent)"
        />
      </g>
    )}
    {pose === "sleeping" && (
      <g
        className="drawing-companion__sleep"
        stroke="var(--companion-accent)"
        strokeWidth="2.3"
      >
        <path d="M68 24H76L68 32H76M78 10H88L78 20H88" />
      </g>
    )}
    {pose === "bathroom" && (
      <g stroke="var(--companion-ink)" strokeWidth="1.8">
        <path
          d="M42 86V19Q42 15 46 15H78Q82 15 82 19V86"
          fill="var(--companion-paper)"
        />
        <path d="M48 86V22H76V86" fill="var(--companion-door)" />
        <circle cx="69" cy="56" r="2" fill="var(--companion-ink)" />
        <path d="M57 36V33Q62 29 67 33V36" />
        <rect
          x="54"
          y="36"
          width="16"
          height="13"
          rx="3"
          fill="var(--companion-paper)"
        />
        <path d="M62 41V44" />
      </g>
    )}
  </svg>
);
