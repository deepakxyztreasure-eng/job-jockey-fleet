import React, { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  PanResponder,
  GestureResponderEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import Svg, { Path } from 'react-native-svg';
import { Colors } from '../../theme/colors';
import { Job } from '../../types';
import { submitJobCompletion } from '../../api/jobs';
import { supabase } from '../../api/supabase';
import { enqueueAction } from '../../services/offlineQueue';

interface DeliveryConfirmScreenProps {
  job: Job;
  driverId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export const DeliveryConfirmScreen: React.FC<DeliveryConfirmScreenProps> = ({
  job,
  driverId,
  onSuccess,
  onCancel,
}) => {
  const [proofUri, setProofUri] = useState<string | null>(null);
  const [signerName, setSignerName] = useState(job.customer_name || '');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isScrollEnabled, setIsScrollEnabled] = useState(true);

  // Signature vector paths
  const [paths, setPaths] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');

  // PanResponder for smooth finger / stylus signature drawing
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,

        onPanResponderGrant: (evt: GestureResponderEvent) => {
          setIsScrollEnabled(false);
          const { locationX, locationY } = evt.nativeEvent;
          const x = Math.round(locationX);
          const y = Math.round(locationY);
          setCurrentPath(`M ${x} ${y}`);
        },

        onPanResponderMove: (evt: GestureResponderEvent) => {
          const { locationX, locationY } = evt.nativeEvent;
          const x = Math.round(locationX);
          const y = Math.round(locationY);
          setCurrentPath((prev) => (prev ? `${prev} L ${x} ${y}` : `M ${x} ${y}`));
        },

        onPanResponderRelease: () => {
          setIsScrollEnabled(true);
          setCurrentPath((curr) => {
            if (curr && curr.length > 5) {
              setPaths((prev) => [...prev, curr]);
            }
            return '';
          });
        },

        onPanResponderTerminate: () => {
          setIsScrollEnabled(true);
          setCurrentPath('');
        },
      }),
    []
  );

  const handleClearSignature = () => {
    setPaths([]);
    setCurrentPath('');
  };

  const hasSignature = paths.length > 0 || currentPath.length > 5;

  // Take photo with camera
  const capturePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera permission is required to capture delivery proofs.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.6, // auto-compress to < 500 KB
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      setProofUri(result.assets[0].uri);
    }
  };

  // Helper to convert base64 to binary ArrayBuffer for Supabase Storage
  const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };

  // Upload local delivery image URI to Supabase Storage
  const uploadImage = async (localUri: string, folder: string): Promise<string | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userPrefix = user?.id ? `${user.id}/` : '';
      const filename = `${userPrefix}${folder}/${job.id}_${Date.now()}.jpg`;

      // Read local camera URI using Expo FileSystem as base64 — avoids React Native fetch(file://) failure
      const base64Data = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const arrayBuffer = base64ToArrayBuffer(base64Data);

      const { data, error } = await supabase.storage
        .from('job-proofs')
        .upload(filename, arrayBuffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (error) throw error;
      return data?.path || null;
    } catch (err) {
      console.warn('Storage upload error, falling back to local queue:', err);
      return null;
    }
  };

  // Generate clean SVG vector string from captured strokes
  const exportSignatureSvg = (strokes: string[], width = 340, height = 180): string => {
    const cleanSigner = signerName.trim().replace(/[<>&'"]/g, '') || 'Authorized Receiver';
    const pathsXml = strokes
      .map(
        (d) =>
          `<path d="${d}" stroke="#0f172a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`
      )
      .join('\n    ');

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="#ffffff" rx="10"/>
  <line x1="20" y1="${height - 35}" x2="${width - 20}" y2="${height - 35}" stroke="#cbd5e1" stroke-width="1.5" stroke-dasharray="6,4"/>
  <text x="25" y="${height - 18}" font-family="sans-serif" font-size="11" fill="#94a3b8">Customer Signature • ${cleanSigner}</text>
  <g>
    ${pathsXml}
  </g>
</svg>`;
  };

  // Upload SVG signature vector to Supabase Storage
  const uploadSignatureSvg = async (svgString: string): Promise<string | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userPrefix = user?.id ? `${user.id}/` : '';
      const filename = `${userPrefix}signatures/${job.id}_${Date.now()}.svg`;

      // Convert SVG string directly to ArrayBuffer without needing disk fetch()
      const arrayBuffer = new TextEncoder().encode(svgString).buffer;

      const { data, error } = await supabase.storage
        .from('job-proofs')
        .upload(filename, arrayBuffer, {
          contentType: 'image/svg+xml',
          upsert: true,
        });

      if (error) throw error;
      return data?.path || null;
    } catch (err) {
      console.warn('Signature upload error, will queue offline:', err);
      return null;
    }
  };

  const handleComplete = async () => {
    if (!proofUri) {
      Alert.alert('Delivery Photo Required', 'Please take a clear photo of the delivered material or site.');
      return;
    }

    if (!hasSignature) {
      Alert.alert(
        'Customer Signature Required',
        'Please have the customer or site supervisor sign in the signature pad.'
      );
      return;
    }

    if (!signerName.trim()) {
      Alert.alert(
        'Signer Name Required',
        'Please enter the full name of the customer or site contact who signed.'
      );
      return;
    }

    setSubmitting(true);
    try {
      // 1. Upload photo to storage
      const uploadedProofUrl = await uploadImage(proofUri, 'deliveries');

      // 2. Export & Upload Signature SVG
      const allStrokes = currentPath ? [...paths, currentPath] : paths;
      const svgString = exportSignatureSvg(allStrokes);
      const uploadedSignatureUrl = await uploadSignatureSvg(svgString);

      const completionData = {
        jobId: job.id,
        notes: notes.trim() || null,
        proofImageUrl: uploadedProofUrl || proofUri,
        signatureUrl: uploadedSignatureUrl || `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`,
        signerName: signerName.trim(),
      };

      try {
        await submitJobCompletion(completionData);
      } catch (networkErr) {
        // Enqueue action offline if in mobile black spot
        await enqueueAction('job_completion', {
          jobId: job.id,
          data: {
            status: 'completion_requested',
            completion_notes: completionData.notes,
            proof_image_url: completionData.proofImageUrl,
            customer_signature_url: completionData.signatureUrl,
            customer_signature_name: completionData.signerName,
            actual_end_time: new Date().toISOString(),
            completion_requested_at: new Date().toISOString(),
          },
        });
        Alert.alert(
          'Saved Offline',
          'You are in a mobile black spot. Delivery photo and customer signature have been saved securely on your device and will sync automatically when network returns.'
        );
        onSuccess();
        return;
      }

      Alert.alert('Delivery Completed', 'Proof of delivery and customer signature submitted successfully.');
      onSuccess();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to submit delivery confirmation.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Delivery Confirmation (POD)</Text>
          <TouchableOpacity onPress={onCancel} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>
        <Text style={styles.jobSubtext}>
          Job #{job.job_number || 'JOB'} • {job.title}
        </Text>
      </View>

      <ScrollView
        style={styles.scrollList}
        contentContainerStyle={styles.scrollContent}
        scrollEnabled={isScrollEnabled}
      >
        {/* Section 1: Delivery Photo (Mandatory) */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>
              1. Photo of Delivery <Text style={styles.required}>*</Text>
            </Text>
            {proofUri && (
              <View style={styles.badgeSuccess}>
                <Ionicons name="checkmark-circle" size={14} color="#059669" />
                <Text style={styles.badgeSuccessText}>Photo Captured</Text>
              </View>
            )}
          </View>
          <Text style={styles.sectionSubtitle}>
            Capture tip point, unloaded material, or site context.
          </Text>

          {proofUri ? (
            <View style={styles.previewContainer}>
              <Image source={{ uri: proofUri }} style={styles.photoPreview} />
              <TouchableOpacity style={styles.retakeBtn} onPress={capturePhoto}>
                <Ionicons name="camera" size={16} color={Colors.white} />
                <Text style={styles.retakeBtnText}>Retake Photo</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.captureBox} onPress={capturePhoto}>
              <Ionicons name="camera" size={36} color={Colors.accent} />
              <Text style={styles.captureBoxText}>Take Delivery Photo</Text>
              <Text style={styles.captureBoxSubtext}>Tap to open camera</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Section 2: Customer Signature (Mandatory) */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>
              2. Customer Signature <Text style={styles.required}>*</Text>
            </Text>
            {hasSignature ? (
              <View style={styles.badgeSuccess}>
                <Ionicons name="checkmark-circle" size={14} color="#059669" />
                <Text style={styles.badgeSuccessText}>Signed</Text>
              </View>
            ) : (
              <View style={styles.badgePending}>
                <Ionicons name="alert-circle" size={14} color="#d97706" />
                <Text style={styles.badgePendingText}>Signature Required</Text>
              </View>
            )}
          </View>
          <Text style={styles.sectionSubtitle}>
            Ask the site contact or recipient to sign below using finger or stylus.
          </Text>

          {/* Receiver Full Name */}
          <View style={styles.signerNameGroup}>
            <Text style={styles.inputLabel}>
              Signer / Receiver Full Name <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              value={signerName}
              onChangeText={setSignerName}
              placeholder="Full name of receiver on site"
              placeholderTextColor="#94a3b8"
            />
          </View>

          {/* Touch Signature Pad */}
          <View style={styles.sigPadWrapper}>
            <View style={styles.sigPadHeader}>
              <Text style={styles.sigPadLabel}>Sign Inside Box</Text>
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={handleClearSignature}
                disabled={!hasSignature}
              >
                <Ionicons
                  name="trash-outline"
                  size={14}
                  color={hasSignature ? Colors.danger : '#cbd5e1'}
                />
                <Text
                  style={[
                    styles.clearBtnText,
                    !hasSignature && styles.clearBtnTextDisabled,
                  ]}
                >
                  Clear
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.canvasContainer} {...panResponder.panHandlers}>
              <Svg style={styles.svgPad}>
                {paths.map((p, idx) => (
                  <Path
                    key={`stroke-${idx}`}
                    d={p}
                    stroke="#0f172a"
                    strokeWidth={3}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
                {currentPath ? (
                  <Path
                    d={currentPath}
                    stroke="#0f172a"
                    strokeWidth={3}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : null}
              </Svg>

              {/* Guide Dotted Baseline */}
              <View style={styles.signGuideContainer} pointerEvents="none">
                <View style={styles.signGuideLine} />
                <Text style={styles.signGuideText}>✕ Sign on line above</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Section 3: Delivery Notes */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>3. Delivery Notes (Optional)</Text>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Tipped at front stockpile, site access gate locked after delivery..."
            placeholderTextColor="#94a3b8"
            multiline
          />
        </View>
      </ScrollView>

      {/* Footer Submit */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!proofUri || !hasSignature || !signerName.trim() || submitting) &&
              styles.submitButtonDisabled,
          ]}
          onPress={handleComplete}
          disabled={!proofUri || !hasSignature || !signerName.trim() || submitting}
        >
          {submitting ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.submitButtonText}>Confirm & Complete Delivery</Text>
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
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  closeBtn: {
    padding: 4,
  },
  jobSubtext: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 4,
  },
  scrollList: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  required: {
    color: Colors.danger,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 12,
  },
  badgeSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  badgeSuccessText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  badgePending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fffbeb',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  badgePendingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#d97706',
  },
  captureBox: {
    backgroundColor: '#eff6ff',
    borderWidth: 2,
    borderColor: '#bfdbfe',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureBoxText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.accent,
    marginTop: 8,
  },
  captureBoxSubtext: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  previewContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  photoPreview: {
    width: '100%',
    height: 180,
    borderRadius: 10,
  },
  retakeBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  retakeBtnText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  signerNameGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 14,
    color: Colors.text,
  },
  sigPadWrapper: {
    marginTop: 4,
  },
  sigPadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sigPadLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.danger,
  },
  clearBtnTextDisabled: {
    color: '#cbd5e1',
  },
  canvasContainer: {
    width: '100%',
    height: 170,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#94a3b8',
    overflow: 'hidden',
    position: 'relative',
  },
  svgPad: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  signGuideContainer: {
    position: 'absolute',
    bottom: 14,
    left: 16,
    right: 16,
  },
  signGuideLine: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginBottom: 4,
  },
  signGuideText: {
    fontSize: 10,
    color: '#94a3b8',
    fontWeight: '600',
  },
  notesInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: Colors.text,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  footer: {
    padding: 16,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  submitButton: {
    backgroundColor: Colors.success,
    borderRadius: 10,
    height: 50,
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
});
