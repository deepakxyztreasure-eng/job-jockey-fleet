import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../theme/colors';
import { MORNING_CHECKLIST_ITEMS, submitChecklist, getTodayChecklistStatus } from '../../api/checklist';
import { ChecklistItemResponse, DriverChecklist } from '../../types';
import { supabase } from '../../api/supabase';

interface MorningChecklistScreenProps {
  driverId: string;
  driverName: string;
  onChecklistCleared: () => void;
}

export const MorningChecklistScreen: React.FC<MorningChecklistScreenProps> = ({
  driverId,
  driverName,
  onChecklistCleared,
}) => {
  const insets = useSafeAreaInsets();
  const [answers, setAnswers] = useState<Record<string, 'yes' | 'no' | null>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Sign-off lock state
  const [isPendingSignoff, setIsPendingSignoff] = useState(false);
  const [signoffRecord, setSignoffRecord] = useState<DriverChecklist | null>(null);

  useEffect(() => {
    checkStatus();

    // Listen to real-time sign-off updates from Super Admin
    const channel = supabase
      .channel('driver-checklist-rt')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'driver_checklists',
          filter: `driver_id=eq.${driverId}`,
        },
        (payload: any) => {
          const updated = payload.new as DriverChecklist;
          if (updated.checklist_type === 'morning') {
            if (updated.signoff_status === 'approved') {
              Alert.alert('Approved by Admin', 'Super Admin has approved your morning checklist sign-off. Have a safe drive!');
              onChecklistCleared();
            } else if (updated.signoff_status === 'rejected') {
              Alert.alert('Ground Vehicle / Halt', `Sign-off rejected: ${updated.signoff_notes || 'Do not drive vehicle. Contact dispatch.'}`);
              setSignoffRecord(updated);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [driverId]);

  const checkStatus = async () => {
    try {
      const status = await getTodayChecklistStatus(driverId);
      if (status.morningSubmitted) {
        if (!status.morningRequiresSignoff || status.morningSignoffStatus === 'approved') {
          onChecklistCleared();
          return;
        }
        if (status.morningSignoffStatus === 'pending') {
          setIsPendingSignoff(true);
          setSignoffRecord(status.morningChecklist || null);
        }
      }
    } catch (err) {
      console.warn('Checklist status check error:', err);
    } finally {
      setLoadingInitial(false);
    }
  };

  const handleSelectAnswer = (itemKey: string, answer: 'yes' | 'no') => {
    setAnswers((prev) => ({ ...prev, [itemKey]: answer }));
  };

  const handleNotesChange = (itemKey: string, text: string) => {
    setNotes((prev) => ({ ...prev, [itemKey]: text }));
  };

  const allAnswered = MORNING_CHECKLIST_ITEMS.every((item) => answers[item.key] != null);
  const hasNo = MORNING_CHECKLIST_ITEMS.some((item) => answers[item.key] === 'no');

  const handleSubmit = async () => {
    if (!allAnswered) {
      Alert.alert('Incomplete', 'Please answer YES or NO for every checklist item.');
      return;
    }

    // Ensure driver provides a note if they answer "NO"
    for (const item of MORNING_CHECKLIST_ITEMS) {
      if (answers[item.key] === 'no' && (!notes[item.key] || !notes[item.key].trim())) {
        Alert.alert('Defect Note Required', `Please explain the issue for: "${item.title}"`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const responses: ChecklistItemResponse[] = MORNING_CHECKLIST_ITEMS.map((item) => ({
        item_key: item.key,
        title: item.title,
        answer: answers[item.key] as 'yes' | 'no',
        notes: notes[item.key] || undefined,
      }));

      const res = await submitChecklist(driverId, 'morning', responses, driverName);

      if (res.requiresSignoff) {
        setIsPendingSignoff(true);
        Alert.alert(
          'Sign-Off Requested',
          'You answered NO to one or more items. Super Admin has been alerted to review and sign off before you begin driving.'
        );
      } else {
        Alert.alert('Checklist Passed', 'Daily safety check complete. Safe travels!');
        onChecklistCleared();
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to submit checklist.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingInitial) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.accent} />
        <Text style={styles.loadingText}>Checking Daily Safety Status...</Text>
      </View>
    );
  }

  // Waiting for Super Admin sign-off gate screen
  if (isPendingSignoff) {
    return (
      <View style={styles.lockContainer}>
        <View style={styles.lockCard}>
          <View style={styles.lockIconContainer}>
            <Ionicons name="time-outline" size={48} color={Colors.warning} />
          </View>
          <Text style={styles.lockTitle}>Awaiting Super Admin Sign-off</Text>
          <Text style={styles.lockSubtitle}>
            You reported an issue on today's morning safety check. Dispatch and Super Admin have received an urgent alert.
          </Text>

          {signoffRecord?.signoff_status === 'rejected' ? (
            <View style={styles.rejectedBanner}>
              <Text style={styles.rejectedTitle}>⛔ Sign-off Rejected</Text>
              <Text style={styles.rejectedText}>
                {signoffRecord.signoff_notes || 'Vehicle grounded. Do not drive until authorized.'}
              </Text>
            </View>
          ) : (
            <View style={styles.pendingBanner}>
              <ActivityIndicator size="small" color={Colors.warning} />
              <Text style={styles.pendingText}>Waiting for management approval...</Text>
            </View>
          )}

          <TouchableOpacity style={styles.refreshButton} onPress={checkStatus}>
            <Ionicons name="refresh" size={16} color={Colors.accent} />
            <Text style={styles.refreshButtonText}>Check Approval Status</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 48) }]}>
        <View style={styles.headerBadge}>
          <Ionicons name="shield-checkmark" size={16} color={Colors.accent} />
          <Text style={styles.headerBadgeText}>MANDATORY SAFETY CHECK</Text>
        </View>
        <Text style={styles.title}>Morning Clock-In Checklist</Text>
        <Text style={styles.description}>
          Review and confirm vehicle & fitness items below. Required once daily before accepting jobs.
        </Text>
      </View>

      <ScrollView style={styles.scrollList} contentContainerStyle={styles.scrollContent}>
        {MORNING_CHECKLIST_ITEMS.map((item, index) => {
          const answer = answers[item.key];
          const isNo = answer === 'no';

          return (
            <View key={item.key} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <View style={styles.indexCircle}>
                  <Text style={styles.indexText}>{index + 1}</Text>
                </View>
                <View style={styles.itemTitleContainer}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.itemDescription}>{item.description}</Text>
                </View>
              </View>

              {/* Yes / No Toggle Buttons */}
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[styles.toggleBtn, answer === 'yes' && styles.toggleBtnYes]}
                  onPress={() => handleSelectAnswer(item.key, 'yes')}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color={answer === 'yes' ? Colors.white : Colors.success}
                  />
                  <Text style={[styles.toggleText, answer === 'yes' && styles.toggleTextActive]}>
                    YES / PASS
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.toggleBtn, answer === 'no' && styles.toggleBtnNo]}
                  onPress={() => handleSelectAnswer(item.key, 'no')}
                >
                  <Ionicons
                    name="close-circle"
                    size={18}
                    color={answer === 'no' ? Colors.white : Colors.danger}
                  />
                  <Text style={[styles.toggleText, answer === 'no' && styles.toggleTextActive]}>
                    NO / DEFECT
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Notes input when NO is selected */}
              {isNo && (
                <View style={styles.defectInputContainer}>
                  <Text style={styles.defectLabel}>
                    Describe Defect (Required for Admin Sign-off):
                  </Text>
                  <TextInput
                    style={styles.defectInput}
                    placeholder="E.g., Rear right tyre tread low, cracked mirror..."
                    placeholderTextColor="#94a3b8"
                    value={notes[item.key] || ''}
                    onChangeText={(val) => handleNotesChange(item.key, val)}
                    multiline
                  />
                </View>
              )}
            </View>
          );
        })}

        {hasNo && (
          <View style={styles.warningNotice}>
            <Ionicons name="alert-circle" size={20} color={Colors.warning} />
            <Text style={styles.warningNoticeText}>
              You have flagged one or more items as NO. Submitting will require sign-off approval from Super Admin before jobs unlock.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Footer Submit Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, (!allAnswered || submitting) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!allAnswered || submitting}
        >
          {submitting ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.submitButtonText}>
              {hasNo ? 'Submit for Admin Sign-off' : 'Confirm & Complete Checklist'}
            </Text>
          )}
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.textMuted,
  },
  header: {
    backgroundColor: Colors.white,
    paddingTop: 54,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  headerBadgeText: {
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
  description: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 4,
    lineHeight: 18,
  },
  scrollList: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  itemCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  indexCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  indexText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.accent,
  },
  itemTitleContainer: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  itemDescription: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 3,
    lineHeight: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: '#f8fafc',
  },
  toggleBtnYes: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  toggleBtnNo: {
    backgroundColor: Colors.danger,
    borderColor: Colors.danger,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  toggleTextActive: {
    color: Colors.white,
  },
  defectInputContainer: {
    marginTop: 12,
    backgroundColor: '#fff1f2',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  defectLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.danger,
    marginBottom: 6,
  },
  defectInput: {
    backgroundColor: Colors.white,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fda4af',
    padding: 8,
    fontSize: 13,
    color: Colors.text,
    minHeight: 50,
    textAlignVertical: 'top',
  },
  warningNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 10,
    padding: 12,
    marginTop: 6,
  },
  warningNoticeText: {
    fontSize: 12,
    color: '#92400e',
    fontWeight: '600',
    flex: 1,
    lineHeight: 17,
  },
  footer: {
    padding: 16,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  submitButton: {
    backgroundColor: Colors.accent,
    borderRadius: 10,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  submitButtonText: {
    color: Colors.white,
    fontWeight: '800',
    fontSize: 15,
  },
  // Lock screen
  lockContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    padding: 24,
  },
  lockCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  lockIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  lockTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  lockSubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 18,
  },
  pendingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b45309',
  },
  rejectedBanner: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 18,
    width: '100%',
  },
  rejectedTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#991b1b',
    marginBottom: 4,
  },
  rejectedText: {
    fontSize: 12,
    color: '#7f1d1d',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
  },
  refreshButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.accent,
  },
});
