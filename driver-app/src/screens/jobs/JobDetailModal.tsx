import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { Job } from '../../types';
import { StatusBadge } from '../../components/StatusBadge';

interface JobDetailModalProps {
  job: Job | null;
  visible: boolean;
  onClose: () => void;
  onStartJob?: (job: Job) => void;
  onCompleteJob?: (job: Job) => void;
}

export const JobDetailModal: React.FC<JobDetailModalProps> = ({
  job,
  visible,
  onClose,
  onStartJob,
  onCompleteJob,
}) => {
  if (!job) return null;

  const openMaps = (address?: string | null) => {
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

  const callNumber = (phone?: string | null) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`).catch(() => {});
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-AU', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  const codAmount = job.price != null ? `$${Number(job.price).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={24} color={Colors.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerSub}>JOB DETAILS</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>
              #{job.job_number || 'JOB'} • {job.title}
            </Text>
          </View>
          <StatusBadge status={job.status} priority={job.priority} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          {/* COD Alert Banner */}
          {job.cod ? (
            <View style={styles.codCard}>
              <View style={styles.codIconWrap}>
                <Ionicons name="cash" size={26} color="#b45309" />
              </View>
              <View style={styles.codInfo}>
                <Text style={styles.codBadgeText}>CASH ON DELIVERY (COD)</Text>
                <Text style={styles.codAmountText}>
                  {codAmount ? `Collect ${codAmount}` : 'Collect Payment on Delivery'}
                </Text>
                <Text style={styles.codNote}>
                  ⚠️ Please collect full payment from customer before unloading/tipping material.
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.invoiceCard}>
              <Ionicons name="document-text-outline" size={20} color={Colors.accent} />
              <Text style={styles.invoiceText}>
                Account Invoice Job • #{job.invoice_number || 'N/A'} (No cash collection required)
              </Text>
            </View>
          )}

          {/* Quick Details Table */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeading}>Run Information</Text>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Job #</Text>
              <Text style={styles.infoValue}>#{job.job_number != null ? String(job.job_number).padStart(4, '0') : '—'}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Job Title</Text>
              <Text style={[styles.infoValue, styles.fontBold]}>{job.title}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Scheduled Date</Text>
              <Text style={styles.infoValue}>
                {job.start_time
                  ? formatDate(job.start_time)
                  : job.scheduled_date
                    ? formatDate(job.scheduled_date)
                    : '—'}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Payment Type</Text>
              <Text style={[styles.infoValue, job.cod ? styles.textCod : undefined]}>
                {job.cod
                  ? `Cash on Delivery (COD)${codAmount ? ` — ${codAmount}` : ''}`
                  : 'Invoice'}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Invoice #</Text>
              <Text style={styles.infoValue}>{job.invoice_number || '—'}</Text>
            </View>
          </View>

          {/* Route & Locations */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeading}>Route Locations</Text>

            {/* Pickup */}
            <View style={styles.locationBlock}>
              <View style={styles.locHeader}>
                <Ionicons name="radio-button-on" size={18} color={Colors.accent} />
                <Text style={styles.locType}>PICKUP LOCATION</Text>
              </View>
              <Text style={styles.locAddress}>{job.pickup_address || 'Pickup location not specified'}</Text>
              {job.pickup_address && (
                <TouchableOpacity style={styles.mapsBtn} onPress={() => openMaps(job.pickup_address)}>
                  <Ionicons name="navigate" size={14} color={Colors.accent} />
                  <Text style={styles.mapsBtnText}>Open in Google Maps</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.divider} />

            {/* Delivery */}
            <View style={styles.locationBlock}>
              <View style={styles.locHeader}>
                <Ionicons name="location" size={18} color={Colors.danger} />
                <Text style={styles.locType}>DELIVERY LOCATION</Text>
              </View>
              <Text style={styles.locAddress}>{job.delivery_address || 'Delivery address provided upon arrival'}</Text>
              {job.delivery_address && (
                <TouchableOpacity style={styles.mapsBtn} onPress={() => openMaps(job.delivery_address)}>
                  <Ionicons name="navigate" size={14} color={Colors.accent} />
                  <Text style={styles.mapsBtnText}>Open in Google Maps</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Customer & Contact */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeading}>Customer & Site Contact</Text>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Customer Name</Text>
              <Text style={[styles.infoValue, styles.fontBold]}>{job.customer_name || '—'}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Mobile Number</Text>
              <View style={styles.phoneActionWrap}>
                <Text style={styles.infoValue}>{job.customer_mobile || '—'}</Text>
                {job.customer_mobile && (
                  <TouchableOpacity style={styles.callSmallBtn} onPress={() => callNumber(job.customer_mobile)}>
                    <Ionicons name="call" size={12} color={Colors.white} />
                    <Text style={styles.callSmallBtnText}>Call</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          {/* Material & Loads */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeading}>Cargo & Payload</Text>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Quantity</Text>
              <Text style={styles.infoValue}>
                {job.quantity != null ? `${job.quantity} ${job.quantity_unit || 'T'}` : '—'}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Number of Loads</Text>
              <Text style={styles.infoValue}>{job.number_of_loads != null ? job.number_of_loads : '—'}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Unit</Text>
              <Text style={styles.infoValue}>{job.quantity_unit || '—'}</Text>
            </View>

            <View style={styles.infoRowStacked}>
              <Text style={styles.infoLabel}>Product Description</Text>
              <Text style={styles.infoValueBlock}>{job.description || '—'}</Text>
            </View>
          </View>

          {/* Special Instructions & Site Notes */}
          {job.instructions && (
            <View style={[styles.sectionCard, styles.instructionsCard]}>
              <View style={styles.instrHeader}>
                <Ionicons name="alert-circle" size={18} color="#d97706" />
                <Text style={styles.instrTitle}>Site Instructions & Hazards</Text>
              </View>
              <Text style={styles.instrText}>{job.instructions}</Text>
            </View>
          )}

          {/* Created Metadata */}
          <View style={styles.metaFooter}>
            <Text style={styles.metaFooterText}>
              Created: {formatDate(job.created_at)}
            </Text>
          </View>
        </ScrollView>

        {/* Action Footer */}
        <View style={styles.footer}>
          {job.status === 'assigned' && onStartJob && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnStart]}
              onPress={() => {
                onClose();
                onStartJob(job);
              }}
            >
              <Ionicons name="play" size={18} color={Colors.white} />
              <Text style={styles.actionBtnText}>Start Job Run</Text>
            </TouchableOpacity>
          )}

          {job.status === 'in_progress' && onCompleteJob && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnComplete]}
              onPress={() => {
                onClose();
                onCompleteJob(job);
              }}
            >
              <Ionicons name="checkmark-done" size={18} color={Colors.white} />
              <Text style={styles.actionBtnText}>Complete & Capture Proof / Signature</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.closeFooterBtn} onPress={onClose}>
            <Text style={styles.closeFooterBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 36,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeBtn: {
    padding: 6,
    marginRight: 8,
  },
  headerTitleWrap: {
    flex: 1,
    marginRight: 8,
  },
  headerSub: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.accent,
    letterSpacing: 0.8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  codCard: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    shadowColor: '#b45309',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  codIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fde68a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  codInfo: {
    flex: 1,
  },
  codBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#92400e',
    letterSpacing: 0.5,
  },
  codAmountText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#78350f',
    marginTop: 2,
    marginBottom: 4,
  },
  codNote: {
    fontSize: 12,
    color: '#92400e',
    lineHeight: 16,
    fontWeight: '500',
  },
  invoiceCard: {
    backgroundColor: '#eff6ff',
    borderColor: '#bfdbfe',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  invoiceText: {
    fontSize: 13,
    color: '#1e40af',
    fontWeight: '600',
    flex: 1,
  },
  sectionCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 6,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  infoRowStacked: {
    paddingVertical: 7,
  },
  infoLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '600',
    maxWidth: '65%',
    textAlign: 'right',
  },
  infoValueBlock: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '500',
    marginTop: 4,
    lineHeight: 18,
  },
  fontBold: {
    fontWeight: '700',
  },
  textCod: {
    color: '#b45309',
    fontWeight: '800',
  },
  phoneActionWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  callSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    gap: 4,
  },
  callSmallBtnText: {
    fontSize: 11,
    color: Colors.white,
    fontWeight: '700',
  },
  locationBlock: {
    paddingVertical: 6,
  },
  locHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  locType: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  locAddress: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    lineHeight: 20,
    marginLeft: 24,
    marginBottom: 8,
  },
  mapsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginLeft: 24,
    gap: 6,
  },
  mapsBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.accent,
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 10,
  },
  instructionsCard: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  instrHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  instrTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400e',
  },
  instrText: {
    fontSize: 13,
    color: '#78350f',
    lineHeight: 19,
    fontWeight: '500',
  },
  metaFooter: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  metaFooterText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  footer: {
    padding: 16,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 10,
  },
  actionBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  actionBtnStart: {
    backgroundColor: '#2563eb',
  },
  actionBtnComplete: {
    backgroundColor: '#059669',
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
  },
  closeFooterBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  closeFooterBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
});
