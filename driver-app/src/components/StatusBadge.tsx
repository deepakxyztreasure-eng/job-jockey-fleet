import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme/colors';
import { JobStatus, JobPriority } from '../types';

interface StatusBadgeProps {
  status: JobStatus;
  priority?: JobPriority;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, priority }) => {
  const isPriority = priority === 'priority';

  const getStatusColor = () => {
    switch (status) {
      case 'assigned':
      case 'pending':
        return { bg: '#e0f2fe', text: '#0369a1', label: 'NEW ALLOCATED' };
      case 'accepted':
        return { bg: Colors.warningBg, text: Colors.warning, label: 'ACCEPTED' };
      case 'in_progress':
        return { bg: '#ede9fe', text: '#6d28d9', label: 'IN PROGRESS' };
      case 'completion_requested':
        return { bg: '#fef3c7', text: '#b45309', label: 'PENDING VERIFY' };
      case 'completed':
      case 'closed':
        return { bg: Colors.successBg, text: Colors.success, label: 'COMPLETED' };
      case 'rejected':
        return { bg: Colors.dangerBg, text: Colors.danger, label: 'REJECTED' };
      default:
        return { bg: '#f1f5f9', text: Colors.textMuted, label: status.toUpperCase() };
    }
  };

  const config = getStatusColor();

  return (
    <View style={styles.container}>
      {isPriority && (
        <View style={styles.priorityBadge}>
          <Text style={styles.priorityText}>🔥 URGENT</Text>
        </View>
      )}
      <View style={[styles.badge, { backgroundColor: config.bg }]}>
        <Text style={[styles.text, { color: config.text }]}>{config.label}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  priorityBadge: {
    backgroundColor: '#fee2e2',
    borderColor: '#ef4444',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  priorityText: {
    color: '#b91c1c',
    fontSize: 11,
    fontWeight: '800',
  },
});
