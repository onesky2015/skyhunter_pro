# Source: frontend/app/auth/verify-email.tsx
# Lines: 17-114
# Type: Function: VerifyEmailScreen

```typescript
export default function VerifyEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email: string }>();
  const { verifyEmail, resendVerification } = useAuth();

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const email = params.email || '';

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleVerify = async () => {
    if (!code.trim()) {
      Alert.alert('Error', 'Please enter the verification code');
      return;
    }
    setLoading(true);
    const success = await verifyEmail(email, code.trim());
    setLoading(false);
    if (success) {
      router.replace('/(tabs)/search');
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    const success = await resendVerification(email);
    if (success) {
      Alert.alert('Code Sent', 'A new verification code has been sent to your email.');
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      timerRef.current = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  };

  const maskedEmail = email
    ? email.replace(/^(.{2})(.*)(@.*)$/, (_, a, b, c) => a + '*'.repeat(Math.min(b.length, 5)) + c)
    : '';

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>✉️ VERIFY EMAIL</Text>

        <Text style={styles.subtitle}>
          A verification code has been sent to
        </Text>
        <Text style={styles.email}>{maskedEmail}</Text>

        <Text style={styles.label}>Verification Code</Text>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          placeholder="Enter 6-digit code"
          placeholderTextColor="#666"
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleVerify}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.buttonText}>VERIFY</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
```
