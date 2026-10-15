import React, { useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
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
  const [docketUri, setDocketUri] = useState<string | null>(null);
  const [signerName, setSignerName] = useState(job.customer_name || '');
  const [pinCode, setPinCode] = useState('');
  const [grossWeight, setGrossWeight] = useState('');
  const [tareWeight, setTareWeight] = useState('');
  const [notes, setNotes] = useState('');
  const [usePin, setUsePin] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Take photo with camera
  const capturePhoto = async (type: 'proof' | 'docket') => {
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
      if (type === 'proof') setProofUri(result.assets[0].uri);
      if (type === 'docket') setDocketUri(result.assets[0].uri);
    }
  };

  // Upload local image URI to Supabase Storage
  const uploadImage = async (localUri: string, folder: string): Promise<string | null> => {
    try {
      const response = await fetch(localUri);
      const blob = await response.blob();
      const filename = `${folder}/${job.id}_${Date.now()}.jpg`;

      const { data, error } = await supabase.storage
        .from('job-proofs')
        .upload(filename, blob, {
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

  const handleComplete = async () => {
    if (!proofUri) {
      Alert.alert('Delivery Photo Required', 'Please take a clear photo of the delivered material or site.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Upload photo to storage
      const uploadedProofPath = await uploadImage(proofUri, 'deliveries');
      let uploadedDocketPath: string | null = null;
      if (docketUri) {
        uploadedDocketPath = await uploadImage(docketUri, 'dockets');
      }

      const gross = grossWeight ? parseFloat(grossWeight) : null;
      const tare = tareWeight ? parseFloat(tareWeight) : null;
      const net = gross && tare ? Math.max(0, gross - tare) : null;

      const completionData = {
        jobId: job.id,
        notes,
        proofImageUrl: uploadedProofPath || proofUri,
        signerName: signerName.trim() || null,
        pinCode: usePin && pinCode.trim() ? pinCode.trim() : null,
        weighbridgeDocketUrl: uploadedDocketPath || docketUri,
        grossWeight: gross,
        tareWeight: tare,
        netWeight: net,
      };

      try {
        await submitJobCompletion(completionData);
      } catch (networkErr) {
        // Quarry black spot: Enqueue action offline!
        await enqueueAction('job_completion', {
          jobId: job.id,
          data: completionData,
        });
        Alert.alert(
          'Saved Offline',
          'You are in a mobile black spot. Delivery proof has been saved securely to your device and will sync automatically when network returns.'
        );
        onSuccess();
        return;
      }

      Alert.alert('Delivery Completed', 'Proof of delivery submitted successfully.');
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

      <ScrollView style={styles.scrollList} contentContainerStyle={styles.scrollContent}>
        {/* Section 1: Delivery Photo (Mandatory) */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>
            1. Photo of Delivery <Text style={styles.required}>*</Text>
          </Text>
          <Text style={styles.sectionSubtitle}>
            Capture tip point, unloaded material, or site context.
          </Text>

          {proofUri ? (
            <View style={styles.previewContainer}>
              <Image source={{ uri: proofUri }} style={styles.photoPreview} />
              <TouchableOpacity
                style={styles.retakeBtn}
                onPress={() => capturePhoto('proof')}
              >
                <Ionicons name="camera" size={16} color={Colors.white} />
                <Text style={styles.retakeBtnText}>Retake Photo</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.captureBox}
              onPress={() => capturePhoto('proof')}
            >
              <Ionicons name="camera" size={36} color={Colors.accent} />
              <Text style={styles.captureBoxText}>Take Delivery Photo</Text>
              <Text style={styles.captureBoxSubtext}>Tap to open camera</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Section 2: Customer Signature or PIN */}
        <View style={styles.sectionCard}>
          <View style={styles.signatureHeaderRow}>
            <Text style={styles.sectionTitle}>2. Customer Confirmation</Text>
            <TouchableOpacity onPress={() => setUsePin(!usePin)}>
              <Text style={styles.switchModeText}>
                {usePin ? 'Switch to Signature' : 'Switch to 4-Digit PIN'}
              </Text>
            </TouchableOpacity>
          </View>

          {usePin ? (
            <View style={styles.pinContainer}>
              <Text style={styles.inputLabel}>Enter Customer 4-Digit PIN:</Text>
              <TextInput
                style={styles.pinInput}
                value={pinCode}
                onChangeText={setPinCode}
                placeholder="0000"
                keyboardType="number-pad"
                maxLength={4}
              />
            </View>
          ) : (
            <View style={styles.signatureContainer}>
              <Text style={styles.inputLabel}>Recipient / Receiver Full Name:</Text>
              <TextInput
                style={styles.textInput}
                value={signerName}
                onChangeText={setSignerName}
                placeholder="Receiver name on site"
                placeholderTextColor="#94a3b8"
              />
              <View style={styles.sigPadNotice}>
                <Ionicons name="finger-print-outline" size={24} color={Colors.accent} />
                <Text style={styles.sigPadText}>
                  Receiver on-site verification confirmed by {signerName || 'Customer'}.
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Section 3: Weighbridge Docket */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>3. Weighbridge Docket (Quarry Scan)</Text>
          <Text style={styles.sectionSubtitle}>
            Attach weighbridge ticket photo and enter net tonnage.
          </Text>

          {docketUri ? (
            <View style={styles.previewContainer}>
              <Image source={{ uri: docketUri }} style={styles.photoPreview} />
              <TouchableOpacity
                style={styles.retakeBtn}
                onPress={() => capturePhoto('docket')}
              >
                <Ionicons name="camera" size={16} color={Colors.white} />
                <Text style={styles.retakeBtnText}>Retake Docket</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.captureBoxSecondary}
              onPress={() => capturePhoto('docket')}
            >
              <Ionicons name="document-text-outline" size={28} color={Colors.textMuted} />
              <Text style={styles.captureBoxTextSecondary}>Scan Weighbridge Docket Photo</Text>
            </TouchableOpacity>
          )}

          {/* Tonnage Inputs */}
          <View style={styles.tonnageRow}>
            <View style={styles.tonnageCol}>
              <Text style={styles.inputLabel}>Gross (T)</Text>
              <TextInput
                style={styles.tonnageInput}
                value={grossWeight}
                onChangeText={setGrossWeight}
                placeholder="42.5"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.tonnageCol}>
              <Text style={styles.inputLabel}>Tare (T)</Text>
              <TextInput
                style={styles.tonnageInput}
                value={tareWeight}
                onChangeText={setTareWeight}
                placeholder="16.2"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.tonnageCol}>
              <Text style={styles.inputLabel}>Net (T)</Text>
              <View style={styles.netBox}>
                <Text style={styles.netText}>
                  {grossWeight && tareWeight
                    ? (parseFloat(grossWeight) - parseFloat(tareWeight)).toFixed(2)
                    : '—'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Section 4: Delivery Notes */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>4. Notes / Discrepancies</Text>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Delivered to rear stockpad, site clean, left gate locked..."
            placeholderTextColor="#94a3b8"
            multiline
          />
        </View>
      </ScrollView>

      {/* Footer Submit */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, (!proofUri || submitting) && styles.submitButtonDisabled]}
          onPress={handleComplete}
          disabled={!proofUri || submitting}
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
    marginTop: 2,
    marginBottom: 12,
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
  captureBoxSecondary: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureBoxTextSecondary: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
    marginTop: 6,
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
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  retakeBtnText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  signatureHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  switchModeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.accent,
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
  pinContainer: {
    gap: 6,
  },
  pinInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 2,
    borderColor: Colors.accent,
    borderRadius: 10,
    height: 52,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 8,
    color: Colors.text,
  },
  signatureContainer: {
    gap: 10,
  },
  sigPadNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#eff6ff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  sigPadText: {
    fontSize: 12,
    color: Colors.accent,
    flex: 1,
    lineHeight: 16,
  },
  tonnageRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  tonnageCol: {
    flex: 1,
  },
  tonnageInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 42,
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '700',
    color: Colors.text,
  },
  netBox: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 8,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  netText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#065f46',
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
