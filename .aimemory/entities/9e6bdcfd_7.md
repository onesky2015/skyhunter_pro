# Source: frontend/components/admin/DashboardTab.tsx
# Lines: 226-255
# Type: Source Code

```typescript
<Text style={s.exportBtnText}>Audit Log CSV</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  chartCard: {
    backgroundColor: '#1A1A1A', borderRadius: 10, padding: 12,
    marginBottom: 12, borderWidth: 1, borderColor: '#333',
  },
  chartTitle: { color: '#00FF00', fontSize: 13, fontWeight: '700', marginBottom: 8 },
  chart: { borderRadius: 8 },
  geoSub: { color: '#666', fontSize: 10, marginTop: 6, textAlign: 'center' },
  exportSection: {
    backgroundColor: '#1A1A1A', borderRadius: 10, padding: 14,
    marginBottom: 12, borderWidth: 1, borderColor: '#333',
  },
  exportTitle: { color: '#00FF00', fontSize: 13, fontWeight: '700', marginBottom: 10 },
  exportRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  exportBtn: {
    backgroundColor: '#222', paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 6, borderWidth: 1, borderColor: '#444',
  },
  exportBtnText: { color: '#CCC', fontSize: 12, fontWeight: '600' },
});
```
