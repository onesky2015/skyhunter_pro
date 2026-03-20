// filename: app/legal.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { API_URL } from '../constants/api';
import { useI18n } from '../i18n';

type LegalTab = 'privacy' | 'terms';

export default function LegalScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useState<LegalTab>(
    (params.tab as LegalTab) || 'privacy'
  );
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDoc = async () => {
      setLoading(true);
      try {
        const endpoint = activeTab === 'privacy' ? 'privacy' : 'terms';
        const resp = await fetch(`${API_URL}/api/v1/legal/${endpoint}`);
        if (resp.ok) {
          const data = await resp.json();
          setContent(data.content || '');
        } else {
          setContent(t('legal', 'loadFailed'));
        }
      } catch {
        setContent(t('legal', 'networkError'));
      } finally {
        setLoading(false);
      }
    };
    fetchDoc();
  }, [activeTab]);

  const renderMarkdown = (md: string) => {
    const lines = md.split('\n');
    return lines.map((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('# ')) {
        return <Text key={i} style={styles.h1}>{trimmed.slice(2)}</Text>;
      }
      if (trimmed.startsWith('## ')) {
        return <Text key={i} style={styles.h2}>{trimmed.slice(3)}</Text>;
      }
      if (trimmed.startsWith('- **') || trimmed.startsWith('- ')) {
        return (
          <Text key={i} style={styles.listItem}>
            {'  \u2022  '}{trimmed.slice(2).replace(/\*\*/g, '')}
          </Text>
        );
      }
      if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
        return <Text key={i} style={styles.bold}>{trimmed.replace(/\*\*/g, '')}</Text>;
      }
      if (trimmed === '' || trimmed === '---') {
        return <View key={i} style={{ height: 8 }} />;
      }
      return <Text key={i} style={styles.body}>{trimmed.replace(/\*\*/g, '')}</Text>;
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>{t('common', 'back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('legal', 'title')}</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'privacy' && styles.tabActive]}
          onPress={() => setActiveTab('privacy')}
        >
          <Text style={[styles.tabText, activeTab === 'privacy' && styles.tabTextActive]}>
            {t('auth', 'privacyPolicy')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'terms' && styles.tabActive]}
          onPress={() => setActiveTab('terms')}
        >
          <Text style={[styles.tabText, activeTab === 'terms' && styles.tabTextActive]}>
            {t('auth', 'termsOfService')}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <ActivityIndicator color="#00FF00" size="large" style={{ marginTop: 40 }} />
        ) : (
          renderMarkdown(content)
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: '#111111',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  backBtn: { width: 60 },
  backText: { color: '#00FF00', fontSize: 14 },
  headerTitle: { color: '#00FF00', fontSize: 18, fontWeight: '700' },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#111111',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#222222',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#00FF00',
  },
  tabText: {
    color: '#999',
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#000000',
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  h1: {
    color: '#00FF00',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    marginTop: 8,
  },
  h2: {
    color: '#00FF00',
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
  },
  bold: {
    color: '#CCCCCC',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  body: {
    color: '#AAAAAA',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 4,
  },
  listItem: {
    color: '#AAAAAA',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 2,
    paddingLeft: 8,
  },
});
