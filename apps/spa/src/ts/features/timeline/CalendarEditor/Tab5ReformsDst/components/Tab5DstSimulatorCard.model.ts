export interface Tab5DstSimulatorCardProps {
  simTab: 'spring' | 'autumn';
    springSliderVal: number;
    autumnSliderVal: number;
    autumnFold: number;
    springTimeStr: string;
    autumnTimeStr: string;
    springAlertTitle: string;
    springAlertDesc: string;
    springAlertStyle: Record<string, string>;
    springAlertTextColor: string;
    autumnAlertDesc: string;
    autumnAlertStyle: Record<string, string>;
}

export type Tab5DstSimulatorCardEmits = {
  (e: 'switch-sim-tab', tab: 'spring' | 'autumn'): void;
    (e: 'update-spring-slider', val: number): void;
    (e: 'update-autumn-slider', val: number): void;
    (e: 'update-autumn-fold', val: number): void;
};
