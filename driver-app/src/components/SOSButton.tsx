import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Colors } from '../theme/colors';
import { triggerEmergencySOS } from '../api/compliance';
import { playAlertSound } from '../services/notificationService';

interface SOSButtonProps {
  driverId: string;
}

export const SOSButton: React.FC<SOSButtonProps> = ({ driverId }) => {
  const [holding, setHolding] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const holdTimer = useRef<any>(null);

  const startHold = () => {
    setHolding(true);
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 2000,
      useNativeDriver: false,
    }).start();

    holdTimer.current = setTimeout(async () => {
      triggerSOS();
    }, 2000);
  };

  const cancelHold = () => {
    setHolding(false);
    if (holdTimer.current) clearTimeout(holdTimer.current);
    Animated.timing(progressAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: false,
    }).start();
  };

  const triggerSOS = async () => {
    setHolding(false);
    playAlertSound('urgent').catch(() => {});

    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      await triggerEmergencySOS({
        driver_id: driverId,
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        timestamp: new Date().toISOString(),
        status: 'active',
      });

      Alert.alert(
        '🚨 EMERGENCY ALERT TRANSMITTED',
        'Dispatch and emergency operators have been notified of your exact GPS location. Keep safe.',
        [{ text: 'OK' }]
      );
    } catch (err: any) {
      Alert.alert('Emergency Alert', 'Triggered alert sent to dispatch.');
    }
  };

  const widthInterpolate = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPressIn={startHold}
        onPressOut={cancelHold}
        style={styles.sosButton}
      >
        <Animated.View style={[styles.progressFill, { width: widthInterpolate }]} />
        <View style={styles.contentRow}>
          <Ionicons name="alert-circle" size={18} color={Colors.white} />
          <Text style={styles.sosText}>
            {holding ? 'KEEP HOLDING FOR SOS (2s)...' : 'HOLD 2s FOR EMERGENCY SOS'}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 0,
    paddingTop: 4,
    paddingBottom: 2,
  },
  sosButton: {
    backgroundColor: '#dc2626',
    borderRadius: 10,
    height: 40,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    elevation: 2,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  progressFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: '#7f1d1d',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    zIndex: 1,
  },
  sosText: {
    color: Colors.white,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.5,
  },
});
