import AstalBattery from "gi://AstalBattery";
import { createBinding, createComputed } from "ags";
import { BatteryGlyph } from "../../../src/lib/glyphs";

export function Battery() {
  const battery = AstalBattery.get_default();

  const percentBinding = createBinding(battery, "percentage")(
    (p: number) => `${Math.floor(p * 100)}%`
  );

  // Utilise createComputed pour combiner plusieurs bindings
  const glyphAndPercentBinding = createComputed([BatteryGlyph, percentBinding])(
    (values) => {
      const [glyph, percent] = values;
      return `${glyph} ${percent}`;
    }
  );

  return (
    <box class="battery">
      <label
        visible={createBinding(battery, "isPresent")}
        label={glyphAndPercentBinding}
      />
    </box>
  );
}
