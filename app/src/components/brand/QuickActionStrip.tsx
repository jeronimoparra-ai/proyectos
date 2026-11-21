import { View, Text, StyleSheet, type ViewStyle, type StyleProp } from 'react-native';
import { AnimatedPressable } from '../AnimatedPressable';
import { IconPlus, IconBrain, IconCalendar } from '../icons';
import { useTheme } from '../../hooks';
import { touchTarget } from '../../theme';

interface QuickActionStripProps {
  onCreateTask: () => void;
  onCreateAcademic?: () => void;
  onCreateEvent?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function QuickActionStrip({
  onCreateTask,
  onCreateAcademic,
  onCreateEvent,
  style,
}: QuickActionStripProps) {
  const { colors, borderRadius, isDark } = useTheme();

  return (
    <View
      style={[styles.container, style]}
      accessible
      accessibilityRole="toolbar"
      accessibilityLabel="Acciones rápidas de creación"
    >
      <AnimatedPressable
        containerStyle={styles.buttonWrapper}
        style={[
          styles.actionButton,
          {
            backgroundColor: isDark ? colors.surfaceVariant : colors.surface,
            borderColor: colors.border,
            borderRadius: borderRadius.md,
            minHeight: touchTarget.min,
          },
        ]}
        onPress={onCreateTask}
        accessibilityRole="button"
        accessibilityLabel="Crear nueva tarea"
      >
        <View style={[styles.iconCircle, { backgroundColor: colors.inkMuted }]}>
          <IconPlus size={16} color={colors.primary} />
        </View>
        <Text style={[styles.buttonLabel, { color: colors.text }]}>Tarea</Text>
      </AnimatedPressable>

      {onCreateAcademic && (
        <AnimatedPressable
          containerStyle={styles.buttonWrapper}
          style={[
            styles.actionButton,
            {
              backgroundColor: isDark ? colors.surfaceVariant : colors.surface,
              borderColor: colors.border,
              borderRadius: borderRadius.md,
              minHeight: touchTarget.min,
            },
          ]}
          onPress={onCreateAcademic}
          accessibilityRole="button"
          accessibilityLabel="Crear tarea académica o repaso"
        >
          <View style={[styles.iconCircle, { backgroundColor: colors.amberMuted }]}>
            <IconBrain size={16} color={colors.accent} />
          </View>
          <Text style={[styles.buttonLabel, { color: colors.text }]}>Repaso</Text>
        </AnimatedPressable>
      )}

      {onCreateEvent && (
        <AnimatedPressable
          containerStyle={styles.buttonWrapper}
          style={[
            styles.actionButton,
            {
              backgroundColor: isDark ? colors.surfaceVariant : colors.surface,
              borderColor: colors.border,
              borderRadius: borderRadius.md,
              minHeight: touchTarget.min,
            },
          ]}
          onPress={onCreateEvent}
          accessibilityRole="button"
          accessibilityLabel="Crear nuevo evento en calendario"
        >
          <View style={[styles.iconCircle, { backgroundColor: colors.inkMuted }]}>
            <IconCalendar size={16} color={colors.primary} />
          </View>
          <Text style={[styles.buttonLabel, { color: colors.text }]}>Evento</Text>
        </AnimatedPressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    marginVertical: 12,
  },
  buttonWrapper: {
    flex: 1,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  iconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
