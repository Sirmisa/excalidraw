import React, { useCallback, useEffect, useRef } from "react";

import "./Range.scss";

export type RangeProps = {
  label: React.ReactNode;
  value: number;
  /** called with each new value while the user drags or presses a key */
  onChange: (value: number) => void;
  /**
   * called with the final value once a gesture ends: on pointer release
   * (even outside the slider), after each key press, and when the slider
   * loses focus with values reported by `onChange` since the last gesture
   * end. When set, `onChange` is only called for the intermediate values.
   */
  onChangeEnd?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  minLabel?: React.ReactNode;
  hasCommonValue?: boolean;
  testId?: string;
};

export const Range = ({
  label,
  value,
  onChange,
  onChangeEnd,
  min = 0,
  max = 100,
  step = 10,
  minLabel = min,
  hasCommonValue = true,
  testId,
}: RangeProps) => {
  const progress = (value - min) / (max - min || 1);

  const inputRef = useRef<HTMLInputElement>(null);
  const onChangeEndRef = useRef(onChangeEnd);
  onChangeEndRef.current = onChangeEnd;
  // whether `onChange` reported a value since the gesture last ended
  const hasPendingChangeRef = useRef(false);

  const endGesture = useCallback((value: number) => {
    hasPendingChangeRef.current = false;
    onChangeEndRef.current?.(value);
  }, []);

  // React's `onChange` fires for both native `input` and `change` events, and
  // for `change` only if the value differs from the last one it saw, which it
  // doesn't after a drag. Listen to the native `change` event directly so the
  // gesture end is always reported, exactly once.
  useEffect(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }
    const handleChange = () => {
      endGesture(+input.value);
    };
    input.addEventListener("change", handleChange);
    return () => input.removeEventListener("change", handleChange);
  }, [endGesture]);

  return (
    <label className="control-label">
      {label}
      <div
        className="range-wrapper"
        style={{ ["--range-progress" as string]: progress }}
      >
        <input
          ref={inputRef}
          style={{
            ["--color-slider-track" as string]: hasCommonValue
              ? undefined
              : "var(--button-bg)",
          }}
          type="range"
          min={min}
          max={max}
          step={step}
          onChange={(event) => {
            // the native `change` listener above reports the gesture end
            if (onChangeEnd && event.nativeEvent.type === "change") {
              return;
            }
            hasPendingChangeRef.current = true;
            onChange(+event.target.value);
          }}
          onBlur={(event) => {
            // focus was lost mid-drag (e.g. window blur) before the `change`
            // event arrived, so end the gesture here
            if (hasPendingChangeRef.current) {
              endGesture(+event.target.value);
            }
          }}
          value={value}
          className="range-input"
          data-testid={testId}
        />
        <div className="value-bubble">{value !== min ? value : null}</div>
        <div className="zero-label">{minLabel}</div>
      </div>
    </label>
  );
};
