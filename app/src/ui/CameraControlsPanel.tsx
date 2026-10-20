// Buttons and sliders for the camera. Each one is only shown when this camera offers it
// (AGENTS.md rule 6): iPhone browsers offer none, Chrome on Android usually offers all.
import type { CameraInfo } from '../camera/camera';
import type { CameraControls } from '../camera/controls';
import { Card } from './Card';

export function CameraControlsPanel({
  controls,
  cameras,
  cameraId,
  sound,
  onZoom,
  onTorch,
  onAutoFocus,
  onFocusDistance,
  onSwitchCamera,
  onSound,
}: {
  controls: CameraControls;
  cameras: CameraInfo[];
  cameraId: string | null;
  sound: boolean;
  onZoom: (value: number) => void;
  onTorch: () => void;
  onAutoFocus: () => void;
  onFocusDistance: (value: number) => void;
  onSwitchCamera: () => void;
  onSound: () => void;
}) {
  const { zoom, focusDistance } = controls;
  const cameraIndex = cameras.findIndex((camera) => camera.deviceId === cameraId);
  const cameraName = cameras[cameraIndex]?.label;
  const noControls = !zoom && !controls.torch && !controls.autoFocus && !focusDistance;

  return (
    <Card title="Camera">
      <div className="flex flex-wrap gap-2">
        {controls.torch && <ToggleButton label="Light" on={controls.torchOn} onClick={onTorch} />}
        <ToggleButton label="Sound" on={sound} onClick={onSound} />
        {cameras.length > 1 && (
          <button type="button" onClick={onSwitchCamera} className={BUTTON}>
            Switch camera
          </button>
        )}
      </div>

      {cameras.length > 1 && cameraName && (
        <p className="mt-2 text-sm text-slate-400">
          Camera {cameraIndex + 1} of {cameras.length}: {cameraName}
        </p>
      )}

      {zoom && (
        <Slider label="Zoom" shown={`${zoom.value.toFixed(1)}×`} range={zoom} onChange={onZoom} />
      )}

      {(controls.autoFocus || focusDistance) && (
        <div className="mt-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-300">Focus</span>
            {controls.autoFocus && (
              <ToggleButton label="Auto focus" on={!controls.manualFocus} onClick={onAutoFocus} />
            )}
          </div>
          {focusDistance && (
            <Slider
              label="Focus distance"
              shown={controls.manualFocus ? 'manual' : 'auto'}
              range={focusDistance}
              onChange={onFocusDistance}
            />
          )}
        </div>
      )}

      {noControls && (
        <p className="mt-3 text-sm text-slate-400">
          This browser offers no zoom, light or focus control.
        </p>
      )}
    </Card>
  );
}

const BUTTON = 'rounded-lg bg-slate-700 px-3 py-2 font-medium text-slate-100 active:bg-slate-600';

function ToggleButton({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={
        on
          ? 'rounded-lg bg-emerald-500 px-3 py-2 font-medium text-slate-950 active:bg-emerald-400'
          : BUTTON
      }
    >
      {label}: {on ? 'on' : 'off'}
    </button>
  );
}

function Slider({
  label,
  shown,
  range,
  onChange,
}: {
  label: string;
  /** The current value as the user should read it, e.g. "2.0×". */
  shown: string;
  range: { min: number; max: number; step: number; value: number };
  onChange: (value: number) => void;
}) {
  return (
    <label className="mt-3 block">
      <span className="flex justify-between text-slate-300">
        <span>{label}</span>
        <span className="tabular-nums text-slate-400">{shown}</span>
      </span>
      <input
        type="range"
        min={range.min}
        max={range.max}
        step={range.step}
        value={range.value}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1 w-full accent-emerald-400"
      />
    </label>
  );
}
