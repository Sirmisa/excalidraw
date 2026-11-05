import "./CompanionRoutines.scss";

import type { CompanionRoutine } from "./useCompanionRoutines";

export const CompanionArtwork = ({
  reducedMotion,
  routine,
}: {
  reducedMotion: boolean;
  routine: CompanionRoutine;
}) => (
  <svg viewBox="0 0 140 120" aria-hidden="true">
    <ellipse className="companion__shadow" cx="70" cy="112" rx="40" ry="5" />
    {routine === "bathroom" && (
      <g className="companion__prop">
        <title>Little door</title>
        <rect x="44" y="24" width="53" height="84" rx="6" fill="#eee3cc" />
        <path d="M53 108V34H88V108" fill="#f9f4e8" />
        <circle cx="82" cy="70" r="2" fill="#ae9676" />
        <path d="M65 43H77" stroke="#bda98c" />
      </g>
    )}
    <g
      className="companion__body"
      style={{
        animation: reducedMotion
          ? "none"
          : routine === "eating"
          ? "companion-chew 1.8s ease-in-out infinite"
          : routine === "bathroom"
          ? "companion-step-out 8s ease-in-out both"
          : routine === "sleeping"
          ? "companion-breathe 8s ease-in-out infinite"
          : "companion-breathe 7s ease-in-out infinite",
      }}
    >
      <path
        className="companion__shape"
        d="M19 89C12 74 25 65 29 51C34 31 43 20 62 23C80 11 99 28 101 44C106 58 125 64 120 85C117 105 100 109 78 107C56 112 28 110 19 89Z"
      />
      {routine === "sleeping" ? (
        <path
          className="companion__sleep-eyes"
          d="M53 64Q57 68 61 64M78 64Q82 68 86 64"
        />
      ) : (
        <g
          className="companion__eyes"
          style={{
            animation: reducedMotion ? "none" : "companion-blink 6.7s infinite",
          }}
        >
          <ellipse cx="57" cy="63" rx="3.5" ry="5" />
          <ellipse cx="82" cy="63" rx="3.5" ry="5" />
        </g>
      )}
      <g className="companion__cheeks">
        <ellipse cx="47" cy="73" rx="5" ry="3" />
        <ellipse cx="92" cy="73" rx="5" ry="3" />
      </g>
      <path className="companion__smile" d="M65 76Q70 80 75 76" />
    </g>
    {routine === "eating" && (
      <g className="companion__prop companion__cookie">
        <title>Cookie</title>
        <circle cx="99" cy="82" r="11" fill="#e9c48c" />
        <path
          d="M92 77L94 78M102 74L103 76M105 85L107 86M96 87L97 88"
          stroke="#aa8056"
        />
      </g>
    )}
    {routine === "drinking" && (
      <g className="companion__prop companion__cup">
        <title>Cup</title>
        <path d="M106 80Q119 77 116 88Q114 94 106 91" fill="none" />
        <path d="M88 77H108L106 100H91Z" fill="#f8f6ec" />
        <path d="M93 73Q89 69 94 65" fill="none" stroke="#a2ad95" />
      </g>
    )}
    {routine === "sleeping" && (
      <g className="companion__prop">
        <title>Pillow</title>
        <ellipse cx="71" cy="108" rx="39" ry="5" fill="#d6cce5" />
        <text
          className="companion__sleep-z"
          x="108"
          y="39"
          fill="#a495b6"
          stroke="none"
          fontSize="14"
          fontFamily="serif"
        >
          z
        </text>
      </g>
    )}
    {routine === "drawing" && (
      <g className="companion__prop">
        <title>Sketchbook</title>
        <path d="M83 97L113 91L127 108L94 115Z" fill="#f9f6e9" />
        <path
          d="M96 104Q102 99 108 104Q113 109 117 104"
          stroke="#aba2be"
          fill="none"
        />
        <path
          className="companion__pencil"
          d="M101 99L109 77L113 79L105 101L101 104Z"
          fill="#e3c98c"
        />
      </g>
    )}
  </svg>
);
