import {
  Label,
  Slider as AriaSlider,
  SliderOutput,
  SliderThumb,
  SliderTrack,
  type SliderProps as AriaSliderProps,
} from "react-aria-components";
import styles from "./Slider.module.css";

export interface SliderProps extends Omit<AriaSliderProps<number>, "className" | "children" | "orientation"> {
  label: string;
}

/** A labelled, horizontal, single-value slider that shows its current value. Used for the yearly focus points. */
export function Slider({ label, ...props }: SliderProps) {
  return (
    <AriaSlider {...props} className={styles.slider}>
      <div className={styles.header}>
        <Label>{label}</Label>
        <SliderOutput />
      </div>
      <SliderTrack className={styles.track}>
        {({ state }) => (
          <>
            <div className={styles.fill} style={{ width: `${state.getThumbPercent(0) * 100}%` }} />
            <SliderThumb className={styles.thumb} />
          </>
        )}
      </SliderTrack>
    </AriaSlider>
  );
}
