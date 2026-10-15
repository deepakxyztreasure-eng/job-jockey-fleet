import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { supabase, linkDriverAccount } from '../api/supabase';
import { DriverProfile, Job } from '../types';
import { getTodayChecklistStatus } from '../api/checklist';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { MorningChecklistScreen } from '../screens/checklist/MorningChecklistScreen';
import { JobListScreen } from '../screens/jobs/JobListScreen';
import { DeliveryConfirmScreen } from '../screens/jobs/DeliveryConfirmScreen';
import { FatigueScreen } from '../screens/compliance/FatigueScreen';
import { DefectReportScreen } from '../screens/compliance/DefectReportScreen';
import { DispatchChatScreen } from '../screens/chat/DispatchChatScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { startAdaptiveTracking, stopTracking } from '../services/locationService';
import { registerForPushNotifications } from '../services/notificationService';
import { initOfflineSyncListener } from '../services/offlineQueue';

type ActiveTab = 'jobs' | 'breaks' | 'defect' | 'chat' | 'profile';

export const RootNavigator: React.FC = () => {
  const [session, setSession] = useState<any | null>(null);
  const [driver, setDriver] = useState<DriverProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Morning checklist cleared status
  const [morningCleared, setMorningCleared] = useState(false);

  // Tab navigation state
  const [currentTab, setCurrentTab] = useState<ActiveTab>('jobs');

  // Active POD modal for delivery confirmation
  const [podJob, setPodJob] = useState<Job | null>(null);

  // Defect report modal
  const [showDefectModal, setShowDefectModal] = useState(false);

  useEffect(() => {
    // 1. Initialize offline sync listener for quarry black spots
    const unsubscribeSync = initOfflineSyncListener();

    // 2. Check current Supabase auth session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        loadDriverProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        loadDriverProfile(session.user.id);
      } else {
        setDriver(null);
        setMorningCleared(false);
        setLoading(false);
        stopTracking();
      }
    });

    return () => {
      subscription.unsubscribe();
      unsubscribeSync();
    };
  }, []);

  const loadDriverProfile = async (userId: string) => {
    try {
      await linkDriverAccount();

      let { data, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      // Resilient fallback: match by email if user_id was not yet attached
      if (!data) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          const { data: byEmail } = await supabase
            .from('drivers')
            .select('*')
            .ilike('email', user.email.trim())
            .maybeSingle();

          if (byEmail) {
            data = byEmail;
            // Update drivers table with user_id in background
            supabase
              .from('drivers')
              .update({ user_id: userId })
              .eq('id', byEmail.id)
              .then(() => {});
          }
        }
      }

      if (data) {
        setDriver(data as DriverProfile);

        // Check if morning checklist is already completed today
        const status = await getTodayChecklistStatus(data.id);
        const cleared =
          status.morningSubmitted &&
          (!status.morningRequiresSignoff || status.morningSignoffStatus === 'approved');
        setMorningCleared(cleared);

        // Start background GPS tracking if cleared
        if (cleared) {
          startAdaptiveTracking(data.id);
        }

        // Ensure driver record has user_id linked
        if (!data.user_id) {
          supabase.from('drivers').update({ user_id: userId }).eq('id', data.id).then(() => {});
        }

        // Register push token
        registerForPushNotifications(userId, data.id);
      }
    } catch (err) {
      console.warn('Error loading driver profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMorningChecklistCleared = () => {
    setMorningCleared(true);
    if (driver) {
      startAdaptiveTracking(driver.id);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.accent} />
        <Text style={styles.loadingText}>Initializing Jodha Fleet...</Text>
      </View>
    );
  }

  // If not logged in -> Show LoginScreen
  if (!session || !session.user) {
    return <LoginScreen onLoginSuccess={(user) => loadDriverProfile(user.id)} />;
  }

  // If driver record not found yet
  if (!driver) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.warning} />
        <Text style={styles.errorTitle}>Driver Profile Not Linked</Text>
        <Text style={styles.errorSubtitle}>
          Your login ({session.user.email}) is not yet linked to an active driver profile. Ask Super Admin to assign your email in the Admin Web portal.
        </Text>
        <TouchableOpacity style={styles.signOutBtn} onPress={() => supabase.auth.signOut()}>
          <Text style={styles.signOutBtnText}>Log Out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // If Morning Checklist is NOT cleared -> Show MorningChecklistScreen with Sign-off gate
  if (!morningCleared) {
    return (
      <MorningChecklistScreen
        driverId={driver.id}
        driverName={driver.full_name}
        onChecklistCleared={handleMorningChecklistCleared}
      />
    );
  }

  // Main Authenticated Dashboard with Bottom Navigation
  return (
    <View style={styles.container}>
      {/* Tab Screen Content */}
      <View style={styles.screenWrapper}>
        {currentTab === 'jobs' && (
          <JobListScreen
            driverId={driver.id}
            driverName={driver.full_name}
            vehicleName={driver.vehicle || undefined}
            onNavigateToPOD={(job) => setPodJob(job)}
            onNavigateToDetail={() => {}}
          />
        )}
        {currentTab === 'breaks' && <FatigueScreen driverId={driver.id} />}
        {currentTab === 'chat' && (
          <DispatchChatScreen
            driverId={driver.id}
            driverName={driver.full_name}
            userId={session.user.id}
          />
        )}
        {currentTab === 'profile' && (
          <ProfileScreen driver={driver} onLogout={() => setSession(null)} />
        )}
      </View>

      {/* Delivery Confirmation POD Modal */}
      {podJob && (
        <Modal visible={!!podJob} animationType="slide">
          <DeliveryConfirmScreen
            job={podJob}
            driverId={driver.id}
            onSuccess={() => setPodJob(null)}
            onCancel={() => setPodJob(null)}
          />
        </Modal>
      )}

      {/* Mid-Shift Defect Report Modal */}
      <Modal visible={showDefectModal} animationType="slide">
        <DefectReportScreen
          driverId={driver.id}
          vehicleName={driver.vehicle || 'Tipper Truck'}
          onSuccess={() => setShowDefectModal(false)}
          onCancel={() => setShowDefectModal(false)}
        />
      </Modal>

      {/* Bottom Navigation Tabs */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setCurrentTab('jobs')}
        >
          <Ionicons
            name={currentTab === 'jobs' ? 'briefcase' : 'briefcase-outline'}
            size={22}
            color={currentTab === 'jobs' ? Colors.accent : Colors.textMuted}
          />
          <Text style={[styles.navLabel, currentTab === 'jobs' && styles.navLabelActive]}>
            Runs
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setCurrentTab('breaks')}
        >
          <Ionicons
            name={currentTab === 'breaks' ? 'cafe' : 'cafe-outline'}
            size={22}
            color={currentTab === 'breaks' ? Colors.accent : Colors.textMuted}
          />
          <Text style={[styles.navLabel, currentTab === 'breaks' && styles.navLabelActive]}>
            Breaks
          </Text>
        </TouchableOpacity>

        {/* Floating Quick Defect Action Button */}
        <TouchableOpacity
          style={styles.floatingDefectBtn}
          onPress={() => setShowDefectModal(true)}
        >
          <Ionicons name="construct" size={20} color={Colors.white} />
          <Text style={styles.floatingDefectText}>Defect</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setCurrentTab('chat')}
        >
          <Ionicons
            name={currentTab === 'chat' ? 'chatbubbles' : 'chatbubbles-outline'}
            size={22}
            color={currentTab === 'chat' ? Colors.accent : Colors.textMuted}
          />
          <Text style={[styles.navLabel, currentTab === 'chat' && styles.navLabelActive]}>
            Dispatch
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setCurrentTab('profile')}
        >
          <Ionicons
            name={currentTab === 'profile' ? 'person' : 'person-outline'}
            size={22}
            color={currentTab === 'profile' ? Colors.accent : Colors.textMuted}
          />
          <Text style={[styles.navLabel, currentTab === 'profile' && styles.navLabelActive]}>
            Shift
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  screenWrapper: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#0f172a',
  },
  loadingText: {
    color: Colors.white,
    marginTop: 14,
    fontSize: 14,
  },
  errorTitle: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 12,
  },
  errorSubtitle: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  signOutBtn: {
    marginTop: 20,
    backgroundColor: '#334155',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  signOutBtnText: {
    color: Colors.white,
    fontWeight: '700',
  },
  bottomNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: Colors.white,
    paddingTop: 10,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 8,
  },
  navItem: {
    alignItems: 'center',
    flex: 1,
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textMuted,
    marginTop: 2,
  },
  navLabelActive: {
    color: Colors.accent,
    fontWeight: '800',
  },
  floatingDefectBtn: {
    backgroundColor: '#dc2626',
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
    elevation: 4,
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  floatingDefectText: {
    color: Colors.white,
    fontSize: 9,
    fontWeight: '800',
    marginTop: 1,
  },
});
