import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import {
  getFatigueState,
  calculateFatigueStats,
  startRestBreak,
  endRestBreak,
  FatigueState,
} from '../../services/fatigueTimer';
import { logFatigueEvent } from '../../api/compliance';

interface FatigueScreenProps {
  driverId: string;
}

export const FatigueScreen: React.FC<FatigueScreenProps> = ({ driverId }) => {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<FatigueState | null>(null);
  const [stats, setStats] = useState({
    continuousWorkMinutes: 0,
    remainingMinutesUntilBreak: 0,
    isViolation: false,
    isWarning: false,
    formattedCountdown: '',
  });

  const refresh = async () => {
    const s = await getFatigueState();
    setState(s);
    setStats(calculateFatigueStats(s));
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const handleToggleBreak = async () => {
    if (!state) return;

    if (!state.isOnBreak) {
      const updated = await startRestBreak();
      setState(updated);
      setStats(calculateFatigueStats(updated));
      await logFatigueEvent({
        driver_id: driverId,
        event_type: 'rest_break',
        start_time: new Date().toISOString(),
      }).catch(() => {});
      Alert.alert('Rest Break Started', 'Timer paused. Minimum NHVR rest is 15 minutes.');
    } else {
      const updated = await endRestBreak();
      setState(updated);
      setStats(calculateFatigueStats(updated));
      await logFatigueEvent({
        driver_id: driverId,
        event_type: 'work_driving',
        start_time: new Date().toISOString(),
      }).catch(() => {});
      Alert.alert('Rest Break Ended', 'Driving timer resumed. Drive safely.');
    }
  };

  const workHours = Math.floor(stats.continuousWorkMinutes / 60);
  const workMins = stats.continuousWorkMinutes % 60;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 48) }]}>
        <View style={styles.badgeRow}>
          <Ionicons name="cafe" size={16} color={Colors.accent} />
          <Text style={styles.badgeText}>NHVR WORK & REST COMPLIANCE</Text>
        </View>
        <Text style={styles.title}>Driver Breaks & Rest Timer</Text>
        <Text style={styles.subtitle}>
          Standard Hours: Mandatory 15-minute rest break required every 5.25 continuous driving hours.
        </Text>
      </View>

      <View style={styles.content}>
        {/* Main Countdown Gauge Card */}
        <View
          style={[
            styles.gaugeCard,
            stats.isViolation && styles.gaugeCardViolation,
            stats.isWarning && styles.gaugeCardWarning,
          ]}
        >
          <Ionicons
            name={state?.isOnBreak ? 'cafe' : stats.isViolation ? 'warning' : 'timer'}
            size={48}
            color={
              state?.isOnBreak
                ? Colors.success
                : stats.isViolation
                ? Colors.danger
                : stats.isWarning
                ? Colors.warning
                : Colors.accent
            }
          />
          <Text style={styles.gaugeTitle}>
            {state?.isOnBreak ? 'ON REST BREAK' : 'CONTINUOUS DRIVING TIMER'}
          </Text>

          <Text
            style={[
              styles.gaugeTime,
              stats.isViolation && { color: Colors.danger },
              stats.isWarning && { color: Colors.warning },
            ]}
          >
            {state?.isOnBreak ? 'Resting...' : `${workHours}h ${workMins}m`}
          </Text>

          <View style={styles.countdownPill}>
            <Text style={styles.countdownText}>{stats.formattedCountdown}</Text>
          </View>
        </View>

        {/* Break Toggle Action */}
        <TouchableOpacity
          style={[styles.breakButton, state?.isOnBreak && styles.breakButtonActive]}
          onPress={handleToggleBreak}
        >
          <Ionicons
            name={state?.isOnBreak ? 'play-circle' : 'pause-circle'}
            size={24}
            color={Colors.white}
          />
          <Text style={styles.breakButtonText}>
            {state?.isOnBreak ? 'End Rest Break (Resume Driving)' : 'Start 15-Min Rest Break'}
          </Text>
        </TouchableOpacity>

        {/* NHVR Standard Hours Rule Reference */}
        <View style={styles.rulesCard}>
          <Text style={styles.rulesTitle}>NHVR Chain of Responsibility Rules:</Text>
          <View style={styles.ruleItem}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
            <Text style={styles.ruleText}>Max 12 hours total work in any 24-hour period.</Text>
          </View>
          <View style={styles.ruleItem}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
            <Text style={styles.ruleText}>Min 15 continuous rest minutes every 5.25 work hours.</Text>
          </View>
          <View style={styles.ruleItem}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
            <Text style={styles.ruleText}>Min 7 continuous rest hours in a 24-hour block.</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: Colors.white,
    paddingTop: 54,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.accent,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
    lineHeight: 16,
  },
  content: {
    padding: 16,
  },
  gaugeCard: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 16,
  },
  gaugeCardWarning: {
    borderColor: '#fde68a',
    backgroundColor: '#fffbeb',
  },
  gaugeCardViolation: {
    borderColor: '#fca5a5',
    backgroundColor: '#fef2f2',
  },
  gaugeTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginTop: 10,
  },
  gaugeTime: {
    fontSize: 36,
    fontWeight: '900',
    color: Colors.text,
    marginVertical: 6,
  },
  countdownPill: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 6,
  },
  countdownText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  breakButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.accent,
    borderRadius: 12,
    height: 52,
    marginBottom: 20,
  },
  breakButtonActive: {
    backgroundColor: Colors.success,
  },
  breakButtonText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  rulesCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  rulesTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 2,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ruleText: {
    fontSize: 12,
    color: Colors.text,
    flex: 1,
  },
});
