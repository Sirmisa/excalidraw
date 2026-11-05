import { Footer } from "@excalidraw/excalidraw/index";
import React from "react";

import { isExcalidrawPlusSignedUser } from "../app_constants";

import { DebugFooter, isVisualDebuggerEnabled } from "./DebugCanvas";
import { EncryptedIcon } from "./EncryptedIcon";

import { DrawingCompanion } from "./drawing-companion/DrawingCompanion";

import type {
  CompanionPreferences,
  UpdateCompanionPreferences,
} from "./drawing-companion/preferences";

export const AppFooter = React.memo(
  ({
    onChange,
    companionPreferences,
    onCompanionPreferencesChange,
    companionSuppressed,
  }: {
    onChange: () => void;
    companionPreferences: CompanionPreferences | null;
    onCompanionPreferencesChange: UpdateCompanionPreferences;
    companionSuppressed: boolean;
  }) => {
    return (
      <Footer>
        {companionPreferences && (
          <DrawingCompanion
            preferences={companionPreferences}
            onPreferencesChange={onCompanionPreferencesChange}
            suppressed={companionSuppressed}
          />
        )}
        <div
          style={{
            display: "flex",
            gap: ".5rem",
            alignItems: "center",
          }}
        >
          {isVisualDebuggerEnabled() && <DebugFooter onChange={onChange} />}
          {!isExcalidrawPlusSignedUser && <EncryptedIcon />}
        </div>
      </Footer>
    );
  },
);
