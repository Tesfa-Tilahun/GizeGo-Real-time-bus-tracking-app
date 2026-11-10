import { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { GradientButton } from "../components/GradientButton.js";
import { colors } from "../theme/colors.js";
import { fetchAuthMe, updateUserProfile, uploadUserAvatar } from "../api/gizegoApi.js";
import { useAuth } from "../context/AuthContext.js";
import { useLocale } from "../context/LocaleContext.js";
import { resolveAvatarUrl } from "../utils/avatarUrl.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function DriverProfileScreen({ navigation }) {
  const { user, isDriver, updateUser } = useAuth();
  const { t } = useLocale();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [password, setPassword] = useState("");
  const [avatarPreview, setAvatarPreview] = useState(resolveAvatarUrl(user?.avatarUrl));
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  useEffect(() => {
    if (!isDriver) {
      navigation.replace("Home");
    }
  }, [isDriver, navigation]);

  useEffect(() => {
    setName(user?.name ?? "");
    setEmail(user?.email ?? "");
    setPhone(user?.phone ?? "");
    setAvatarPreview(resolveAvatarUrl(user?.avatarUrl));
  }, [user]);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t("driver.profileTitle"), t("driver.photoPermission"));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.75,
      base64: true,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    if (!asset.base64) {
      Alert.alert(t("driver.profileTitle"), t("driver.photoFail"));
      return;
    }

    setPhotoBusy(true);
    try {
      const mimeType = asset.mimeType ?? "image/jpeg";
      const data = await uploadUserAvatar({ imageBase64: asset.base64, mimeType });
      if (data?.user) {
        updateUser(data.user);
        setAvatarPreview(resolveAvatarUrl(data.user.avatarUrl));
      }
      Alert.alert(t("driver.profileTitle"), t("driver.photoSaved"));
    } catch (e) {
      Alert.alert(t("driver.profileTitle"), e.message ?? t("driver.photoFail"));
    } finally {
      setPhotoBusy(false);
    }
  };

  const save = async () => {
    const n = name.trim();
    const em = email.trim();
    const ph = phone.trim().replace(/\s+/g, "");

    if (n.length < 2) {
      Alert.alert(t("driver.profileTitle"), t("signup.nameLen"));
      return;
    }
    if (!em && !ph) {
      Alert.alert(t("driver.profileTitle"), t("signup.emailOrPhone"));
      return;
    }
    if (em && !EMAIL_RE.test(em)) {
      Alert.alert(t("driver.profileTitle"), t("signup.invalidEmail"));
      return;
    }
    if (password && password.length < 6) {
      Alert.alert(t("driver.profileTitle"), t("signup.passwordShort"));
      return;
    }

    setBusy(true);
    try {
      const body = {
        name: n,
        email: em || null,
        phone: ph || null,
      };
      if (password) body.password = password;

      const data = await updateUserProfile(body);
      if (data?.user) {
        updateUser(data.user);
      }
      setPassword("");
      Alert.alert(t("driver.profileTitle"), t("driver.profileSaved"));
    } catch (e) {
      Alert.alert(t("driver.profileTitle"), e.message ?? t("driver.saveFail"));
    } finally {
      setBusy(false);
    }
  };

  const refreshMe = async () => {
    try {
      const data = await fetchAuthMe();
      if (data?.user) updateUser(data.user);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    void refreshMe();
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient colors={[colors.headerStart, colors.headerEnd]} style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backTxt}>← {t("driver.back")}</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{t("driver.profileTitle")}</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Pressable style={styles.photoWrap} onPress={pickPhoto} disabled={photoBusy}>
          {avatarPreview ? (
            <Image source={{ uri: avatarPreview }} style={styles.photo} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoLetter}>{(name || "D").charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <Text style={styles.photoHint}>
            {photoBusy ? t("login.pleaseWait") : t("driver.changePhoto")}
          </Text>
        </Pressable>

        <Text style={styles.label}>{t("signup.fullName")}</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} />

        <Text style={styles.label}>{t("signup.emailOpt")}</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={styles.label}>{t("signup.phoneOpt")}</Text>
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

        <Text style={styles.label}>{t("driver.newPassword")}</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder={t("driver.passwordOptional")}
          placeholderTextColor={colors.textMuted}
        />

        <GradientButton
          label={busy ? t("login.pleaseWait") : t("driver.saveProfile")}
          onPress={save}
          disabled={busy}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  header: { paddingTop: 48, paddingBottom: 20, paddingHorizontal: 20 },
  backBtn: { marginBottom: 8 },
  backTxt: { color: colors.white, fontSize: 15, fontWeight: "600" },
  headerTitle: { color: colors.white, fontSize: 24, fontWeight: "800" },
  body: { padding: 24, paddingBottom: 40 },
  photoWrap: { alignItems: "center", marginBottom: 24 },
  photo: { width: 110, height: 110, borderRadius: 55 },
  photoPlaceholder: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "rgba(61, 126, 166, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  photoLetter: { fontSize: 40, fontWeight: "800", color: colors.accentBlue },
  photoHint: { marginTop: 10, color: colors.accentBlue, fontWeight: "700" },
  label: { fontSize: 15, fontWeight: "600", color: colors.textDark, marginBottom: 8, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 8,
    backgroundColor: colors.white,
  },
});
