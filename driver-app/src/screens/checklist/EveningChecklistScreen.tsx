import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { EVENING_CHECKLIST_ITEMS, submitChecklist } from '../../api/checklist';
import { ChecklistItemResponse } from '../../types';

interface EveningChecklistScreenProps {
  driverId: string;
  driverName: string;
  onChecklistCompleted: () => void;
  onCancel: () => void;
}

export const EveningChecklistScreen: React.FC<EveningChecklistScreenProps> = ({
  driverId,
  driverName,
  onChecklistCompleted,
  onCancel,
}) => {
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);

  const toggleItem = (key: string) => {
    setCheckedItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const allCompleted = EVENING_CHECKLIST_ITEMS.every((item) => !!checkedItems[item.key]);

  const handleSubmit = async () => {
    if (!allCompleted) {
      Alert.alert('Incomplete', 'Please inspect and confirm all 9 evening maintenance items before clocking out.');
      return;
    }

    setSubmitting(true);
    try {
      const responses: ChecklistItemResponse[] = EVENING_CHECKLIST_ITEMS.map((item) => ({
        item_key: item.key,
        title: item.title,
        answer: 'yes',
      }));

      await submitChecklist(driverId, 'evening', responses, driverName);
      Alert.alert('Shift Closed', 'Evening checklist recorded. Thank you for your hard work today!');
      onChecklistCompleted();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to submit evening checklist.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerBadge}>
            <Ionicons name="moon" size={16} color={Colors.warning} />
            <Text style={styles.headerBadgeText}>END OF SHIFT CHECKLIST</Text>
          </View>
          <TouchableOpacity onPress={onCancel} style={styles.cancelBtn}>
            <Ionicons name="close" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>
        <Text style={styles.title}>Evening Maintenance & Refuel</Text>
        <Text style={styles.subtitle}>
          Ensure vehicle is refueled, inspected, and ready for tomorrow's dispatch before logging out.
        </Text>
      </View>

      <ScrollView style={styles.scrollList} contentContainerStyle={styles.scrollContent}>
        {EVENING_CHECKLIST_ITEMS.map((item, index) => {
          const isDone = !!checkedItems[item.key];

          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.itemCard, isDone && styles.itemCardDone]}
              activeOpacity={0.8}
              onPress={() => toggleItem(item.key)}
            >
              <View style={[styles.checkbox, isDone && styles.checkboxDone]}>
                {isDone && <Ionicons name="checkmark" size={16} color={Colors.white} />}
              </View>
              <View style={styles.itemTextContainer}>
                <Text style={[styles.itemTitle, isDone && styles.itemTitleDone]}>
                  {index + 1}. {item.title}
                </Text>
                <Text style={styles.itemDescription}>{item.description}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, (!allCompleted || submitting) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!allCompleted || submitting}
        >
          {submitting ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.submitButtonText}>
              {allCompleted ? 'Submit Checklist & Clock Out' : `Confirm all 9 items to Clock Out`}
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
  header: {
    backgroundColor: Colors.white,
    paddingTop: 54,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.warning,
    letterSpacing: 0.5,
  },
  cancelBtn: {
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  subtitle: {
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
    paddingBottom: 24,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  itemCardDone: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  itemTextContainer: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  itemTitleDone: {
    color: '#166534',
  },
  itemDescription: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  footer: {
    padding: 16,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  submitButton: {
    backgroundColor: '#0f172a',
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
    fontSize: 14,
  },
});
