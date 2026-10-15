import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import { DriverProfile } from '../../types';
import { EveningChecklistScreen } from '../checklist/EveningChecklistScreen';
import { stopTracking } from '../../services/locationService';
import { resetFatigueShift } from '../../services/fatigueTimer';
import { supabase } from '../../api/supabase';

interface ProfileScreenProps {
  driver: DriverProfile;
  onLogout: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ driver, onLogout }) => {
  const insets = useSafeAreaInsets();
  const [showEveningChecklist, setShowEveningChecklist] = useState(false);

  const handleEveningComplete = async () => {
    setShowEveningChecklist(false);
    // 1. Stop background GPS
    await stopTracking();
    // 2. Reset fatigue timer
    await resetFatigueShift();
    // 3. Close driver session
    await supabase.auth.signOut();
    onLogout();
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 48) }]}>
        <Text style={styles.headerTitle}>Driver Profile & Shift</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Profile Card */}
        <View style={styles.card}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitials}>
              {(driver.full_name || 'D')
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)}
            </Text>
          </View>
          <Text style={styles.driverName}>{driver.full_name}</Text>
          <Text style={styles.driverEmail}>{driver.email}</Text>

          <View style={styles.infoGrid}>
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>Assigned Truck</Text>
              <Text style={styles.infoValue}>{driver.vehicle || 'Not assigned'}</Text>
            </View>
            <View style={styles.infoCol}>
              <Text style={styles.infoLabel}>Heavy Vehicle Lic #</Text>
              <Text style={styles.infoValue}>{driver.license_number || 'On file'}</Text>
            </View>
          </View>
        </View>

        {/* Shift Management Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Shift Management</Text>
          <Text style={styles.sectionSubtitle}>
            To clock out and end your shift, NHVR requires completing the evening maintenance & refuel checklist.
          </Text>

          <TouchableOpacity
            style={styles.clockOutButton}
            onPress={() => setShowEveningChecklist(true)}
          >
            <Ionicons name="log-out-outline" size={20} color={Colors.white} />
            <Text style={styles.clockOutText}>Evening Checklist & Clock Out</Text>
          </TouchableOpacity>
        </View>

        {/* Version info */}
        <Text style={styles.versionText}>Jodha Driver App v1.0.0 • Connected to Staging</Text>
      </ScrollView>

      {/* Evening Checklist Modal */}
      <Modal visible={showEveningChecklist} animationType="slide">
        <EveningChecklistScreen
          driverId={driver.id}
          driverName={driver.full_name}
          onChecklistCompleted={handleEveningComplete}
          onCancel={() => setShowEveningChecklist(false)}
        />
      </Modal>
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
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  content: {
    padding: 16,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  avatarCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarInitials: {
    color: Colors.white,
    fontSize: 24,
    fontWeight: '800',
  },
  driverName: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  driverEmail: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
  },
  infoGrid: {
    flexDirection: 'row',
    width: '100%',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 12,
  },
  infoCol: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 3,
  },
  sectionCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
    lineHeight: 18,
    marginBottom: 16,
  },
  clockOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.danger,
    borderRadius: 10,
    height: 48,
  },
  clockOutText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '800',
  },
  versionText: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 12,
  },
});
