import { useState } from "react";
import { useIsPresentationTool } from "@sanity/visual-editing/react";
import { VisualEditingComponent } from "@sanity/astro/visual-editing/component";

const STORAGE_KEY = "sanity-visual-editing-disabled";

interface Props {
  enabled: boolean;
}

export default function VisualEditingToggle({ enabled }: Props) {
  const isPresentationTool = useIsPresentationTool();
  const [disabled, setDisabled] = useState(
    () => window.localStorage.getItem(STORAGE_KEY) === "1",
  );

  if (!enabled) return null;

  // Outside the Presentation Tool's iframe, give the editor a way to turn the
  // hover overlay off (and back on) for this browser, since it otherwise stays
  // on indefinitely once PUBLIC_SANITY_VISUAL_EDITING_ENABLED is set.
  const showToggle = isPresentationTool === false;

  const toggle = () => {
    const next = !disabled;

    if (next) {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }

    setDisabled(next);
  };

  return (
    <>
      {!disabled && <VisualEditingComponent />}

      {showToggle && (
        <button
          type="button"
          onClick={toggle}
          style={{
            position: "fixed",
            bottom: "1rem",
            right: "1rem",
            zIndex: 2147483647,
            padding: "1rem 1.5rem",
            borderRadius: 0,
            background: "#101112",
            color: "#fff",
            fontSize: "1rem",
            border: "none",
            cursor: "pointer",
          }}
        >
          {disabled ? "Enable visual editing" : "Disable visual editing"}
        </button>
      )}
    </>
  );
}
