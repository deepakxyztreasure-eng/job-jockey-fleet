import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import { Job } from '../../types';
import { fetchDriverJobs, acceptJob, rejectJob, startJob } from '../../api/jobs';
import { JobCard } from '../../components/JobCard';
import { SOSButton } from '../../components/SOSButton';
import { playAlertSound } from '../../services/notificationService';
import { updateActiveTrackingJob } from '../../services/locationService';
import { supabase } from '../../api/supabase';

interface JobListScreenProps {
  driverId: string;
  driverName?: string;
  vehicleName?: string;
  onNavigateToPOD: (job: Job) => void;
  onNavigateToDetail: (job: Job) => void;
}

type TabKey = 'current' | 'new' | 'accepted' | 'completed';

export const JobListScreen: React.FC<JobListScreenProps> = ({
  driverId,
  driverName,
  vehicleName,
  onNavigateToPOD,
  onNavigateToDetail,
}) => {
  const insets = useSafeAreaInsets();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('current');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Real-time dispatch instruction update modal
  const [urgentAlert, setUrgentAlert] = useState<{ title: string; message: string } | null>(null);

  const loadJobs = useCallback(async () => {
    try {
      const data = await fetchDriverJobs(driverId);
      setJobs(data);

      // Update current active job for location service
      const current = data.find((j) => j.status === 'in_progress');
      updateActiveTrackingJob(current ? current.id : null);
    } catch (err: any) {
      console.warn('Error loading jobs:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [driverId]);

  useEffect(() => {
    loadJobs();

    // Setup Supabase Realtime channel for instant job dispatch alerts
    const channel = supabase
      .channel('driver-jobs-rt')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs',
          filter: `assigned_driver_id=eq.${driverId}`,
        },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            // New job allocated! Play audio chime and switch to 'new' tab
            playAlertSound('new_job').catch(() => {});
            setActiveTab('new');
            setUrgentAlert({
              title: 'New Job Allocated!',
              message: `Job #${payload.new.job_number || ''}: ${payload.new.title} has been assigned to you.`,
            });
          } else if (payload.eventType === 'UPDATE') {
            // Check if instructions or address changed
            const oldItem = payload.old;
            const newItem = payload.new;
            if (
              oldItem.instructions !== newItem.instructions ||
              oldItem.delivery_address !== newItem.delivery_address
            ) {
              playAlertSound('urgent').catch(() => {});
              setUrgentAlert({
                title: '⚡ Urgent Job Update from Dispatch',
                message: `Update for Job #${newItem.job_number || ''}: ${newItem.instructions || 'Delivery details updated.'}`,
              });
            }
          }
          loadJobs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [driverId, loadJobs]);

  const handleAccept = async (job: Job) => {
    try {
      await acceptJob(job.id);
      Alert.alert('Accepted', 'Job accepted successfully.');
      loadJobs();
      setActiveTab('accepted');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to accept job.');
    }
  };

  const handleReject = (job: Job) => {
    Alert.prompt
      ? Alert.prompt('Reject Job', 'Please provide a reason:', [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Reject',
            style: 'destructive',
            onPress: async (reason?: string) => {
              await rejectJob(job.id, reason);
              loadJobs();
            },
          },
        ])
      : Alert.alert('Reject Job', 'Are you sure you want to reject this allocation?', [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Reject',
            style: 'destructive',
            onPress: async () => {
              await rejectJob(job.id);
              loadJobs();
            },
          },
        ]);
  };

  const handleStart = async (job: Job) => {
    try {
      await startJob(job.id);
      updateActiveTrackingJob(job.id);
      Alert.alert('Job Started', 'En route to pickup/site. Drive safely!');
      loadJobs();
      setActiveTab('current');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to start job.');
    }
  };

  // Filter jobs by tab
  const filteredJobs = useMemo(() => {
    switch (activeTab) {
      case 'current':
        return jobs.filter((j) => j.status === 'in_progress');
      case 'new':
        return jobs.filter((j) => j.status === 'assigned' || j.status === 'pending');
      case 'accepted':
        return jobs.filter((j) => j.status === 'accepted');
      case 'completed':
        return jobs.filter((j) =>
          ['completed', 'closed', 'completion_requested', 'rejected'].includes(j.status)
        );
      default:
        return [];
    }
  }, [jobs, activeTab]);

  const counts = useMemo(
    () => ({
      current: jobs.filter((j) => j.status === 'in_progress').length,
      new: jobs.filter((j) => j.status === 'assigned' || j.status === 'pending').length,
      accepted: jobs.filter((j) => j.status === 'accepted').length,
      completed: jobs.filter((j) =>
        ['completed', 'closed', 'completion_requested'].includes(j.status)
      ).length,
    }),
    [jobs]
  );

  return (
    <View style={styles.container}>
      {/* Top Header with Safe Area Inset Padding */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 48) }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brandSubtitle}>JODHA FLEET</Text>
            <Text style={styles.headerTitle}>Assigned Runs</Text>
          </View>
          <View style={styles.driverPill}>
            <Ionicons name="person-circle-outline" size={16} color={Colors.accent} />
            <Text style={styles.driverPillText} numberOfLines={1}>
              {driverName || 'Driver'}
            </Text>
          </View>
        </View>

        {/* SOS Emergency Hold Bar situated safely below status bar */}
        <SOSButton driverId={driverId} />
      </View>

      {/* 4 Segmented Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'current' && styles.tabBtnActive]}
          onPress={() => setActiveTab('current')}
        >
          <Text style={[styles.tabText, activeTab === 'current' && styles.tabTextActive]}>
            Current
          </Text>
          {counts.current > 0 && (
            <View style={[styles.tabBadge, activeTab === 'current' && styles.tabBadgeActive]}>
              <Text style={styles.tabBadgeText}>{counts.current}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'new' && styles.tabBtnActive]}
          onPress={() => setActiveTab('new')}
        >
          <Text style={[styles.tabText, activeTab === 'new' && styles.tabTextActive]}>
            New
          </Text>
          {counts.new > 0 && (
            <View style={[styles.tabBadge, styles.tabBadgeAlert]}>
              <Text style={[styles.tabBadgeText, { color: Colors.white }]}>{counts.new}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'accepted' && styles.tabBtnActive]}
          onPress={() => setActiveTab('accepted')}
        >
          <Text style={[styles.tabText, activeTab === 'accepted' && styles.tabTextActive]}>
            Accepted
          </Text>
          {counts.accepted > 0 && (
            <View style={[styles.tabBadge, activeTab === 'accepted' && styles.tabBadgeActive]}>
              <Text style={styles.tabBadgeText}>{counts.accepted}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'completed' && styles.tabBtnActive]}
          onPress={() => setActiveTab('completed')}
        >
          <Text style={[styles.tabText, activeTab === 'completed' && styles.tabTextActive]}>
            Completed
          </Text>
        </TouchableOpacity>
      </View>

      {/* Job List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.centerText}>Loading runs...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredJobs}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <JobCard
              job={item}
              onAccept={handleAccept}
              onReject={handleReject}
              onStart={handleStart}
              onComplete={(j) => onNavigateToPOD(j)}
              onPressDetails={(j) => onNavigateToDetail(j)}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadJobs();
              }}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="cube-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No runs in this tab</Text>
              <Text style={styles.emptySubtitle}>
                {activeTab === 'new'
                  ? 'No pending job allocations right now.'
                  : activeTab === 'current'
                  ? 'No active run. Select an accepted job to start.'
                  : 'All caught up!'}
              </Text>
            </View>
          }
        />
      )}

      {/* Realtime Urgent Dispatch Modal */}
      {urgentAlert && (
        <Modal transparent animationType="fade" visible={!!urgentAlert}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalIconCircle}>
                <Ionicons name="notifications" size={32} color={Colors.accent} />
              </View>
              <Text style={styles.modalTitle}>{urgentAlert.title}</Text>
              <Text style={styles.modalMessage}>{urgentAlert.message}</Text>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setUrgentAlert(null)}
              >
                <Text style={styles.modalButtonText}>Acknowledge & View</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  header: {
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  brandSubtitle: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.accent,
    letterSpacing: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  driverPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  driverPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 6,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    gap: 4,
  },
  tabBtnActive: {
    backgroundColor: '#0f172a',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  tabTextActive: {
    color: Colors.white,
  },
  tabBadge: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 10,
  },
  tabBadgeActive: {
    backgroundColor: '#334155',
  },
  tabBadgeAlert: {
    backgroundColor: Colors.danger,
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.text,
  },
  listContent: {
    padding: 14,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerText: {
    marginTop: 10,
    fontSize: 13,
    color: Colors.textMuted,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 240,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 24,
    width: '100%',
    alignItems: 'center',
  },
  modalIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  modalButton: {
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
  },
  modalButtonText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
});
