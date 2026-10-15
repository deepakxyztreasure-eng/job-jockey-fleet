import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Colors } from '../theme/colors';
import { Job } from '../types';
import { StatusBadge } from './StatusBadge';
import { calculateDrivingETA, ETAResult } from '../services/googleMaps';

interface JobCardProps {
  job: Job;
  onAccept?: (job: Job) => void;
  onReject?: (job: Job) => void;
  onStart?: (job: Job) => void;
  onComplete?: (job: Job) => void;
  onPressDetails?: (job: Job) => void;
}

export const JobCard: React.FC<JobCardProps> = ({
  job,
  onAccept,
  onReject,
  onStart,
  onComplete,
  onPressDetails,
}) => {
  const [expandedNotes, setExpandedNotes] = useState(false);
  const [eta, setEta] = useState<ETAResult | null>(null);

  useEffect(() => {
    if (job.status === 'in_progress' && job.delivery_address) {
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        .then((loc) => {
          return calculateDrivingETA(
            loc.coords.latitude,
            loc.coords.longitude,
            job.delivery_address!
          );
        })
        .then((res) => {
          if (res) setEta(res);
        })
        .catch(() => {});
    }
  }, [job.status, job.delivery_address]);

  const openNavigation = (address?: string | null) => {
    if (!address) return;
    const cleanAddress = encodeURIComponent(address);
    const url = Platform.select({
      ios: `maps:0,0?q=${cleanAddress}`,
      android: `geo:0,0?q=${cleanAddress}`,
      default: `https://maps.google.com/?q=${cleanAddress}`,
    });
    Linking.openURL(url!).catch(() => {
      Linking.openURL(`https://maps.google.com/?q=${cleanAddress}`);
    });
  };

  const hasSpecialNotes =
    !!job.instructions ||
    (job.stops && job.stops.some((s) => s.gate_code || s.site_hazards || s.contact_person));

  return (
    <View style={[styles.card, job.priority === 'priority' && styles.priorityCardBorder]}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {job.title}
          </Text>
          <Text style={styles.subtext}>
            #{job.job_number || 'JOB'} • Inv: {job.invoice_number || 'N/A'}
          </Text>
        </View>
        <StatusBadge status={job.status} priority={job.priority} />
      </View>

      {/* Addresses */}
      <View style={styles.routeContainer}>
        {/* Pickup */}
        {job.pickup_address && (
          <View style={styles.routeRow}>
            <Ionicons name="radio-button-on" size={16} color={Colors.accent} style={styles.routeIcon} />
            <View style={styles.routeTextContainer}>
              <Text style={styles.routeLabel}>PICKUP</Text>
              <Text style={styles.routeAddress}>{job.pickup_address}</Text>
            </View>
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => openNavigation(job.pickup_address)}
            >
              <Ionicons name="navigate" size={14} color={Colors.accent} />
              <Text style={styles.navText}>Maps</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Delivery / Destination */}
        <View style={styles.routeRow}>
          <Ionicons name="location" size={18} color={Colors.danger} style={styles.routeIcon} />
          <View style={styles.routeTextContainer}>
            <Text style={styles.routeLabel}>DELIVERY</Text>
            <Text style={styles.routeAddress}>
              {job.delivery_address || 'Address provided upon arrival'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => openNavigation(job.delivery_address)}
          >
            <Ionicons name="navigate" size={14} color={Colors.accent} />
            <Text style={styles.navText}>Maps</Text>
          </TouchableOpacity>
        </View>

        {/* Live Google Maps ETA Badge */}
        {eta && (
          <View style={styles.etaBadge}>
            <Ionicons name="time" size={14} color="#047857" />
            <Text style={styles.etaText}>
              Google ETA: {eta.durationText} ({eta.distanceText}) • Arrive ~{eta.estimatedArrival}
            </Text>
          </View>
        )}
      </View>

      {/* Customer & Quantity info */}
      <View style={styles.metaRow}>
        {job.customer_name && (
          <View style={styles.metaItem}>
            <Ionicons name="person-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.metaText}>{job.customer_name}</Text>
          </View>
        )}
        {job.quantity != null && (
          <View style={styles.metaItem}>
            <Ionicons name="cube-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.metaText}>
              {job.quantity} {job.quantity_unit || 'T'}
              {job.number_of_loads ? ` (${job.number_of_loads} loads)` : ''}
            </Text>
          </View>
        )}
        {job.cod && (
          <View style={[styles.metaItem, styles.codBadge]}>
            <Text style={styles.codText}>💰 COD</Text>
          </View>
        )}
      </View>

      {/* Pre-Acceptance Notes Accordion */}
      {hasSpecialNotes && (
        <View style={styles.notesContainer}>
          <TouchableOpacity
            style={styles.notesToggle}
            onPress={() => setExpandedNotes(!expandedNotes)}
          >
            <Ionicons
              name={expandedNotes ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={Colors.accent}
            />
            <Text style={styles.notesToggleText}>
              {expandedNotes ? 'Hide Site Details & Hazards' : '⚠️ View Site Hazards & Gate Codes'}
            </Text>
          </TouchableOpacity>

          {expandedNotes && (
            <View style={styles.notesContent}>
              {job.instructions && (
                <View style={styles.noteItem}>
                  <Text style={styles.noteLabel}>Instructions:</Text>
                  <Text style={styles.noteValue}>{job.instructions}</Text>
                </View>
              )}
              {job.customer_mobile && (
                <TouchableOpacity
                  style={styles.phoneCallRow}
                  onPress={() => Linking.openURL(`tel:${job.customer_mobile}`)}
                >
                  <Ionicons name="call" size={14} color={Colors.success} />
                  <Text style={styles.phoneCallText}>Call Site Contact: {job.customer_mobile}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )}

      {/* Multi-Stop indicator */}
      {job.stops && job.stops.length > 1 && (
        <View style={styles.multiStopBadge}>
          <Ionicons name="git-network-outline" size={14} color={Colors.accent} />
          <Text style={styles.multiStopText}>{job.stops.length} Multi-Stop Deliveries in Run</Text>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        {/* New Job: Accept or Reject */}
        {(job.status === 'assigned' || job.status === 'pending') && (
          <>
            <TouchableOpacity
              style={[styles.actionBtn, styles.acceptBtn]}
              onPress={() => onAccept && onAccept(job)}
            >
              <Ionicons name="checkmark-circle" size={18} color={Colors.white} />
              <Text style={styles.actionBtnText}>Accept Job</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.rejectBtn]}
              onPress={() => onReject && onReject(job)}
            >
              <Text style={styles.rejectBtnText}>Reject</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Accepted Job: Start Job */}
        {job.status === 'accepted' && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.startBtn]}
            onPress={() => onStart && onStart(job)}
          >
            <Ionicons name="play" size={18} color={Colors.white} />
            <Text style={styles.actionBtnText}>Start Job / En Route</Text>
          </TouchableOpacity>
        )}

        {/* In Progress: Complete Job with POD */}
        {job.status === 'in_progress' && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.completeBtn]}
            onPress={() => onComplete && onComplete(job)}
          >
            <Ionicons name="checkmark-done" size={18} color={Colors.white} />
            <Text style={styles.actionBtnText}>Complete Delivery (POD)</Text>
          </TouchableOpacity>
        )}

        {/* Details button */}
        {onPressDetails && (
          <TouchableOpacity
            style={styles.detailsBtn}
            onPress={() => onPressDetails(job)}
          >
            <Ionicons name="eye-outline" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  priorityCardBorder: {
    borderColor: '#fca5a5',
    borderLeftWidth: 4,
    borderLeftColor: Colors.danger,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  titleContainer: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  subtext: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  routeContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 10,
    gap: 8,
    marginBottom: 12,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeIcon: {
    marginRight: 8,
  },
  routeTextContainer: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  routeAddress: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '500',
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  navText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.accent,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 10,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  codBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  codText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400e',
  },
  notesContainer: {
    backgroundColor: '#fffbeb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fde68a',
    padding: 8,
    marginBottom: 10,
  },
  notesToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  notesToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400e',
  },
  notesContent: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#fef3c7',
    gap: 6,
  },
  noteItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
  },
  noteLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  noteValue: {
    fontSize: 12,
    color: Colors.text,
    flex: 1,
  },
  phoneCallRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  phoneCallText: {
    fontSize: 12,
    color: Colors.success,
    fontWeight: '700',
  },
  multiStopBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0fdf4',
    padding: 6,
    borderRadius: 6,
    marginBottom: 10,
  },
  multiStopText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.success,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  acceptBtn: {
    backgroundColor: Colors.accent,
  },
  rejectBtn: {
    backgroundColor: '#f1f5f9',
    maxWidth: 90,
  },
  startBtn: {
    backgroundColor: Colors.accent,
  },
  completeBtn: {
    backgroundColor: Colors.success,
  },
  actionBtnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
  rejectBtnText: {
    color: Colors.danger,
    fontWeight: '600',
    fontSize: 13,
  },
  detailsBtn: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  etaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#d1fae5',
    borderWidth: 1,
    borderColor: '#6ee7b7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 4,
  },
  etaText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065f46',
  },
});
