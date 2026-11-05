import { useRef, useState } from "react";

import DropdownMenu from "@excalidraw/excalidraw/components/dropdownMenu/DropdownMenu";
import { useI18n } from "@excalidraw/excalidraw/i18n";
import { getShortcutKey } from "@excalidraw/excalidraw/shortcut";

import { DrawingCompanionSprite } from "./DrawingCompanionSprite";

import "./DrawingCompanion.scss";

import type { CompanionSnapshot } from "./behavior";

const TIP_SHORTCUTS = {
  pan: "Space",
  shortcuts: "?",
  group: "CtrlOrCmd+G",
  undo: "CtrlOrCmd+Z",
} as const;

export const DrawingCompanionView = ({
  snapshot,
  reducedMotion,
  paused,
  tipsEnabled,
  onToggleTips,
  onHide,
}: {
  snapshot: CompanionSnapshot;
  reducedMotion: boolean;
  paused: boolean;
  tipsEnabled: boolean;
  onToggleTips: () => void;
  onHide: () => void;
}): React.JSX.Element => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const closeMenu = () => {
    const root = rootRef.current;
    if (root && root.contains(root.ownerDocument.activeElement)) {
      root
        .querySelector<HTMLButtonElement>(".drawing-companion__trigger")
        ?.focus();
    }
    setOpen(false);
  };
  const bubble = !paused && snapshot.bubble;
  return (
    <div
      ref={rootRef}
      className="drawing-companion"
      data-pose={snapshot.pose}
      data-paused={paused}
      data-reduced-motion={reducedMotion}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onTouchStart={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      onKeyUp={(event) => event.stopPropagation()}
    >
      {bubble && (
        <div className="drawing-companion__bubble">
          {bubble.kind === "tip" ? (
            <>
              <span className="drawing-companion__tip-label">
                {t("drawingCompanion.tipLabel")}
              </span>
              {t(`drawingCompanion.tips.${bubble.id}`, {
                shortcut: getShortcutKey(TIP_SHORTCUTS[bubble.id]),
              })}
            </>
          ) : (
            t(`drawingCompanion.messages.${bubble.id}`)
          )}
        </div>
      )}
      <DropdownMenu open={open}>
        <DropdownMenu.Trigger
          className="drawing-companion__trigger"
          aria-label={t("drawingCompanion.label")}
          title={t("drawingCompanion.label")}
          onToggle={() => setOpen((value) => !value)}
          onKeyDown={(event) => {
            if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) {
              event.preventDefault();
              setOpen(true);
            }
          }}
        >
          <DrawingCompanionSprite pose={snapshot.pose} />
        </DropdownMenu.Trigger>
        <DropdownMenu.Content
          className="drawing-companion__menu"
          onClickOutside={closeMenu}
          onSelect={closeMenu}
        >
          <DropdownMenu.ItemCheckbox
            role="menuitemcheckbox"
            aria-checked={tipsEnabled}
            checked={tipsEnabled}
            onSelect={onToggleTips}
          >
            {t("drawingCompanion.tipsEnabled")}
          </DropdownMenu.ItemCheckbox>
          <DropdownMenu.Item onSelect={onHide}>
            {t("drawingCompanion.hide")}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu>
    </div>
  );
};
