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
import { submitDefectReport } from '../../api/compliance';
import { supabase } from '../../api/supabase';

interface DefectReportScreenProps {
  driverId: string;
  vehicleName?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const DEFECT_CATEGORIES = [
  { key: 'tyre', label: 'Tyre / Puncture', icon: 'disc-outline' },
  { key: 'brakes', label: 'Brakes / Air Line', icon: 'hand-left-outline' },
  { key: 'hydraulic_leak', label: 'Hydraulic / Hoist Leak', icon: 'water-outline' },
  { key: 'engine_oil', label: 'Engine Oil / Pressure', icon: 'speedometer-outline' },
  { key: 'coolant', label: 'Coolant / Radiator', icon: 'thermometer-outline' },
  { key: 'lights', label: 'Lights / Indicators', icon: 'bulb-outline' },
  { key: 'body', label: 'Bin / Tailgate / Body', icon: 'cube-outline' },
  { key: 'incident', label: 'Roadside Incident / Scratch', icon: 'warning-outline' },
];

export const DefectReportScreen: React.FC<DefectReportScreenProps> = ({
  driverId,
  vehicleName,
  onSuccess,
  onCancel,
}) => {
  const [defectType, setDefectType] = useState('tyre');
  const [severity, setSeverity] = useState<'minor' | 'urgent_action_required' | 'critical_ground_vehicle'>('minor');
  const [description, setDescription] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const capturePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera permission required to document defect.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      Alert.alert('Required', 'Please describe the defect or incident.');
      return;
    }

    setSubmitting(true);
    try {
      let photoUrl: string | null = null;
      if (photoUri) {
        const resp = await fetch(photoUri);
        const blob = await resp.blob();
        const filename = `defects/${driverId}_${Date.now()}.jpg`;
        const { data } = await supabase.storage.from('job-proofs').upload(filename, blob, {
          contentType: 'image/jpeg',
        });
        photoUrl = data?.path || null;
      }

      await submitDefectReport({
        driver_id: driverId,
        vehicle: vehicleName || 'Tipper Truck',
        defect_type: defectType as any,
        severity,
        description: description.trim(),
        photo_urls: photoUrl ? [photoUrl] : [],
        status: 'open',
        reported_at: new Date().toISOString(),
      });

      Alert.alert(
        'Defect Report Logged',
        'Dispatch has been alerted immediately. If the vehicle is unsafe, park in a safe location.'
      );
      onSuccess();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to submit defect report.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Report Defect or Incident</Text>
          <TouchableOpacity onPress={onCancel} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>
          Mid-shift defect reporting. Flag issues immediately without waiting for evening checklist.
        </Text>
      </View>

      <ScrollView style={styles.scrollList} contentContainerStyle={styles.scrollContent}>
        {/* Severity Selector */}
        <Text style={styles.sectionTitle}>Severity Level</Text>
        <View style={styles.severityRow}>
          <TouchableOpacity
            style={[styles.severityBtn, severity === 'minor' && styles.severityMinor]}
            onPress={() => setSeverity('minor')}
          >
            <Text style={[styles.severityText, severity === 'minor' && styles.severityTextActive]}>
              Minor Issue
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.severityBtn, severity === 'urgent_action_required' && styles.severityUrgent]}
            onPress={() => setSeverity('urgent_action_required')}
          >
            <Text style={[styles.severityText, severity === 'urgent_action_required' && styles.severityTextActive]}>
              Urgent Attention
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.severityBtn, severity === 'critical_ground_vehicle' && styles.severityCritical]}
            onPress={() => setSeverity('critical_ground_vehicle')}
          >
            <Text style={[styles.severityText, severity === 'critical_ground_vehicle' && styles.severityTextActive]}>
              Ground Vehicle
            </Text>
          </TouchableOpacity>
        </View>

        {/* Defect Category Grid */}
        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Defect Category</Text>
        <View style={styles.categoryGrid}>
          {DEFECT_CATEGORIES.map((cat) => {
            const isSelected = defectType === cat.key;
            return (
              <TouchableOpacity
                key={cat.key}
                style={[styles.catCard, isSelected && styles.catCardActive]}
                onPress={() => setDefectType(cat.key)}
              >
                <Ionicons
                  name={cat.icon as any}
                  size={20}
                  color={isSelected ? Colors.accent : Colors.textMuted}
                />
                <Text style={[styles.catText, isSelected && styles.catTextActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Description Input */}
        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Description & Details</Text>
        <TextInput
          style={styles.descInput}
          placeholder="Describe what occurred, any unusual sounds, vibrations, or leaks..."
          placeholderTextColor="#94a3b8"
          value={description}
          onChangeText={setDescription}
          multiline
        />

        {/* Photo Capture */}
        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Photo Evidence</Text>
        {photoUri ? (
          <View style={styles.photoContainer}>
            <Image source={{ uri: photoUri }} style={styles.previewImage} />
            <TouchableOpacity style={styles.retakeBtn} onPress={capturePhoto}>
              <Ionicons name="camera" size={16} color={Colors.white} />
              <Text style={styles.retakeText}>Retake Photo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.captureBox} onPress={capturePhoto}>
            <Ionicons name="camera" size={28} color={Colors.accent} />
            <Text style={styles.captureText}>Take Photo of Defect</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Footer Submit */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.submitButtonText}>Transmit Defect Report to Dispatch</Text>
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
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
  },
  closeBtn: {
    padding: 4,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
    lineHeight: 16,
  },
  scrollList: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  severityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  severityBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  severityMinor: {
    backgroundColor: '#eff6ff',
    borderColor: '#93c5fd',
  },
  severityUrgent: {
    backgroundColor: '#fef3c7',
    borderColor: '#fcd34d',
  },
  severityCritical: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
  },
  severityText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    textAlign: 'center',
  },
  severityTextActive: {
    color: Colors.text,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  catCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.white,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  catCardActive: {
    borderColor: Colors.accent,
    backgroundColor: '#eff6ff',
  },
  catText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
    flex: 1,
  },
  catTextActive: {
    color: Colors.accent,
    fontWeight: '700',
  },
  descInput: {
    backgroundColor: Colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    fontSize: 13,
    color: Colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  captureBox: {
    backgroundColor: Colors.white,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  captureText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.accent,
  },
  photoContainer: {
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: 160,
  },
  retakeBtn: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  retakeText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '600',
  },
  footer: {
    padding: 16,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  submitButton: {
    backgroundColor: Colors.danger,
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
    fontSize: 14,
    fontWeight: '800',
  },
});
