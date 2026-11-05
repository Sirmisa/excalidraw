import {
  useApp,
  useExcalidrawContainer,
} from "@excalidraw/excalidraw/components/App";
import { useI18n } from "@excalidraw/excalidraw/i18n";
import { useUIAppState } from "@excalidraw/excalidraw/context/ui-appState";
import { useLayoutEffect, useState } from "react";

import "./Companion.scss";

export const Companion = ({
  enabled,
  onHide,
}: {
  enabled: boolean;
  onHide: () => void;
}) => {
  const app = useApp();
  const { container } = useExcalidrawContainer();
  const { t } = useI18n();
  const { isLoading, zenModeEnabled, viewModeEnabled, openDialog } =
    useUIAppState();
  // Resolve owning browser preferences before revealing the first pose.
  const [documentHidden, setDocumentHidden] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  useLayoutEffect(() => {
    const ownerDocument = app.ownerDocument;
    // Application dialogs and imperative confirmations also use this owned
    // portal container, without necessarily setting the editor's openDialog.
    const updateModal = () =>
      setModalOpen(
        !!ownerDocument.body.querySelector(
          '.excalidraw-modal-container [role="dialog"][aria-modal="true"]',
        ),
      );
    const observer = new app.ownerWindow.MutationObserver(updateModal);
    observer.observe(ownerDocument.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["role", "aria-modal"],
    });
    updateModal();
    return () => observer.disconnect();
  }, [app]);

  useLayoutEffect(() => {
    const motionQuery = app.ownerWindow.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    const onMotionChange = () => setReducedMotion(motionQuery.matches);
    onMotionChange();
    motionQuery.addEventListener("change", onMotionChange);
    return () => motionQuery.removeEventListener("change", onMotionChange);
  }, [app]);

  useLayoutEffect(() => {
    const ownerDocument = app.ownerDocument;
    const onVisibilityChange = () => setDocumentHidden(ownerDocument.hidden);
    onVisibilityChange();
    ownerDocument.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      ownerDocument.removeEventListener("visibilitychange", onVisibilityChange);
  }, [app]);

  if (
    !enabled ||
    documentHidden ||
    isLoading ||
    zenModeEnabled ||
    viewModeEnabled ||
    openDialog ||
    modalOpen
  ) {
    return null;
  }

  return (
    <div className="companion">
      <div role="img" aria-label={t("companion.description")}>
        <svg viewBox="0 0 140 120" aria-hidden="true">
          <ellipse
            className="companion__shadow"
            cx="70"
            cy="112"
            rx="40"
            ry="5"
          />
          <g
            className="companion__body"
            style={{
              animation: reducedMotion
                ? "none"
                : "companion-breathe 7s ease-in-out infinite",
            }}
          >
            <path
              className="companion__shape"
              d="M19 89C12 74 25 65 29 51C34 31 43 20 62 23C80 11 99 28 101 44C106 58 125 64 120 85C117 105 100 109 78 107C56 112 28 110 19 89Z"
            />
            <g
              className="companion__eyes"
              style={{
                animation: reducedMotion
                  ? "none"
                  : "companion-blink 6.7s infinite",
              }}
            >
              <ellipse cx="57" cy="63" rx="3.5" ry="5" />
              <ellipse cx="82" cy="63" rx="3.5" ry="5" />
            </g>
            <g className="companion__cheeks">
              <ellipse cx="47" cy="73" rx="5" ry="3" />
              <ellipse cx="92" cy="73" rx="5" ry="3" />
            </g>
            <path className="companion__smile" d="M65 76Q70 80 75 76" />
          </g>
        </svg>
      </div>
      <button
        type="button"
        className="companion__hide"
        aria-label={t("companion.hide")}
        onClick={(event) => {
          const restoreFocus =
            app.ownerDocument.activeElement === event.currentTarget;
          onHide();
          if (restoreFocus) {
            container
              ?.querySelector<HTMLButtonElement>(".main-menu-trigger")
              ?.focus();
          }
        }}
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
};
