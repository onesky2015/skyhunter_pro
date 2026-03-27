// filename: components/HeatmapGrid.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { HeatmapCell } from '../types';
import { getLevelColor, getLevelOpacity, getDayFromDate } from '../constants/utils';
import { useTheme } from '../theme';

interface HeatmapGridProps {
  cells: HeatmapCell[];
  label?: string;
  onCellPress?: (date: string, price: number | null) => void;
  /** Phase 2: 点击后直接触发创建监控（优先于 onCellPress） */
  onCreateMonitor?: (date: string, price: number | null) => void;
}

export const HeatmapGrid: React.FC<HeatmapGridProps> = ({ cells, label, onCellPress, onCreateMonitor }) => {
  const isWeb = Platform.OS === 'web';
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const formatCellDate = (dateStr: string): string => {
    // Web 端显示 MM-DD 格式
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[1]}-${parts[2]}`;
    return getDayFromDate(dateStr);
  };

  const handleCellPress = (cell: HeatmapCell) => {
    // Phase 2: 优先触发创建监控流程
    if (onCreateMonitor) {
      onCreateMonitor(cell.date, cell.price);
      return;
    }

    if (onCellPress) {
      onCellPress(cell.date, cell.price);
      return;
    }
    // 无回调时不做任何操作
  };

  if (cells.length === 0) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>No data</Text>
      </View>
    );
  }

  return (
    <View>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={isWeb ? styles.gridWeb : styles.grid}>
        {cells.map((cell) => (
          <TouchableOpacity
            key={cell.date}
            style={[
              isWeb ? styles.cellWeb : styles.cell,
              { backgroundColor: getLevelColor(cell.level), opacity: getLevelOpacity(cell.level) },
            ]}
            activeOpacity={0.7}
            onPress={() => handleCellPress(cell)}
          >
            {isWeb ? (
              <>
                <Text style={styles.cellDateWeb}>{formatCellDate(cell.date)}</Text>
                <Text style={styles.cellPriceWeb}>
                  {cell.price != null ? `$${Math.round(cell.price)}` : '---'}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.cellDay}>{getDayFromDate(cell.date)}</Text>
                {cell.price != null && (
                  <Text style={styles.cellPrice}>${Math.round(cell.price)}</Text>
                )}
              </>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    placeholder: {
      padding: 20,
      alignItems: 'center',
    },
    placeholderText: {
      color: theme.colors.textSoft,
      fontSize: 14,
    },
    label: {
      color: theme.colors.accent,
      fontSize: 12,
      fontWeight: '600',
      marginBottom: 8,
      textTransform: 'uppercase',
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
    },
    gridWeb: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    cell: {
      width: 28,
      height: 28,
      borderRadius: theme.radius.sm / 2,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    cellWeb: {
      width: 60,
      height: 60,
      borderRadius: theme.radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    cellDay: {
      color: theme.colors.text,
      fontSize: 10,
      fontWeight: '600',
    },
    cellPrice: {
      color: theme.colors.text,
      fontSize: 8,
      marginTop: 2,
    },
    cellDateWeb: {
      color: theme.colors.text,
      fontSize: 10,
      fontWeight: '600',
      marginBottom: 4,
    },
    cellPriceWeb: {
      color: theme.colors.text,
      fontSize: 12,
      fontWeight: '700',
    },
  });

