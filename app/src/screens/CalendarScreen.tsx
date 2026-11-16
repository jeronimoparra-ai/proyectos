import { eventOccursOnDay } from '../components/calendar/event-days';
import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../hooks';
import { useEventStore } from '../store/useEventStore';
import { CalendarGrid } from '../components/calendar/CalendarGrid';
import { WeekView } from '../components/calendar/WeekView';
import { EventCard } from '../components/calendar/EventCard';
import { AnimatedPressable } from '../components/AnimatedPressable';
import { FadeSlideIn } from '../components/FadeSlideIn';
import { IconChevron, IconPlus, IconCalendar } from '../components/icons';
import type { Event } from '../types';
import type { TabScreenProps } from '../navigation/types';

const VIEW_MODES = ['Month', 'Week'] as const;

export function CalendarScreen({ navigation }: TabScreenProps<'Calendar'>) {
  const { colors, borderRadius, insets } = useTheme();
  const {
    events,
    isLoading,
    selectedDate,
    setSelectedDate,
    loadEvents,
  } = useEventStore();
  const [viewMode, setViewMode] = useState<'Month' | 'Week'>('Month');

  useEffect(() => {
    loadEvents();
  }, [selectedDate, loadEvents]);

  const handlePrevMonth = () => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() - 1);
    setSelectedDate(newDate);
  };

  const handleNextMonth = () => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() + 1);
    setSelectedDate(newDate);
  };

  const handlePrevWeek = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 7);
    setSelectedDate(newDate);
  };

  const handleNextWeek = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 7);
    setSelectedDate(newDate);
  };

  const handleDatePress = (date: Date) => {
    setSelectedDate(date);
  };

  const handleEventPress = (event: Event) => {
    navigation.navigate('EventDetail', { eventId: event.id });
  };

  const handleCreateEvent = () => {
    navigation.navigate('EventForm', { eventId: undefined });
  };

  const todayEvents = events.filter(event => eventOccursOnDay(event, selectedDate));

  const navigatePrev = viewMode === 'Month' ? handlePrevMonth : handlePrevWeek;
  const navigateNext = viewMode === 'Month' ? handleNextMonth : handleNextWeek;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FadeSlideIn index={0}>
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <Text style={[styles.title, { color: colors.text }]}>Calendar</Text>
          <AnimatedPressable
            style={[styles.addButton, { backgroundColor: colors.primary, borderRadius: borderRadius.md }]}
            onPress={handleCreateEvent}
            accessibilityRole="button"
            accessibilityLabel="Create event"
          >
            <IconPlus size={16} color="#fff" />
            <Text style={styles.addButtonText}>Event</Text>
          </AnimatedPressable>
        </View>

        <View style={styles.viewToggle}>
          {VIEW_MODES.map((mode) => (
            <AnimatedPressable
              key={mode}
              style={[
                styles.viewToggleBtn,
                {
                  backgroundColor: viewMode === mode ? colors.primary : colors.surfaceVariant,
                  borderRadius: borderRadius.md,
                },
              ]}
              onPress={() => setViewMode(mode)}
              accessibilityRole="button"
              accessibilityLabel={`View mode ${mode}`}
            >
              <Text
                style={[
                  styles.viewToggleText,
                  { color: viewMode === mode ? '#fff' : colors.textSecondary },
                ]}
              >
                {mode}
              </Text>
            </AnimatedPressable>
          ))}
        </View>

        <View style={styles.monthNav}>
          <AnimatedPressable
            onPress={navigatePrev}
            style={styles.navButton}
            accessibilityRole="button"
            accessibilityLabel="Previous period"
          >
            <IconChevron direction="left" size={22} color={colors.primary} />
          </AnimatedPressable>
          <AnimatedPressable
            onPress={navigateNext}
            style={styles.navButton}
            accessibilityRole="button"
            accessibilityLabel="Next period"
          >
            <IconChevron direction="right" size={22} color={colors.primary} />
          </AnimatedPressable>
        </View>
      </FadeSlideIn>

      {viewMode === 'Month' ? (
        <CalendarGrid
          selectedDate={selectedDate}
          currentDate={selectedDate}
          events={events}
          onDatePress={handleDatePress}
        />
      ) : (
        <WeekView
          selectedDate={selectedDate}
          events={events}
          onDatePress={handleDatePress}
          onEventPress={handleEventPress}
        />
      )}

      {viewMode === 'Month' && (
        <View style={styles.eventsSection}>
          <Text style={[styles.eventsTitle, { color: colors.text }]}>
            Events for {selectedDate.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
          </Text>

          {isLoading ? (
            <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />
          ) : (
            <FlatList
              data={todayEvents}
              keyExtractor={(item) => item.id}
              renderItem={({ item, index }) => (
                <FadeSlideIn index={index}>
                  <EventCard event={item} onPress={handleEventPress} />
                </FadeSlideIn>
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <IconCalendar size={36} color={colors.textTertiary} accessibilityLabel="No events" />
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    No events for this day
                  </Text>
                </View>
              }
              contentContainerStyle={styles.eventsList}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  viewToggle: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  viewToggleBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  viewToggleText: {
    fontSize: 14,
    fontWeight: '500',
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  navButton: {
    padding: 10,
  },
  navArrow: {
    fontSize: 24,
    fontWeight: '600',
  },
  eventsSection: {
    flex: 1,
    paddingTop: 16,
  },
  eventsTitle: {
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  eventsList: {
    paddingBottom: 20,
  },
  loader: {
    marginTop: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 30,
    gap: 8,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
  },
});
