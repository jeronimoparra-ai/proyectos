import { StyleSheet } from 'react-native';

export const cardStyles = StyleSheet.create({
  cardContainer: {
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardBorderLeft: {
    borderLeftWidth: 4,
  },
  cardBorderLeftThin: {
    borderLeftWidth: 3,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  titleText: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  badgeBase: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeTextBase: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
