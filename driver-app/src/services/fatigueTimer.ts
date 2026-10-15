import AsyncStorage from '@react-native-async-storage/async-storage';
import { playAlertSound } from './notificationService';

const FATIGUE_STATE_KEY = '@jodha_fatigue_state';
const MAX_CONTINUOUS_WORK_MINUTES = 5.25 * 60; // 315 minutes (5h 15m)
const WARNING_THRESHOLD_MINUTES = 15; // Alert 15 mins before violation

export interface FatigueState {
  shiftStartTime: string;
  currentWorkBlockStart: string;
  lastBreakEndTime: string | null;
  totalBreakMinutes: number;
  isOnBreak: boolean;
  breakStartTime: string | null;
}

export async function getFatigueState(): Promise<FatigueState> {
  const raw = await AsyncStorage.getItem(FATIGUE_STATE_KEY);
  if (raw) return JSON.parse(raw);

  const initial: FatigueState = {
    shiftStartTime: new Date().toISOString(),
    currentWorkBlockStart: new Date().toISOString(),
    lastBreakEndTime: null,
    totalBreakMinutes: 0,
    isOnBreak: false,
    breakStartTime: null,
  };
  await AsyncStorage.setItem(FATIGUE_STATE_KEY, JSON.stringify(initial));
  return initial;
}

export async function saveFatigueState(state: FatigueState): Promise<void> {
  await AsyncStorage.setItem(FATIGUE_STATE_KEY, JSON.stringify(state));
}

export function calculateFatigueStats(state: FatigueState): {
  continuousWorkMinutes: number;
  remainingMinutesUntilBreak: number;
  isViolation: boolean;
  isWarning: boolean;
  formattedCountdown: string;
} {
  const now = Date.now();
  if (state.isOnBreak) {
    const breakDurationMins = state.breakStartTime
      ? Math.floor((now - new Date(state.breakStartTime).getTime()) / 60000)
      : 0;
    return {
      continuousWorkMinutes: 0,
      remainingMinutesUntilBreak: 0,
      isViolation: false,
      isWarning: false,
      formattedCountdown: `Resting (${breakDurationMins}m / 15m min)`,
    };
  }

  const workStartMs = new Date(state.currentWorkBlockStart).getTime();
  const workMinutes = Math.floor((now - workStartMs) / 60000);
  const remaining = Math.max(0, MAX_CONTINUOUS_WORK_MINUTES - workMinutes);

  const hours = Math.floor(remaining / 60);
  const mins = remaining % 60;
  const formattedCountdown = `${hours}h ${mins}m left until mandatory break`;

  const isViolation = workMinutes >= MAX_CONTINUOUS_WORK_MINUTES;
  const isWarning = remaining <= WARNING_THRESHOLD_MINUTES && !isViolation;

  if (isWarning || isViolation) {
    playAlertSound('fatigue').catch(() => {});
  }

  return {
    continuousWorkMinutes: workMinutes,
    remainingMinutesUntilBreak: remaining,
    isViolation,
    isWarning,
    formattedCountdown,
  };
}

export async function startRestBreak(): Promise<FatigueState> {
  const state = await getFatigueState();
  state.isOnBreak = true;
  state.breakStartTime = new Date().toISOString();
  await saveFatigueState(state);
  return state;
}

export async function endRestBreak(): Promise<FatigueState> {
  const state = await getFatigueState();
  if (state.isOnBreak && state.breakStartTime) {
    const breakMinutes = Math.floor((Date.now() - new Date(state.breakStartTime).getTime()) / 60000);
    state.totalBreakMinutes += breakMinutes;
    state.lastBreakEndTime = new Date().toISOString();
    // If break was at least 15 minutes, reset the continuous work block timer
    if (breakMinutes >= 15) {
      state.currentWorkBlockStart = new Date().toISOString();
    }
  }
  state.isOnBreak = false;
  state.breakStartTime = null;
  await saveFatigueState(state);
  return state;
}

export async function resetFatigueShift(): Promise<void> {
  await AsyncStorage.removeItem(FATIGUE_STATE_KEY);
}
