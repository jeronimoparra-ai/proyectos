import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useTheme } from '../hooks';

interface DateInputProps {
  label: string;
  value: Date | null;
  onChange: (date: Date) => void;
  mode?: 'date' | 'time';
  placeholder?: string;
  minimumDate?: Date;
}

function formatDisplay(date: Date | null, mode: 'date' | 'time'): string {
  if (!date) return '';
  if (mode === 'date') {
    return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
  }
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function DateInput({ label, value, onChange, mode = 'date', placeholder, minimumDate }: DateInputProps) {
  const { colors, borderRadius } = useTheme();
  const [showPicker, setShowPicker] = useState(false);

  const handleChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
    if (selectedDate) {
      onChange(selectedDate);
      if (Platform.OS === 'ios') {
        // Keep picker open on iOS until user taps Done
      }
    }
  };

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <TouchableOpacity
        style={[
          styles.input,
          {
            backgroundColor: colors.surfaceVariant,
            borderColor: colors.border,
            borderRadius: borderRadius.md,
          },
        ]}
        onPress={() => setShowPicker(true)}
      >
        <Text
          style={[
            styles.inputText,
            { color: value ? colors.text : colors.textTertiary },
          ]}
        >
          {formatDisplay(value, mode) || placeholder || (mode === 'date' ? 'Select date' : 'Select time')}
        </Text>
      </TouchableOpacity>

      {showPicker && (
        <DateTimePicker
          value={value ?? new Date()}
          mode={mode}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleChange}
          minimumDate={minimumDate}
          {...(Platform.OS === 'ios' && {
            onCancel: () => setShowPicker(false),
          })}
        />
      )}

      {showPicker && Platform.OS === 'ios' && (
        <TouchableOpacity
          style={[styles.doneButton, { backgroundColor: colors.primary, borderRadius: borderRadius.md }]}
          onPress={() => setShowPicker(false)}
        >
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    height: 48,
    borderWidth: 1,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  inputText: {
    fontSize: 16,
  },
  doneButton: {
    marginTop: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
