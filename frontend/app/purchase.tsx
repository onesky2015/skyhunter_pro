// filename: app/purchase.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
  Linking,
} from 'react-native';
import type {
  Purchase,
  PurchaseError
} from 'react-native-iap';
import {
  initConnection,
  endConnection,
  requestPurchase,
  purchaseUpdatedListener,
  purchaseErrorListener,
  finishTransaction
} from '../utils/iap';
import { useRouter } from 'expo-router';
import { useAuth } from '../hooks/useAuth';
import { apiRequest } from '../services/api';
import { useI18n } from '../i18n';
import { useTheme, getShadowStyle } from '../theme';

interface CreditProduct {
  product_id: string;
  credits: number;
  price_usd: number;
}

export default function PurchaseScreen() {
  const { t } = useI18n();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const { userToken, userInfo, refreshUserInfo, handle401Error } = useAuth();
  const [products, setProducts] = useState<CreditProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts();

    let purchaseUpdateSubscription: any = null;
    let purchaseErrorSubscription: any = null;

    if (Platform.OS !== 'web') {
      const initIAP = async () => {
        try {
          await initConnection();
        } catch (err) {
          console.warn('IAP Initialization Error:', err);
        }
      };
      initIAP();
      
      purchaseUpdateSubscription = purchaseUpdatedListener(
        async (purchase: Purchase) => {
          const isApple = Platform.OS === 'ios';
          const receipt = isApple ? (purchase as any).transactionReceipt : (purchase as any).purchaseToken;
          
          if (receipt) {
            try {
              // Send receipt to backend to verify
              const verifyUrl = isApple ? '/api/v1/payments/apple/verify' : '/api/v1/payments/google/verify';
              
              const payload = isApple 
                ? { receipt_data: receipt, product_id: purchase.productId }
                : { purchase_token: receipt, product_id: purchase.productId };
                
              const resp = await apiRequest(
                verifyUrl,
                { method: 'POST', body: JSON.stringify(payload) },
                userToken,
                handle401Error
              );
              
              if (resp.ok) {
                Alert.alert(t('common', 'success') || 'Success', t('purchase', 'creditsAdded') || 'Credits added!');
                await finishTransaction({ purchase, isConsumable: true });
                await refreshUserInfo();
              } else {
                const errData = await resp.json().catch(() => null);
                throw new Error(errData?.detail || 'Verification failed');
              }
            } catch (err: any) {
              Alert.alert('Verification Error', err.message);
            } finally {
              setPurchasing(null);
            }
          }
        }
      );
      
      purchaseErrorSubscription = purchaseErrorListener(
        (error: PurchaseError) => {
           setPurchasing(null);
           if (error.code && String(error.code) !== 'E_USER_CANCELLED') {
             Alert.alert('Purchase Error', error.message);
           }
        }
      );
    }

    return () => {
      if (purchaseUpdateSubscription) purchaseUpdateSubscription.remove();
      if (purchaseErrorSubscription) purchaseErrorSubscription.remove();
      if (Platform.OS !== 'web') {
        endConnection();
      }
    };
  }, [userToken]);

  const fetchProducts = async () => {
    try {
      const resp = await apiRequest(
        '/api/v1/payments/products',
        {},
        userToken,
        handle401Error
      );
      if (resp.ok) {
        setProducts(await resp.json());
      }
    } catch {
      Alert.alert(t('common', 'error'), t('purchase', 'failedToLoadProducts'));
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (product: CreditProduct) => {
    if (Platform.OS === 'web') {
      await handleStripePurchase(product);
    } else if (Platform.OS === 'ios') {
      await handleAppleIAP(product);
    } else {
      await handleGooglePlay(product);
    }
  };

  const handleStripePurchase = async (product: CreditProduct) => {
    setPurchasing(product.product_id);
    try {
      const resp = await apiRequest(
        '/api/v1/payments/stripe/checkout',
        {
          method: 'POST',
          body: JSON.stringify({ product_id: product.product_id }),
        },
        userToken,
        handle401Error
      );
      if (!resp.ok) {
        const err = await resp.json().catch(() => null);
        throw new Error(err?.detail || `HTTP ${resp.status}`);
      }
      const data = await resp.json();
      if (data.checkout_url) {
        const ALLOWED_CHECKOUT_HOSTS = ['checkout.stripe.com'];
        try {
          const url = new URL(data.checkout_url);
          if (!ALLOWED_CHECKOUT_HOSTS.some(h => url.hostname === h || url.hostname.endsWith('.' + h))) {
            throw new Error('Untrusted checkout URL');
          }
        } catch {
          throw new Error('Invalid checkout URL received from server');
        }
        await Linking.openURL(data.checkout_url);
      }
    } catch (err: any) {
      Alert.alert(t('purchase', 'paymentError'), err?.message || t('purchase', 'checkoutFailed'));
    } finally {
      setPurchasing(null);
    }
  };

  const handleAppleIAP = async (product: CreditProduct) => {
    setPurchasing(product.product_id);
    try {
      await requestPurchase({
        request: { apple: { sku: product.product_id } },
        type: 'in-app'
      });
    } catch (err: any) {
      setPurchasing(null);
      if (err.code && String(err.code) !== 'E_USER_CANCELLED') {
        Alert.alert('Purchase Error', err?.message || 'Failed');
      }
    }
  };

  const handleGooglePlay = async (product: CreditProduct) => {
    setPurchasing(product.product_id);
    try {
      await requestPurchase({
        request: { google: { skus: [product.product_id] } },
        type: 'in-app'
      });
    } catch (err: any) {
      setPurchasing(null);
      if (err.code && String(err.code) !== 'E_USER_CANCELLED') {
        Alert.alert('Purchase Error', err?.message || 'Failed');
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>{t('common', 'back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('purchase', 'title')}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>{t('purchase', 'currentBalance')}</Text>
          <Text style={styles.balanceValue}>{userInfo?.credits ?? 0} credits</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={theme.colors.accent} size="large" style={{ marginTop: 40 }} />
        ) : (
          products.map((product) => (
            <TouchableOpacity
              key={product.product_id}
              style={[
                styles.productCard,
                purchasing === product.product_id && styles.productCardActive,
              ]}
              onPress={() => handlePurchase(product)}
              disabled={purchasing !== null}
            >
              <View style={styles.productInfo}>
                <Text style={styles.productCredits}>{product.credits} Credits</Text>
                <Text style={styles.productPrice}>${product.price_usd.toFixed(2)}</Text>
              </View>
              {purchasing === product.product_id ? (
                <ActivityIndicator color={theme.colors.accentText} size="small" />
              ) : (
                <Text style={styles.buyText}>{t('purchase', 'buy')}</Text>
              )}
            </TouchableOpacity>
          ))
        )}

        <Text style={styles.note}>
          {Platform.OS === 'ios'
            ? 'Payment processed via Apple In-App Purchase'
            : Platform.OS === 'android'
            ? 'Payment processed via Google Play'
            : 'Payment processed via Stripe (secure checkout)'}
        </Text>
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 56,
      paddingBottom: 12,
      backgroundColor: theme.colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    backBtn: { width: 60 },
    backText: { color: theme.colors.accent, fontSize: 14 },
    headerTitle: { color: theme.colors.accent, fontSize: 18, fontWeight: '700' },
    content: { padding: 16 },
    balanceCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      alignItems: 'center',
      marginBottom: 24,
      ...getShadowStyle(theme, 1),
    },
    balanceLabel: { color: theme.colors.textMuted, fontSize: 13, marginBottom: 4 },
    balanceValue: { color: theme.colors.accent, fontSize: 28, fontWeight: '700' },
    productCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
      padding: 18,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      ...getShadowStyle(theme, theme.name === 'light' ? 0.6 : 1),
    },
    productCardActive: { borderColor: theme.colors.borderStrong },
    productInfo: { flex: 1 },
    productCredits: { color: theme.colors.text, fontSize: 18, fontWeight: '700' },
    productPrice: { color: theme.colors.accent, fontSize: 15, marginTop: 4 },
    buyText: {
      color: theme.colors.accentText,
      backgroundColor: theme.colors.accent,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: theme.radius.sm,
      fontWeight: '700',
      fontSize: 14,
      overflow: 'hidden',
    },
    note: {
      color: theme.colors.textSoft,
      fontSize: 12,
      textAlign: 'center',
      marginTop: 16,
      lineHeight: 18,
    },
  });
